<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { UIHelper } from '../../utils/uiHelper';
  import { CHARACTER_CLASSES, CLASS_ICONS, MATHI_API_CONFIG, TOAST_TYPES, mapApiClassToDisplay } from '../../legacy/config/constants.js';
  import { BibleApiRequestError, BibleApiService } from '../../services/BibleApiService';
  import type { BibleRegion } from '../../services/BibleApiService';
  import {
    formatCombatPowerDisplay,
    formatItemLevelDisplay,
    sanitizeCharacterNameInput,
    sanitizeDecimalInput,
    validateRosterFormDetailed,
    ROSTER_VALIDATION,
  } from '../../utils/formValidator';
  import { withAsyncError } from '../../utils/errorWrappers';
  import { ERROR_CODES } from '../../utils/errorCodes';
  import type { AppApi } from '../../../types/app-api';
  import {
    applyRefreshToExisting,
    applySort,
    loadRosterState,
    orderedEntries,
    persistRosterState,
    removeCharacter as removeCharacterFromState,
    reorderNames,
    toggleCharacterVisibility,
    upsertCharacter,
    type RosterEntry,
    type SortType,
  } from './rosterDomain';
  import { notifyRosterChanged, rosterChangeVersion } from '../../stores/rosterSync';

  const api: AppApi = window.api;
  const ui = new UIHelper();

  let activeRosterId = '';
  let loading = false;
  let roster: Record<string, unknown> = {};
  let order: string[] = [];
  let sortType: SortType = 'manual';

  let formName = '';
  let formClass = '';
  let formIlvl = '';
  let formCombatPower = '';
  let editingName: string | null = null;
  let characters: RosterEntry[] = [];
  let isEditing: boolean;
  let sortDropdownOpen = false;
  let sortButtonRef: HTMLDivElement | null = null;
  let draggingName: string | null = null;
  let dragActive = false;
  let refreshCooldownRemaining = 0;
  let refreshCooldownTimer: ReturnType<typeof setInterval> | null = null;
  let totalCharacters: number;
  let visibleCharacters: number;
  let unsubscribeRosterChanges: (() => void) | null = null;
  let pendingRemoveCharacterName = '';
  let removeCharacterConfirmOpen = false;
  let characterFormOpen = false;
  let bibleCharacterModalOpen = false;
  let bibleCharacterName = '';
  let bibleRegion: BibleRegion = (MATHI_API_CONFIG.DEFAULT_REGION === 'EU' ? 'EU' : 'NA');
  let bibleLoading = false;
  let removeConfirmCancelButton: HTMLButtonElement | null = null;
  let removeConfirmActionButton: HTMLButtonElement | null = null;
  let removeConfirmReturnFocusEl: HTMLElement | null = null;

  const REFRESH_COOLDOWN_MS = 60_000;
  const DEFAULT_MATHI_REGION: BibleRegion = 'NA';

  $: characters = orderedEntries(roster, order);
  $: isEditing = Boolean(editingName);
  $: totalCharacters = characters.length;
  $: visibleCharacters = characters.filter((entry) => entry.data.visible !== false).length;

  onMount(async () => {
    await window.__API_READY__;
    await loadRosterData();
    document.addEventListener('click', handleDocumentClick);

    let isInitialRosterSync = true;
    unsubscribeRosterChanges = rosterChangeVersion.subscribe(() => {
      if (isInitialRosterSync) {
        isInitialRosterSync = false;
        return;
      }
      handleRosterChanged();
    });
  });

  onDestroy(() => {
    document.removeEventListener('click', handleDocumentClick);
    unsubscribeRosterChanges?.();
    unsubscribeRosterChanges = null;
    if (refreshCooldownTimer) {
      clearInterval(refreshCooldownTimer);
      refreshCooldownTimer = null;
    }
  });

  function showToast(message: string, type = TOAST_TYPES.INFO) {
    ui.showToast(message, type);
  }

  function handleRosterChanged() {
    void loadRosterData(true);
  }

  function handleDocumentClick(event: MouseEvent) {
    if (!sortDropdownOpen || !sortButtonRef) {
      return;
    }

    const target = event.target as Node | null;
    if (!target || !sortButtonRef.contains(target)) {
      sortDropdownOpen = false;
    }
  }

  function emitRosterChanged() {
    notifyRosterChanged();
  }

  async function persistRoster(nextRoster: Record<string, unknown>, nextOrder: string[]) {
    const rosterId = await persistRosterState(api, activeRosterId, nextRoster, nextOrder);
    activeRosterId = rosterId;
    roster = nextRoster;
    order = nextOrder;
    emitRosterChanged();
  }

  async function loadRosterData(forceResolveActiveRoster = false) {
    loading = true;
    try {
      const seedRosterId = forceResolveActiveRoster ? '' : activeRosterId;
      const state = await withAsyncError(
        () => loadRosterState(api, seedRosterId),
        {
        code: ERROR_CODES.STATE.LOAD_FAILED,
        severity: 'error',
        context: {
          phase: 'loadRosterData',
          action: 'load-roster-data',
          rosterId: activeRosterId,
          forceResolveActiveRoster,
        },
        showToast: true,
        }
      );

      if (state) {
        activeRosterId = state.activeRosterId;
        roster = state.roster;
        order = state.order;
      }
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    formName = '';
    formClass = '';
    formIlvl = '';
    formCombatPower = '';
    editingName = null;
  }

  function openCharacterFormForCreate() {
    resetForm();
    characterFormOpen = true;
  }

  function closeCharacterForm() {
    characterFormOpen = false;
    resetForm();
  }

  function onCharacterFormOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeCharacterForm();
    }
  }

  function onCharacterFormOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCharacterForm();
    }
  }

  function startEdit(name: string) {
    const character = characters.find((entry) => entry.name === name)?.data;
    if (!character) return;
    formName = name;
    formClass = character.class;
    formIlvl = String(character.ilvl || '');
    formCombatPower = character.combatPower ? String(character.combatPower) : '';
    editingName = name;
    characterFormOpen = true;
  }

  function getClassIconPath(className: string) {
    const icon = (CLASS_ICONS as Record<string, string>)[className];
    return icon ? `./assets/icons/${icon}` : null;
  }

  function getSortButtonText() {
    if (sortType === 'ilvl') return 'iL↓';
    if (sortType === 'combatPower') return 'CP↓';
    return '⇅';
  }

  function openBibleCharacterModal() {
    if (loading) return;
    bibleCharacterName = '';
    bibleRegion = MATHI_API_CONFIG.DEFAULT_REGION === 'EU' ? 'EU' : 'NA';
    bibleCharacterModalOpen = true;
  }

  function closeBibleCharacterModal() {
    bibleCharacterModalOpen = false;
    bibleLoading = false;
  }

  function onBibleModalOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeBibleCharacterModal();
    }
  }

  function onBibleModalOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeBibleCharacterModal();
    }
  }

  function normalizeMathiCharacterPayload(raw: any) {
    const name = String(raw?.name || raw?.character_name || raw?.characterName || bibleCharacterName || '').trim();
    const classRaw = String(raw?.class || raw?.character_class || raw?.characterClass || '').trim();
    const characterClass = mapApiClassToDisplay(classRaw);
    const ilvlRaw = Number(raw?.item_level ?? raw?.ilvl ?? raw?.gear_score ?? 0);

    const combatPowerSource = raw?.combat_power;
    const combatPower = Number(
      typeof combatPowerSource === 'object' && combatPowerSource !== null
        ? (combatPowerSource?.score ?? combatPowerSource?.value ?? 0)
        : (combatPowerSource ?? raw?.combat_power_score ?? 0)
    );

    return {
      name,
      characterClass,
      ilvl: Number.isFinite(ilvlRaw) ? Math.round(ilvlRaw * 100) / 100 : 0,
      combatPower: Number.isFinite(combatPower) && combatPower > 0 ? Math.round(combatPower * 100) / 100 : null,
    };
  }

  async function importSingleCharacterFromBible() {
    const trimmedName = bibleCharacterName.trim();
    if (!trimmedName) {
      showToast('Enter a character name to search on Bible API.', TOAST_TYPES.WARNING);
      return;
    }

    bibleLoading = true;
    const completed = await withAsyncError(async () => {
      let payload: unknown;
      try {
        payload = await BibleApiService.fetchCharacterByName(bibleRegion, trimmedName);
      } catch (error) {
        const isNotFound = error instanceof BibleApiRequestError
          ? error.status === 404
          : String(error || '').includes('HTTP 404');

        if (isNotFound) {
          showToast('Character not found on Bible API. Check the name and region.', TOAST_TYPES.ERROR);
          return true;
        }

        throw error;
      }

      const normalized = normalizeMathiCharacterPayload(payload);

      if (!normalized.name || normalized.ilvl <= 0) {
        showToast('Character not found or missing required data.', TOAST_TYPES.ERROR);
        return true;
      }

      const classInList = CHARACTER_CLASSES.includes(normalized.characterClass);
      formName = normalized.name;
      formClass = classInList ? normalized.characterClass : '';
      formIlvl = String(normalized.ilvl);
      formCombatPower = normalized.combatPower ? String(normalized.combatPower) : '';
      editingName = null;

      bibleCharacterModalOpen = false;
      characterFormOpen = true;

      if (!classInList) {
        showToast('Character loaded. Select class manually before saving.', TOAST_TYPES.WARNING);
      } else {
        showToast('Character loaded from Bible API. Review and save.', TOAST_TYPES.SUCCESS);
      }

      return true;
    }, {
      code: ERROR_CODES.NETWORK.REQUEST_FAILED,
      severity: 'error',
      context: {
        phase: 'importSingleCharacterFromBible',
        action: 'fetch-character-by-name',
        rosterId: activeRosterId,
        region: bibleRegion,
        characterName: trimmedName,
      },
      showToast: true,
    });

    bibleLoading = false;
    if (!completed) {
      return;
    }
  }

  function toggleSortDropdown(event: MouseEvent) {
    event.stopPropagation();
    sortDropdownOpen = !sortDropdownOpen;
  }

  function toggleSortDropdownFromKeyboard(event: KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    sortDropdownOpen = !sortDropdownOpen;
  }

  function startRefreshCooldown() {
    const endsAt = Date.now() + REFRESH_COOLDOWN_MS;
    refreshCooldownRemaining = Math.ceil(REFRESH_COOLDOWN_MS / 1000);

    if (refreshCooldownTimer) {
      clearInterval(refreshCooldownTimer);
    }

    refreshCooldownTimer = setInterval(() => {
      const remainingMs = endsAt - Date.now();
      if (remainingMs <= 0) {
        refreshCooldownRemaining = 0;
        if (refreshCooldownTimer) {
          clearInterval(refreshCooldownTimer);
          refreshCooldownTimer = null;
        }
        return;
      }

      refreshCooldownRemaining = Math.ceil(remainingMs / 1000);
    }, 1000);
  }

  async function handleRefreshRoster() {
    if (refreshCooldownRemaining > 0) {
      showToast(`Please wait ${refreshCooldownRemaining}s before trying again.`, TOAST_TYPES.WARNING);
      return;
    }

    if (characters.length === 0) {
      showToast('No characters to refresh. Add characters first.', TOAST_TYPES.WARNING);
      return;
    }

    loading = true;
    startRefreshCooldown();

    const completed = await withAsyncError(async () => {
      const firstCharacterName = characters[0]?.name;
      if (!firstCharacterName) {
        showToast('No characters to refresh. Add characters first.', TOAST_TYPES.WARNING);
        return true;
      }

      let apiCharacters: Awaited<ReturnType<typeof BibleApiService.fetchFullRoster>>;
      try {
        apiCharacters = await BibleApiService.fetchFullRoster(DEFAULT_MATHI_REGION, firstCharacterName);
      } catch (error) {
        const isNotFound = error instanceof BibleApiRequestError
          ? error.status === 404
          : String(error || '').includes('HTTP 404');

        if (isNotFound) {
          showToast('Character not found on Bible API. Check the name and region.', TOAST_TYPES.ERROR);
          return true;
        }

        throw error;
      }

      if (!Array.isArray(apiCharacters) || apiCharacters.length === 0) {
        showToast('No characters found on Bible API', TOAST_TYPES.ERROR);
        return true;
      }

      const next = applyRefreshToExisting(roster, apiCharacters);
      await persistRoster(next.roster, [...order]);
      showToast(`Successfully refreshed ${next.updatedCount} character${next.updatedCount !== 1 ? 's' : ''} from Bible API!`, TOAST_TYPES.SUCCESS);
      return true;
    }, {
        code: ERROR_CODES.NETWORK.REQUEST_FAILED,
        severity: 'error',
        context: {
          phase: 'handleRefreshRoster',
          action: 'refresh-roster-from-api',
          rosterId: activeRosterId,
          region: DEFAULT_MATHI_REGION,
        },
        showToast: true,
      });

    loading = false;
    if (!completed) {
      return;
    }

    closeCharacterForm();
  }

  function startDrag(event: DragEvent, name: string) {
    dragActive = true;
    draggingName = name;
    (event.currentTarget as HTMLElement | null)?.classList.add('dragging');
    event.dataTransfer?.setData('text/plain', name);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.dropEffect = 'move';
    }
    event.dataTransfer?.setDragImage((event.currentTarget as HTMLElement), 20, 20);
  }

  function endDrag(event: DragEvent) {
    (event.currentTarget as HTMLElement | null)?.classList.remove('dragging');
    draggingName = null;
    dragActive = false;
  }

  function allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  async function dropOnCard(event: DragEvent, targetName: string) {
    event.preventDefault();

    const dragged = draggingName || event.dataTransfer?.getData('text/plain') || '';
    const draggedName = String(dragged || '').trim();
    const safeTarget = String(targetName || '').trim();

    if (!draggedName || !safeTarget || draggedName === safeTarget) {
      dragActive = false;
      return;
    }

    const nextOrder = reorderNames(order, draggedName, safeTarget);
    sortType = 'manual';
    sortDropdownOpen = false;

    await persistRoster({ ...roster }, nextOrder);
    dragActive = false;
  }

  async function submitCharacter() {
    const completed = await withAsyncError(async () => {
      const validationResult = validateRosterFormDetailed({
        name: formName,
        characterClass: formClass,
        itemLevelRaw: formIlvl,
        combatPowerRaw: formCombatPower,
      });

      if (!validationResult.isValid) {
        showToast(validationResult.issue?.message || 'Invalid roster form data', TOAST_TYPES.ERROR);
        return;
      }

      const roundedIlvl = Math.round(Number(formIlvl) * 100) / 100;
      const rawCombatPower = Number(formCombatPower);
      const roundedCp = Number.isFinite(rawCombatPower) && rawCombatPower > 0 ? Math.round(rawCombatPower * 100) / 100 : null;

      const next = upsertCharacter(roster, order, {
        name: formName,
        class: String(formClass || '').trim(),
        ilvl: roundedIlvl,
        combatPower: roundedCp,
        editingName,
      });

      await persistRoster(next.roster, next.order);
      showToast(next.created ? 'Character added' : 'Character updated', TOAST_TYPES.SUCCESS);
      resetForm();
      return true;
    }, {
        code: ERROR_CODES.DB.WRITE_FAILED,
        severity: 'error',
        context: {
          phase: 'submitCharacter',
          action: editingName ? 'update-character' : 'add-character',
          rosterId: activeRosterId,
          editing: Boolean(editingName),
        },
        showToast: true,
      });

    if (!completed) {
      return;
    }

    closeCharacterForm();
  }

  function handleNameInput() {
    formName = sanitizeCharacterNameInput(formName);
  }

  function handleItemLevelInput() {
    formIlvl = sanitizeDecimalInput(formIlvl, {
      decimalPlaces: ROSTER_VALIDATION.ITEM_LEVEL_DECIMAL_PLACES,
      min: ROSTER_VALIDATION.ITEM_LEVEL_MIN,
      max: ROSTER_VALIDATION.ITEM_LEVEL_MAX,
      allowEmpty: true,
    });
  }

  function handleCombatPowerInput() {
    formCombatPower = sanitizeDecimalInput(formCombatPower, {
      decimalPlaces: ROSTER_VALIDATION.COMBAT_POWER_DECIMAL_PLACES,
      min: 0,
      allowEmpty: true,
    });
  }

  async function requestRemoveCharacter(name: string) {
    removeConfirmReturnFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pendingRemoveCharacterName = name;
    removeCharacterConfirmOpen = true;
    await tick();
    removeConfirmActionButton?.focus();
  }

  function closeRemoveCharacterConfirm() {
    removeCharacterConfirmOpen = false;
    pendingRemoveCharacterName = '';
    const returnFocusEl = removeConfirmReturnFocusEl;
    removeConfirmReturnFocusEl = null;
    if (returnFocusEl && typeof returnFocusEl.focus === 'function') {
      returnFocusEl.focus();
    }
  }

  function onRemoveConfirmOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeRemoveCharacterConfirm();
    }
  }

  function onRemoveConfirmOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeRemoveCharacterConfirm();
      return;
    }

    if (event.key === 'Tab') {
      const focusables = [removeConfirmCancelButton, removeConfirmActionButton].filter(Boolean) as HTMLButtonElement[];
      if (focusables.length === 0) {
        return;
      }

      const currentIndex = focusables.findIndex((entry) => entry === document.activeElement);
      if (event.shiftKey) {
        event.preventDefault();
        const nextIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
        focusables[nextIndex]?.focus();
      } else {
        event.preventDefault();
        const nextIndex = currentIndex === -1 || currentIndex === focusables.length - 1 ? 0 : currentIndex + 1;
        focusables[nextIndex]?.focus();
      }
    }
  }

  async function removeCharacter(name: string) {
    const next = removeCharacterFromState(roster, order, name);
    await persistRoster(next.roster, next.order);
    showToast('Character removed', TOAST_TYPES.SUCCESS);
  }

  async function confirmRemoveCharacter() {
    if (!pendingRemoveCharacterName) {
      closeRemoveCharacterConfirm();
      return;
    }

    await removeCharacter(pendingRemoveCharacterName);
    closeRemoveCharacterConfirm();
  }

  async function toggleVisibility(name: string) {
    const nextRoster = toggleCharacterVisibility(roster, name);
    await persistRoster(nextRoster, [...order]);
  }

  async function applySortChoice(nextSort: SortType) {
    sortType = nextSort;
    sortDropdownOpen = false;
    if (nextSort === 'manual') {
      return;
    }

    const sortedNames = applySort(characters, nextSort);
    await persistRoster({ ...roster }, sortedNames);
  }
