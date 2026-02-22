<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { UIHelper } from '../utils/uiHelper';
  import { withAsyncError } from '../utils/errorWrappers';
  import { ERROR_CODES } from '../utils/errorCodes';
  import { multiRosterManager } from '../legacy/modules/MultiRosterManager.js';
  import { TOAST_TYPES } from '../legacy/config/constants.js';
  import type { AppApi, RosterMeta, SettingsPayload } from '../../types/app-api';
  import { notifyRosterChanged, notifyVisibleRostersChanged, rosterChangeVersion } from '../stores/rosterSync';

  type DialogMode = 'create' | 'rename' | 'delete' | null;

  const DEFAULT_SETTINGS: SettingsPayload = {
    dbPath: '',
    dbLastLoadedAt: null,
    timezone: 'browser',
    dateFormat: 'browser',
    timeFormat: 'browser',
    autoRaidUpdateMinutes: 0,
    autoRaidUpdateOnFocus: false,
    closeToTray: false,
    closeToTrayPrompted: false,
    hiddenColumns: [],
    hiddenColumnsByRoster: {},
    hiddenBossColumns: [],
    visibleWeeklyRosters: [],
    visibleWeeklyRostersByRoster: {},
  };

  const api: AppApi = window.api;
  const ui = new UIHelper();

  let rosters: RosterMeta[] = [];
  let activeRosterId = '';
  let visiblePopoverOpen = false;
  let settings: SettingsPayload = { ...DEFAULT_SETTINGS };
  let popoverEl: HTMLDivElement | null = null;
  let toggleBtnEl: HTMLButtonElement | null = null;
  let dialogOpen = false;
  let dialogMode: DialogMode = null;
  let dialogNameInput = '';
  let dialogBusy = false;
  let unsubscribeRosterChanges: (() => void) | null = null;

  $: sortedRosters = [...rosters].sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
  $: activeRoster = sortedRosters.find((entry) => entry.id === activeRosterId) || null;
  $: activeCharacterCount = Number(activeRoster?.characterCount || 0);
  $: visibleSet = getVisibleSetFor(settings, activeRosterId);
  $: dialogTitle = dialogMode === 'create'
    ? 'Create roster'
    : dialogMode === 'rename'
      ? 'Rename roster'
      : dialogMode === 'delete'
        ? 'Delete roster'
        : '';
  $: dialogConfirmLabel = dialogMode === 'create'
    ? 'Create'
    : dialogMode === 'rename'
      ? 'Rename'
      : dialogMode === 'delete'
        ? 'Delete'
        : 'Confirm';
  $: dialogCanConfirm = dialogMode === 'delete'
    ? Boolean(activeRosterId && activeRoster && sortedRosters.length > 1)
    : Boolean(dialogNameInput.trim());

  onMount(async () => {
    await window.__API_READY__;
    await refresh();
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    let isInitialRosterSync = true;
    unsubscribeRosterChanges = rosterChangeVersion.subscribe(() => {
      if (isInitialRosterSync) {
        isInitialRosterSync = false;
        return;
      }
      void onExternalRosterChange();
    });
  });

  onDestroy(() => {
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleEscape);
    unsubscribeRosterChanges?.();
    unsubscribeRosterChanges = null;
  });

  function showToast(message: string, type = TOAST_TYPES.INFO) {
    ui.showToast(message, type);
  }

  function emitSettingsChanged(nextSettings: SettingsPayload) {
    document.dispatchEvent(new CustomEvent('settingsChanged', { detail: { settings: nextSettings } }));
  }

  async function onExternalRosterChange() {
    await refresh();
  }

  async function refresh() {
    await withAsyncError(async () => {
      const [list, active, loadedSettings] = await Promise.all([
        api.getRosterList(),
        api.getActiveRoster(),
        api.loadSettings(),
      ]);

      rosters = Array.isArray(list) ? list : [];
      activeRosterId = String(active || rosters[0]?.id || '');
      settings = {
        ...DEFAULT_SETTINGS,
        ...(loadedSettings || {}),
      } as SettingsPayload;

      if (!activeRosterId && rosters.length > 0) {
        activeRosterId = rosters[0].id;
        await api.switchActiveRoster(activeRosterId);
      }

      await ensureVisibleState();
      return true;
    }, {
      code: ERROR_CODES.ROSTER_SWITCHER.REFRESH_FAILED,
      severity: 'error',
      context: {
        phase: 'refresh',
        action: 'refresh-roster-switcher',
        rosterId: activeRosterId,
        activeRosterId,
        rosterCount: rosters.length,
      },
      showToast: true,
    });
  }

  function getVisibleSetFor(currentSettings: SettingsPayload, currentActiveRosterId: string) {
    const byRoster = currentSettings.visibleWeeklyRostersByRoster || {};
    const selected = Array.isArray(byRoster[currentActiveRosterId])
      ? byRoster[currentActiveRosterId]
      : (Array.isArray(currentSettings.visibleWeeklyRosters) ? currentSettings.visibleWeeklyRosters : []);

    const safe = new Set(selected);
    if (currentActiveRosterId) {
      safe.add(currentActiveRosterId);
    }
    return safe;
  }

  async function ensureVisibleState() {
    if (!activeRosterId) {
      return;
    }

    const desired = Array.from(getVisibleSetFor(settings, activeRosterId));
    const byRoster = settings.visibleWeeklyRostersByRoster || {};
    const currentByRoster = Array.isArray(byRoster[activeRosterId]) ? byRoster[activeRosterId] : [];

    const sameLength = currentByRoster.length === desired.length;
    const sameValues = sameLength && currentByRoster.every((value) => desired.includes(value));
    if (sameValues) {
      return;
    }

    const nextSettings: SettingsPayload = {
      ...settings,
      visibleWeeklyRosters: desired,
      visibleWeeklyRostersByRoster: {
        ...byRoster,
        [activeRosterId]: desired,
      },
    };

    await api.saveSettings(nextSettings);
    settings = nextSettings;
    emitSettingsChanged(nextSettings);
    notifyVisibleRostersChanged();
  }

  async function switchRoster(event: Event) {
    const target = event.currentTarget as HTMLSelectElement;
    const nextRosterId = String(target.value || '').trim();
    if (!nextRosterId) {
      return;
    }

    const persistedActive = String((await api.getActiveRoster()) || '').trim();
    if (nextRosterId === persistedActive) {
      activeRosterId = persistedActive;
      return;
    }

    await multiRosterManager.initialize();
    await multiRosterManager.switchActiveRoster(nextRosterId);
    activeRosterId = nextRosterId;
    await refresh();
    await ensureVisibleState();
    notifyRosterChanged();
    notifyVisibleRostersChanged();
  }

  function toggleDialog(mode: Exclude<DialogMode, null>, nameInput = '') {
    if (dialogOpen && dialogMode === mode) {
      closeDialog();
      return;
    }

    dialogMode = mode;
    dialogNameInput = nameInput;
    dialogBusy = false;
    dialogOpen = true;
  }

  function openCreateDialog() {
    toggleDialog('create');
  }

  function openRenameDialog() {
    if (!activeRosterId || !activeRoster) {
      return;
    }

    toggleDialog('rename', activeRoster.name || '');
  }

  function openDeleteDialog() {
    if (!activeRosterId || sortedRosters.length <= 1 || !activeRoster) {
      return;
    }

    toggleDialog('delete', activeRoster.name || '');
  }

  function closeDialog() {
    dialogOpen = false;
    dialogBusy = false;
    dialogMode = null;
    dialogNameInput = '';
  }

  async function confirmDialogAction() {
    if (!dialogMode || dialogBusy || !dialogCanConfirm) {
      return;
    }

    dialogBusy = true;

    const actionResult = await withAsyncError(async () => {
      if (dialogMode === 'create') {
        const name = dialogNameInput.trim();
        const newRosterId = await api.createRoster(name);
        if (newRosterId) {
          await api.switchActiveRoster(newRosterId);
        }
        await refresh();
        await ensureVisibleState();
        notifyRosterChanged();
        notifyVisibleRostersChanged();
        showToast('Roster created', TOAST_TYPES.SUCCESS);
        closeDialog();
        return;
      }

      if (dialogMode === 'rename' && activeRosterId && activeRoster) {
        const nextName = dialogNameInput.trim();
        if (!nextName || nextName === activeRoster.name) {
          closeDialog();
          return;
        }
        await api.renameRoster(activeRosterId, nextName);
        await refresh();
        notifyRosterChanged();
        showToast('Roster renamed', TOAST_TYPES.SUCCESS);
        closeDialog();
        return;
      }

      if (dialogMode === 'delete' && activeRosterId && sortedRosters.length > 1) {
        await api.deleteRoster(activeRosterId);
        await refresh();
        await ensureVisibleState();
        notifyRosterChanged();
        notifyVisibleRostersChanged();
        showToast('Roster deleted', TOAST_TYPES.SUCCESS);
        closeDialog();
      }
      return true;
    }, {
      code: ERROR_CODES.ROSTER_SWITCHER.ACTION_FAILED,
      severity: 'error',
      context: {
        phase: 'confirmDialogAction',
        action: dialogMode ? `roster-${dialogMode}` : 'roster-dialog-action',
        rosterId: activeRosterId,
        dialogMode,
        activeRosterId,
      },
      showToast: true,
    });

    if (actionResult === null) {
      dialogBusy = false;
    }
  }

  async function toggleVisibleRoster(rosterId: string, checked: boolean) {
    if (!activeRosterId) {
      return;
    }

    await withAsyncError(async () => {
      const current = new Set(getVisibleSetFor(settings, activeRosterId));

      if (rosterId === activeRosterId) {
        current.add(rosterId);
      } else if (checked) {
        current.add(rosterId);
      } else {
        current.delete(rosterId);
      }

      const nextVisible = Array.from(current);
      const byRoster = settings.visibleWeeklyRostersByRoster || {};

      const nextSettings: SettingsPayload = {
        ...settings,
        visibleWeeklyRosters: nextVisible,
        visibleWeeklyRostersByRoster: {
          ...byRoster,
          [activeRosterId]: nextVisible,
        },
      };

      await api.saveSettings(nextSettings);
      settings = nextSettings;
      emitSettingsChanged(nextSettings);
      notifyVisibleRostersChanged();
      console.info('[RosterSwitcher] Updated visible weekly rosters', {
        activeRosterId,
        changedRosterId: rosterId,
        checked,
        nextVisible,
      });
      return true;
    }, {
      code: ERROR_CODES.ROSTER_SWITCHER.TOGGLE_VISIBLE_FAILED,
      severity: 'error',
      context: {
        phase: 'toggleVisibleRoster',
        action: 'toggle-visible-roster',
        rosterId: activeRosterId,
        activeRosterId,
        changedRosterId: rosterId,
        checked,
      },
      showToast: true,
    });
  }

  function handleOutsideClick(event: MouseEvent) {
    if (!visiblePopoverOpen) {
      return;
    }

    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    if (popoverEl?.contains(target) || toggleBtnEl?.contains(target)) {
      return;
    }

    visiblePopoverOpen = false;
  }

  function handleEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      visiblePopoverOpen = false;
    }
  }
