<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import type { AppApi, ParadiseData, ParadiseRaidKey, SettingsPayload } from '../../../types/app-api';
  import { UIHelper } from '../../utils/uiHelper';
  import { CLASS_ICONS, TOAST_TYPES } from '../../legacy/config/constants.js';
  import { rosterChangeVersion, visibleRostersChangeVersion, weeklyViewSelection } from '../../stores/rosterSync';
  import { getDisplayRosterIds, getGlobalVisibleRosterIds, sortRosterIds } from '../../utils/rosterVisibility';
  import { characterKeys, normalizeCharacter, orderedEntries } from '../roster/rosterDomain';
  import { formatItemLevelDisplay } from '../../utils/formValidator';
  import {
    PARADISE_RAID_KEYS,
    PARADISE_RAID_LABELS,
    applyWeeklyResetIfNeeded,
    emptyParadiseEntry,
    getParadiseWeekKey,
    normalizeParadiseData,
    normalizeParadiseEntry,
    setParadiseCheckbox,
  } from './paradiseDomain';

  const api: AppApi = window.api;
  const ui = new UIHelper();

  type ParadiseRosterGroup = {
    rosterId: string;
    rosterName: string;
    roster: Record<string, unknown>;
    entries: { name: string }[];
  };

  let activeRosterId = '';
  let groups: ParadiseRosterGroup[] = [];
  let paradiseByRoster: Record<string, ParadiseData> = {};
  let loading = true;
  let resetConfirmOpen = false;
  let resetTargetRosterId = '';
  let resetBusy = false;
  let unsubscribeRosterChanges: (() => void) | null = null;
  let unsubscribeVisibleRosterChanges: (() => void) | null = null;
  let unsubscribeViewSelectionChanges: (() => void) | null = null;
  let reloadScheduled = false;
  // Bumped on reset so {#each} keys change and checkbox DOM nodes remount,
  // forcing Svelte to write the fresh `checked={false}` property even after
  // the user toggled the box (browser keeps the live property otherwise).
  let resetNonce = 0;

  $: hasAnyEntry = groups.some((group) => group.entries.length > 0);
  $: resetTargetRosterName = groups.find((group) => group.rosterId === resetTargetRosterId)?.rosterName || '';

  function showToast(message: string, type = TOAST_TYPES.INFO) {
    ui.showToast(message, type);
  }

  // Coalesce reloads: one user action can bump several sync stores in the
  // same tick; collapse them into a single loadAll().
  function scheduleReload() {
    if (reloadScheduled) return;
    reloadScheduled = true;
    queueMicrotask(() => {
      reloadScheduled = false;
      void loadAll();
    });
  }

  function getClassIconPath(className: string): string | null {
    const icon = (CLASS_ICONS as Record<string, string>)[className];
    return icon ? `./assets/icons/${icon}` : null;
  }

  async function resolveActiveRosterId(): Promise<string> {
    const current = await api.getActiveRoster?.();
    const currentId = String(current || '').trim();
    if (currentId) return currentId;

    const list = await api.getRosterList?.();
    if (Array.isArray(list) && list.length > 0) {
      const fallback = String(list[0]?.id || '').trim();
      if (fallback) {
        await api.switchActiveRoster?.(fallback);
        return fallback;
      }
    }

    const created = await api.createRoster?.('Main Roster');
    if (created) {
      await api.switchActiveRoster?.(created);
      return created;
    }

    return '';
  }

  async function loadAll() {
    loading = true;
    try {
      activeRosterId = await resolveActiveRosterId();
      if (!activeRosterId) {
        groups = [];
        paradiseByRoster = {};
        return;
      }

      const [rosterList, loadedSettings] = await Promise.all([
        api.getRosterList?.(),
        api.loadSettings?.(),
      ]);

      const settings = (loadedSettings || {}) as SettingsPayload;
      const rosterMeta = Array.isArray(rosterList) ? rosterList : [];
      const sortedAllRosterIds = sortRosterIds(rosterMeta);
      const allRosterIds = Array.from(new Set([...sortedAllRosterIds, activeRosterId]));
      const rosterNamesById: Record<string, string> = Object.fromEntries(
        rosterMeta
          .map((item) => [String(item?.id || '').trim(), String(item?.name || '').trim() || 'Roster'])
          .filter(([id]) => Boolean(id)),
      );

      const globalVisible = getGlobalVisibleRosterIds(
        settings,
        sortedAllRosterIds.length ? sortedAllRosterIds : [activeRosterId],
      );
      let visibleRosterIds = getDisplayRosterIds(get(weeklyViewSelection), globalVisible, allRosterIds);
      if (visibleRosterIds.length === 0) {
        visibleRosterIds = [activeRosterId];
      }

      const nextGroups: ParadiseRosterGroup[] = [];
      const nextParadise: Record<string, ParadiseData> = {};

      await Promise.all(
        visibleRosterIds.map(async (rosterId) => {
          const loaded = await api.loadRoster(rosterId);
          const rosterState = loaded?.roster || {};
          const keys = characterKeys(rosterState);
          const loadedOrder = Array.isArray(loaded?.order) ? loaded.order.filter((name) => keys.includes(name)) : [];
          const missing = keys.filter((name) => !loadedOrder.includes(name));
          const rosterOrder = [...loadedOrder, ...missing];

          const entries = orderedEntries(rosterState, rosterOrder)
            .filter((entry) => entry.data.visibleInParadise === true)
            .map((entry) => ({ name: entry.name }));

          const storedRaw = await api.loadParadiseData?.(rosterId);
          const stored = normalizeParadiseData(storedRaw);
          const { data: nextData, changed } = applyWeeklyResetIfNeeded(stored, entries.map((e) => e.name));
          nextParadise[rosterId] = nextData;
          if (changed) {
            await api.saveParadiseData?.(rosterId, nextData);
          }

          nextGroups.push({
            rosterId,
            rosterName: rosterNamesById[rosterId] || 'Roster',
            roster: rosterState,
            entries,
          });
        }),
      );

      // Preserve the visible-roster order (Promise.all resolves out of order).
      const orderIndex = new Map(visibleRosterIds.map((id, index) => [id, index]));
      nextGroups.sort((a, b) => (orderIndex.get(a.rosterId) ?? 0) - (orderIndex.get(b.rosterId) ?? 0));

      groups = nextGroups;
      paradiseByRoster = nextParadise;
    } catch {
      showToast('Failed to load Paradise data.', TOAST_TYPES.ERROR);
    } finally {
      loading = false;
    }
  }

  function getEntry(rosterId: string, name: string) {
    const data = paradiseByRoster[rosterId]?.data?.[name];
    return normalizeParadiseEntry(data ?? emptyParadiseEntry());
  }

  async function onCheckboxChange(rosterId: string, name: string, key: ParadiseRaidKey, event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const current = paradiseByRoster[rosterId];
    if (!rosterId || !current) return;
    const next = setParadiseCheckbox(current, name, key, input.checked);
    paradiseByRoster = { ...paradiseByRoster, [rosterId]: next };
    try {
      await api.saveParadiseData?.(rosterId, next);
    } catch {
      paradiseByRoster = { ...paradiseByRoster, [rosterId]: current };
      showToast('Failed to save Paradise data.', TOAST_TYPES.ERROR);
    }
  }

  function openResetConfirm(rosterId: string) {
    if (loading || !rosterId) return;
    resetTargetRosterId = rosterId;
    resetConfirmOpen = true;
  }

  function closeResetConfirm() {
    if (resetBusy) return;
    resetConfirmOpen = false;
    resetTargetRosterId = '';
  }

  async function executeReset() {
    if (resetBusy || !resetTargetRosterId) return;
    if (!groups.some((group) => group.rosterId === resetTargetRosterId)) {
      closeResetConfirm();
      return;
    }
    resetBusy = true;
    const rosterId = resetTargetRosterId;
    const previous = paradiseByRoster[rosterId];
    try {
      const next: ParadiseData = { weekKey: getParadiseWeekKey(), data: {} };
      paradiseByRoster = { ...paradiseByRoster, [rosterId]: next };
      resetNonce += 1;
      await api.saveParadiseData?.(rosterId, next);
      showToast('Paradise data reset.', TOAST_TYPES.SUCCESS);
      resetConfirmOpen = false;
      resetTargetRosterId = '';
    } catch {
      if (previous) {
        paradiseByRoster = { ...paradiseByRoster, [rosterId]: previous };
      }
      resetNonce += 1;
      showToast('Failed to reset Paradise data.', TOAST_TYPES.ERROR);
    } finally {
      resetBusy = false;
    }
  }

  function getCharacterClass(roster: Record<string, unknown>, name: string): string {
    const entry = roster[name];
    if (!entry) return '';
    return normalizeCharacter(entry).class;
  }

  function getCharacterIlvl(roster: Record<string, unknown>, name: string): number {
    const entry = roster[name];
    if (!entry) return 0;
    return normalizeCharacter(entry).ilvl;
  }

  onMount(async () => {
    await window.__API_READY__;
    await loadAll();

    let isInitial = true;
    unsubscribeRosterChanges = rosterChangeVersion.subscribe(() => {
      if (isInitial) { isInitial = false; return; }
      scheduleReload();
    });

    let isInitialVisible = true;
    unsubscribeVisibleRosterChanges = visibleRostersChangeVersion.subscribe(() => {
      if (isInitialVisible) { isInitialVisible = false; return; }
      scheduleReload();
    });

    let isInitialViewSelection = true;
    unsubscribeViewSelectionChanges = weeklyViewSelection.subscribe(() => {
      if (isInitialViewSelection) { isInitialViewSelection = false; return; }
      scheduleReload();
    });
  });

  onDestroy(() => {
    unsubscribeRosterChanges?.();
    unsubscribeRosterChanges = null;
    unsubscribeVisibleRosterChanges?.();
    unsubscribeVisibleRosterChanges = null;
    unsubscribeViewSelectionChanges?.();
    unsubscribeViewSelectionChanges = null;
  });