</script>

<section class="tab-content active" id="roster-tab">
  <div class="roster-header">
    <div class="roster-heading-group">
      <h1>Roster Management</h1>
      <p class="roster-subtitle">Manage classes, priority and visibility for your weekly planning.</p>
    </div>
  </div>

  <div class="roster-summary" aria-live="polite">
    <span class="roster-summary-chip">Total: {totalCharacters}</span>
    <span class="roster-summary-chip">Visible: {visibleCharacters}</span>
    <span class="roster-summary-chip">Hidden: {Math.max(0, totalCharacters - visibleCharacters)}</span>
  </div>

  <div class="roster-controls">
    <div
      id="sort-roster-btn"
      class="sort-roster-btn"
      class:active={sortDropdownOpen}
      title="Sort roster"
      aria-label="Sort roster"
      role="button"
      tabindex="0"
      bind:this={sortButtonRef}
      on:click={toggleSortDropdown}
      on:keydown={toggleSortDropdownFromKeyboard}
    >
      <span class="sort-btn-text">{getSortButtonText()}</span>

      <div class="sort-dropdown" class:visible={sortDropdownOpen}>
        <button type="button" class:selected={sortType === 'manual'} on:click|stopPropagation={() => applySortChoice('manual')}>Manual Order</button>
        <button type="button" class:selected={sortType === 'ilvl'} on:click|stopPropagation={() => applySortChoice('ilvl')}>Item Level ↓</button>
        <button type="button" class:selected={sortType === 'combatPower'} on:click|stopPropagation={() => applySortChoice('combatPower')}>Combat Power ↓</button>
      </div>
    </div>

    <div class="add-character-source-group" role="group" aria-label="Add character source">
      <span class="add-character-source-title">Add Character</span>
      <div class="add-character-source-actions">
        <button
          id="open-add-char-btn"
          class="sort-roster-btn"
          type="button"
          title="Add character manually"
          aria-label="Add character manually"
          on:click={openCharacterFormForCreate}
        >
          <span class="btn-label">Manual</span>
        </button>

        <button
          id="import-mathi-btn"
          class="sort-roster-btn"
          title="Find character on Bible API"
          aria-label="Find character on Bible API"
          type="button"
          on:click={openBibleCharacterModal}
        >
          <img class="btn-icon-image" src="./assets/icons/items/bibleicon.png" alt="" aria-hidden="true" draggable="false" />
          <span class="btn-label">Bible</span>
        </button>
      </div>
    </div>

    <button
      id="refresh-roster-btn"
      class={`sort-roster-btn ${refreshCooldownRemaining > 0 ? 'cooldown-active' : ''}`}
      title="Refresh roster from Bible API"
      aria-label="Refresh roster from Bible API"
      type="button"
      disabled={loading || refreshCooldownRemaining > 0}
      on:click={handleRefreshRoster}
    >
      <svg width="16" height="16" viewBox="-0.45 0 60.369 60.369" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(-446.571 -211.615)">
          <path d="M504.547,265.443h-9.019a30.964,30.964,0,0,0-29.042-52.733,1.5,1.5,0,1,0,.792,2.894,27.955,27.955,0,0,1,25.512,48.253l0-10.169h-.011a1.493,1.493,0,0,0-2.985,0h0v13.255a1.5,1.5,0,0,0,1.5,1.5h13.256a1.5,1.5,0,1,0,0-3Z" fill="currentColor"/>
          <path d="M485.389,267.995a27.956,27.956,0,0,1-25.561-48.213l0,10.2h.015a1.491,1.491,0,0,0,2.978,0h.007V216.791a1.484,1.484,0,0,0-1.189-1.532l-.018-.005a1.533,1.533,0,0,0-.223-.022c-.024,0-.046-.007-.07-.007H448.071a1.5,1.5,0,0,0,0,3h8.995a30.963,30.963,0,0,0,29.115,52.664,1.5,1.5,0,0,0-.792-2.894Z" fill="currentColor"/>
        </g>
      </svg>
      <span class="btn-label">{refreshCooldownRemaining > 0 ? `Wait ${refreshCooldownRemaining}s` : 'Refresh'}</span>
    </button>
  </div>

  <div id="roster-list" class:drag-active={dragActive}>
    {#if characters.length === 0}
      <p class="friends-empty roster-empty">No characters in roster.</p>
    {/if}

    {#each characters as character (character.name)}
      <article
        class="character-card"
        draggable="true"
        data-name={character.name}
        on:dragstart={(event) => startDrag(event, character.name)}
        on:dragend={endDrag}
        on:dragover={allowDrop}
        on:drop={(event) => dropOnCard(event, character.name)}
      >
        {#if getClassIconPath(character.data.class)}
          <img
            class="character-class-icon"
            src={getClassIconPath(character.data.class) || ''}
            alt={character.data.class}
            draggable="false"
          />
        {/if}

        <h3 title={character.name}>{character.name}</h3>
        <p>Class: {character.data.class}</p>
        <p>Item Level: {formatItemLevelDisplay(character.data.ilvl)}</p>
        {#if character.data.combatPower}
          <p>Combat Power: {formatCombatPowerDisplay(character.data.combatPower)}</p>
        {/if}

        <div class="card-actions">
          <button type="button" class="edit-btn" on:click={() => startEdit(character.name)}>Edit</button>

          <button
            type="button"
            class="hide-weekly-btn"
            on:click={() => toggleVisibility(character.name)}
          >
            {character.data.visible !== false ? 'Hide' : 'Show'} in Weekly
          </button>

          <div
            class="remove-icon"
            title="Remove character"
            role="button"
            aria-label={`Remove ${character.name}`}
            tabindex="0"
            on:click={() => requestRemoveCharacter(character.name)}
            on:keydown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                void requestRemoveCharacter(character.name);
              }
            }}
          >
            <img src="./assets/icons/items/trash.svg" alt="" draggable="false" />
          </div>
        </div>
      </article>
    {/each}
  </div>

  {#if characterFormOpen}
    <div
      class="roster-form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-form-title"
      tabindex="0"
      on:click={onCharacterFormOverlayClick}
      on:keydown={onCharacterFormOverlayKeydown}
    >
      <div class="roster-form-panel" role="document">
        <div class="roster-form-header">
          <h3 id="roster-form-title">{isEditing ? 'Edit Character' : 'Add Character'}</h3>
          <button type="button" class="roster-form-close" on:click={closeCharacterForm} aria-label="Close add character form">×</button>
        </div>

        <form class="add-character" aria-label="Add or edit character" on:submit|preventDefault={submitCharacter}>
          <input id="char-name" type="text" placeholder="Character Name" bind:value={formName} on:input={handleNameInput} />

          <select id="char-class" bind:value={formClass}>
            <option value="">Select Class</option>
            {#each CHARACTER_CLASSES as className (className)}
              <option value={className}>{className}</option>
            {/each}
          </select>

          <input id="char-ilvl" placeholder="Item Level" type="text" inputmode="decimal" bind:value={formIlvl} on:input={handleItemLevelInput} />
          <input id="char-cp" placeholder="Combat Power (optional)" type="text" inputmode="decimal" bind:value={formCombatPower} on:input={handleCombatPowerInput} />

          <button type="button" id="add-char" on:click={submitCharacter} disabled={loading}>
            {isEditing ? 'Update Character' : 'Add Character'}
          </button>

          <button type="button" on:click={closeCharacterForm} disabled={loading}>Cancel</button>
        </form>
      </div>
    </div>
  {/if}

  {#if bibleCharacterModalOpen}
    <div
      class="roster-form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bible-character-title"
      tabindex="0"
      on:click={onBibleModalOverlayClick}
      on:keydown={onBibleModalOverlayKeydown}
    >
      <div class="roster-form-panel" role="document">
        <div class="roster-form-header">
          <h3 id="bible-character-title">Add from Bible API</h3>
          <button type="button" class="roster-form-close" on:click={closeBibleCharacterModal} aria-label="Close Bible character modal">×</button>
        </div>

        <form class="add-character" aria-label="Find character by name" on:submit|preventDefault={importSingleCharacterFromBible}>
          <input
            id="bible-char-name"
            type="text"
            placeholder="Character Name"
            bind:value={bibleCharacterName}
            disabled={bibleLoading}
          />

          <select id="bible-region" bind:value={bibleRegion} disabled={bibleLoading}>
            {#each MATHI_API_CONFIG.REGIONS as region (region)}
              <option value={region}>{region}</option>
            {/each}
          </select>

          <button type="button" id="bible-char-search" on:click={importSingleCharacterFromBible} disabled={bibleLoading}>
            {bibleLoading ? 'Searching…' : 'Find Character'}
          </button>

          <button type="button" on:click={closeBibleCharacterModal} disabled={bibleLoading}>Cancel</button>
        </form>
      </div>
    </div>
  {/if}

  {#if removeCharacterConfirmOpen}
    <div
      class="settings-confirm-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="roster-remove-confirm-title"
      aria-describedby="roster-remove-confirm-description"
      tabindex="0"
      on:click={onRemoveConfirmOverlayClick}
      on:keydown={onRemoveConfirmOverlayKeydown}
    >
      <div class="settings-confirm-card" role="document">
        <h3 id="roster-remove-confirm-title">Remove character</h3>
        <p id="roster-remove-confirm-description">Remove <strong>{pendingRemoveCharacterName}</strong> from this roster?</p>
        <div class="settings-confirm-actions">
          <button type="button" bind:this={removeConfirmCancelButton} on:click={closeRemoveCharacterConfirm} disabled={loading}>Cancel</button>
          <button type="button" bind:this={removeConfirmActionButton} class="danger-action-btn" on:click={confirmRemoveCharacter} disabled={loading}>Remove</button>
        </div>
      </div>
    </div>
  {/if}
</section>