</script>

<div id="roster-switcher-container">
  <div class="roster-switcher">
    <select id="roster-select" class="roster-select" aria-label="Select active roster" bind:value={activeRosterId} on:change={switchRoster}>
      {#each sortedRosters as roster}
        <option value={roster.id}>{roster.name}</option>
      {/each}
    </select>
    <span class="roster-meta-chip" aria-label="Characters in active roster">{activeCharacterCount} chars</span>

    <div class="roster-actions">
      <button type="button" id="visible-rosters-btn" class="btn-icon" class:active={visiblePopoverOpen} title="Visible rosters in Weekly" aria-label="Choose visible rosters" aria-expanded={visiblePopoverOpen} bind:this={toggleBtnEl} on:click={() => (visiblePopoverOpen = !visiblePopoverOpen)}>👁️</button>
      <button type="button" id="create-roster-btn" class="btn-icon" title="Create New Roster" aria-label="Create new roster" on:click={openCreateDialog}>+</button>
      <button type="button" id="rename-roster-btn" class="btn-icon" title="Rename Current Roster" aria-label="Rename current roster" on:click={openRenameDialog}>✎</button>
      <button type="button" id="delete-roster-btn" class="btn-icon" title="Delete Current Roster" aria-label="Delete current roster" disabled={sortedRosters.length <= 1} on:click={openDeleteDialog}>🗑️</button>
    </div>

    <div class="visible-rosters-popover" class:open={visiblePopoverOpen} bind:this={popoverEl}>
      <div class="visible-rosters-popover__header">Rosters visible</div>
      <div class="visible-rosters-list">
        {#each sortedRosters as roster}
          <label class="visible-rosters-item">
            <input
              type="checkbox"
              checked={roster.id === activeRosterId || visibleSet.has(roster.id)}
              disabled={roster.id === activeRosterId}
              on:change={(event) => toggleVisibleRoster(roster.id, Boolean((event.currentTarget as HTMLInputElement).checked))}
            />
            <span>{roster.name}</span>
          </label>
        {/each}
      </div>
    </div>

    {#if dialogOpen}
      <div class="roster-switcher-dialog" role="dialog" aria-modal="true" aria-label={dialogTitle}>
        <div class="roster-switcher-dialog__title">{dialogTitle}</div>
        {#if dialogMode === 'delete' && activeRoster}
          <p class="roster-switcher-dialog__text">Delete <strong>{activeRoster.name}</strong>? This cannot be undone.</p>
        {:else}
          <label class="roster-switcher-dialog__label" for="roster-switcher-name-input">Roster name</label>
          <input
            id="roster-switcher-name-input"
            type="text"
            bind:value={dialogNameInput}
            maxlength="42"
            on:keydown={(event) => event.key === 'Enter' && dialogCanConfirm && !dialogBusy && confirmDialogAction()}
          />
        {/if}

        <div class="roster-switcher-dialog__actions">
          <button type="button" class="btn-icon-text" on:click={closeDialog} disabled={dialogBusy}>Cancel</button>
          <button type="button" class="btn-icon-text primary" on:click={confirmDialogAction} disabled={!dialogCanConfirm || dialogBusy}>
            {dialogBusy ? 'Working…' : dialogConfirmLabel}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