</script>

<section class="tab-content active paradise-tab" id="paradise-tab" aria-live="polite">
  <div class="paradise-header">
    <div class="paradise-title">
      <h2>Paradise Tracker</h2>
      <span class="paradise-beta-pill">BETA</span>
    </div>
  </div>

  {#if loading}
    <p class="paradise-empty">Loading Paradise Tracker…</p>
  {:else if !hasAnyEntry}
    <p class="paradise-empty">
      No characters set to show in Paradise. Enable "Show in Paradise" on a character from Roster Management.
    </p>
  {:else}
    <div class="weekly-cards paradise-cards">
      {#each groups as group (group.rosterId)}
        {#if group.entries.length > 0}
          <article class="weekly-card" data-roster-id={group.rosterId}>
            <div class="paradise-card-header">
              <h1 class="weekly-title">{group.rosterName}</h1>
              <button
                type="button"
                class="paradise-reset-btn"
                on:click={() => openResetConfirm(group.rosterId)}
                disabled={loading || resetBusy}
              >
                Reset Data
              </button>
            </div>
            <table class="tracker-table paradise-table">
              <thead>
                <tr>
                  <th>Character</th>
                  {#each PARADISE_RAID_KEYS as key (key)}
                    <th>{PARADISE_RAID_LABELS[key]}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each group.entries as entry (group.rosterId + ':' + entry.name + ':' + resetNonce)}
                  {@const current = getEntry(group.rosterId, entry.name)}
                  {@const characterClass = getCharacterClass(group.roster, entry.name)}
                  {@const classIconPath = getClassIconPath(characterClass)}
                  <tr>
                    <td class="char-cell">
                      <div class="char-name" title={entry.name}>
                        <span class="char-name-text">{entry.name}</span>
                        {#if classIconPath}
                          <img src={classIconPath} alt={characterClass} width="28" height="28" />
                        {/if}
                      </div>
                      <div class="char-info">
                        <span class="char-class">{characterClass}</span>
                        <span class="char-ilvl">({formatItemLevelDisplay(getCharacterIlvl(group.roster, entry.name))})</span>
                      </div>
                    </td>

                    {#each PARADISE_RAID_KEYS as key (key)}
                      <td class="boss-cell paradise-check-cell">
                        <input
                          class="daily-checkmark"
                          type="checkbox"
                          checked={current[key]}
                          on:change={(event) => onCheckboxChange(group.rosterId, entry.name, key, event)}
                          aria-label={`${PARADISE_RAID_LABELS[key]} for ${entry.name}`}
                        />
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </article>
        {/if}
      {/each}
    </div>
  {/if}
</section>

{#if resetConfirmOpen}
  <div class="settings-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="paradise-reset-title">
    <div class="settings-confirm-card">
      <h3 id="paradise-reset-title">Reset Paradise data?</h3>
      <p>This clears every Paradise checkbox for <strong>{resetTargetRosterName}</strong>. Weekly Tracker data is not affected.</p>
      <div class="settings-confirm-actions">
        <button type="button" on:click={closeResetConfirm} disabled={resetBusy}>Cancel</button>
        <button
          type="button"
          class="danger-action-btn"
          on:click={executeReset}
          disabled={resetBusy}
        >
          {resetBusy ? 'Resetting…' : 'Confirm reset'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .paradise-tab {
    display: block;
    width: fit-content;
    max-width: 100%;
    margin: 0 auto;
  }

  .paradise-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 2px 14px;
    flex-wrap: wrap;
  }

  .paradise-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .paradise-title h2 {
    margin: 0;
    font-size: 18px;
    color: var(--color-text);
  }

  .paradise-beta-pill {
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    border-radius: 999px;
    background: #a855f7;
    color: #fff;
  }

  .paradise-reset-btn {
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;
  }

  .paradise-reset-btn:hover:not(:disabled) {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .paradise-reset-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .paradise-empty {
    padding: 24px 8px;
    color: var(--color-text-secondary);
    font-size: 14px;
  }

  .paradise-check-cell {
    text-align: center;
  }

  .paradise-cards {
    margin-top: 4px;
  }

  .paradise-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .paradise-card-header :global(.weekly-title) {
    margin: 0;
  }
</style>
