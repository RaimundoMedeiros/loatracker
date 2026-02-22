<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { UIHelper } from '../../utils/uiHelper';
  import { notifyRosterChanged, rosterChangeVersion, visibleRostersChangeVersion } from '../../stores/rosterSync';
  import type { AppApi, SettingsPayload } from '../../../types/app-api';
  import {
    BOSSES,
    BOSS_MAP,
    CLASS_ICONS,
    RAID_CONFIG,
    DAILY_RESET,
    TOAST_TYPES,
  } from '../../legacy/config/constants.js';
  import { formatItemLevelDisplay } from '../../utils/formValidator';
  import { reportError } from '../../utils/errorHandler';
  import { ERROR_CODES } from '../../utils/errorCodes';

  type Difficulty = 'Solo' | 'Normal' | 'Hard';

  type RosterCharacter = {
    class: string;
    ilvl: number;
    visible?: boolean;
    combatPower?: number | null;
  };

  type RaidCell = {
    cleared: boolean;
    difficulty: Difficulty;
    hidden: boolean;
    chestOpened: boolean;
    timestamp: string | null;
  };

  type CharacterBossData = Record<string, RaidCell> & { _extraGold?: number };
  type CharacterDataMap = Record<string, CharacterBossData>;

  type DailyActivity = {
    completed: boolean;
    boss: string | null;
    timestamp: string | null;
  };

  type DailyData = {
    date: string;
    characters: Record<string, { guardianRaid: DailyActivity; chaosDungeon: DailyActivity }>;
    roster: { fieldBoss: DailyActivity; chaosGate: DailyActivity };
  };

  type DailyPeriod = {
    start: Date;
    end: Date;
    startIso: string;
  };

  type WeeklyConfirmAction = 'reset-weekly' | null;

  type WeeklyCardSnapshot = {
    rosterId: string;
    rosterName: string;
    roster: Record<string, RosterCharacter | unknown>;
    order: string[];
    characterData: CharacterDataMap;
    dailyData: DailyData | null;
    hiddenColumns: string[];
    isActive: boolean;
  };

  const api: AppApi = window.api;
  const ui = new UIHelper();
  const WEEKLY_DEBUG_ENABLED = false;
  const AUTO_RAID_FOCUS_DEDUP_MS = 1200;
  const API_READY_TIMEOUT_MS = 6000;

  const DEFAULT_RAID_CELL: RaidCell = {
    cleared: false,
    difficulty: 'Solo',
    hidden: false,
    chestOpened: false,
    timestamp: null,
  };

  let loading = false;
  let activeRosterId = '';
  let roster: Record<string, RosterCharacter | unknown> = {};
  let order: string[] = [];
  let characterData: CharacterDataMap = {};
  let timerText = 'Weekly Reset: --:--:--';
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let dailyData: DailyData | null = null;
  let visibleCharacters: string[] = [];
  let goldByCharacter: Record<string, number> = {};
  let totalGold = 0;
  let unsubscribeRosterChanges: (() => void) | null = null;
  let unsubscribeVisibleRosterChanges: (() => void) | null = null;
  let lastDebugSignature = '';
  let hiddenColumns: string[] = [];
  let columnSettingsOpen = false;
  let draftVisibleColumns: Record<string, boolean> = {};
  let goldPopoverCharacter: string | null = null;
  let goldBonusInput = '';
  let goldBonusInputRef: HTMLInputElement | null = null;
  let draggingCharacterName: string | null = null;
  let dragOverCharacterName: string | null = null;
  let dailyResetCheckedForPeriod = '';
  let settings: SettingsPayload | null = null;
  let lastAutoRaidFocusTriggerAt = 0;
  let isAutoRaidFocusUpdateInFlight = false;
  let visibleRosterIds: string[] = [];
  let rosterNamesById: Record<string, string> = {};
  let rosterCardsCache: Record<string, WeeklyCardSnapshot> = {};
  let weeklyCards: WeeklyCardSnapshot[] = [];
  let apiReadyStatus: 'pending' | 'ready' | 'timeout' | 'error' = 'pending';
  let lastComputedCardsCount = 0;
  let debugSnapshot: Record<string, unknown> = {
    stage: 'init',
    timestamp: new Date().toISOString(),
  };
  let weeklyConfirmAction: WeeklyConfirmAction = null;
  let weeklyConfirmCancelButton: HTMLButtonElement | null = null;
  let weeklyConfirmConfirmButton: HTMLButtonElement | null = null;
  let weeklyConfirmReturnFocusEl: HTMLElement | null = null;

  $: weeklyConfirmOpen = weeklyConfirmAction !== null;
  $: weeklyConfirmTitle = weeklyConfirmAction === 'reset-weekly' ? 'Reset weekly data' : '';
  $: weeklyConfirmMessage = weeklyConfirmAction === 'reset-weekly'
    ? 'Reset weekly and daily progress for all visible characters in the active roster?'
    : '';
  async function openWeeklyConfirm(action: Exclude<WeeklyConfirmAction, null>) {
    weeklyConfirmReturnFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    weeklyConfirmAction = action;
    await tick();
    weeklyConfirmConfirmButton?.focus();
  }

  function closeWeeklyConfirm() {
    weeklyConfirmAction = null;
    const returnFocusEl = weeklyConfirmReturnFocusEl;
    weeklyConfirmReturnFocusEl = null;
    if (returnFocusEl && typeof returnFocusEl.focus === 'function') {
      returnFocusEl.focus();
    }
  }

  function onWeeklyConfirmOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeWeeklyConfirm();
    }
  }

  function onWeeklyConfirmOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeWeeklyConfirm();
      return;
    }

    if (event.key === 'Tab') {
      const focusables = [weeklyConfirmCancelButton, weeklyConfirmConfirmButton].filter(Boolean) as HTMLButtonElement[];
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

  async function confirmWeeklyAction() {
    if (weeklyConfirmAction !== 'reset-weekly') {
      return;
    }
    await resetWeekly();
    closeWeeklyConfirm();
  }


  const columnEntries = [
    ...RAID_CONFIG.map((raid) => ({
      id: String(raid.id),
      label: String(raid.label || raid.id),
      subtitle: `iLvl ${raid.nm} NM / ${raid.hm} HM`,
    })),
    { id: 'gold', label: 'Gold', subtitle: 'Show gold totals column' },
    { id: 'guardianRaid', label: 'Guardian Raid', subtitle: 'Daily checkbox' },
    { id: 'chaosDungeon', label: 'Chaos Dungeon', subtitle: 'Daily checkbox' },
  ];
  const VALID_COLUMN_IDS = new Set(columnEntries.map((entry) => entry.id));

  $: visibleCharacters = getVisibleCharacters(roster, order);
  $: hiddenSet = new Set(hiddenColumns);
  $: visibleBosses = BOSSES.filter((boss) => {
    const raidId = String(getRaidConfigByBoss(boss)?.id || boss).toLowerCase();
    return !hiddenSet.has(raidId);
  });
  $: showGoldColumn = !hiddenSet.has('gold');
  $: showGuardianColumn = !hiddenSet.has('guardianRaid');
  $: showChaosColumn = !hiddenSet.has('chaosDungeon');
  $: totalColumnsCount = 1 + visibleBosses.length + (showGoldColumn ? 1 : 0) + (showGuardianColumn ? 1 : 0) + (showChaosColumn ? 1 : 0);
  $: goldByCharacter = computeGoldByCharacter(visibleCharacters, characterData, visibleBosses);
  $: totalGold = Object.values(goldByCharacter).reduce((sum, value) => sum + value, 0);
  $: weeklyCards = buildWeeklyCardsFromState(
    activeRosterId,
    visibleRosterIds,
    rosterNamesById,
    rosterCardsCache,
    roster,
    order,
    characterData,
    dailyData,
    hiddenColumns
  );
  $: debugWeeklyState('reactive-state');

  function debugWeekly(step: string, payload?: Record<string, unknown>) {
    if (!WEEKLY_DEBUG_ENABLED) {
      return;
    }

    const info = payload || {};
    console.log(`[WeeklyDebug] ${step}`, info);
    void api.logDebug?.(`[WeeklyDebug] ${step}`, info);
  }

  function updateDebugSnapshot(stage: string, extra: Record<string, unknown> = {}) {
    debugSnapshot = {
      stage,
      timestamp: new Date().toISOString(),
      apiReadyStatus,
      loading,
      activeRosterId,
      visibleRosterIds: [...visibleRosterIds],
      weeklyCardsCount: weeklyCards.length,
      lastComputedCardsCount,
      rosterKeyCount: Object.keys(roster || {}).filter((name) => name !== 'dailyData').length,
      orderCount: order.length,
      hiddenColumns: [...hiddenColumns],
      ...extra,
    };

    (window as Window & { __WTL_weeklyDebug?: Record<string, unknown> }).__WTL_weeklyDebug = debugSnapshot;
  }

  async function copyWeeklyDebugSnapshot() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugSnapshot, null, 2));
      showToast('Weekly debug copied to clipboard', TOAST_TYPES.SUCCESS);
    } catch (error) {
      await reportError(error, {
        code: ERROR_CODES.WEEKLY.DEBUG_COPY_FAILED,
        severity: 'warning',
        context: {
          phase: 'copyWeeklyDebugSnapshot',
          action: 'copy-weekly-debug-snapshot',
          rosterId: activeRosterId,
        },
        showToast: false,
      });
      showToast('Failed to copy weekly debug snapshot', TOAST_TYPES.ERROR);
    }
  }

  function debugWeeklyState(step: string) {
    if (!WEEKLY_DEBUG_ENABLED) {
      return;
    }

    const rosterNames = Object.keys(roster || {}).filter((name) => name !== 'dailyData');
    const signature = JSON.stringify({
      activeRosterId,
      rosterCount: rosterNames.length,
      orderCount: order.length,
      visibleCount: visibleCharacters.length,
    });

    if (signature === lastDebugSignature) {
      return;
    }

    lastDebugSignature = signature;
    debugWeekly(step, {
      activeRosterId,
      rosterNames,
      order,
      visibleCharacters,
    });
  }

  async function waitForApiReadyWithTimeout() {
    updateDebugSnapshot('api-ready:waiting');
    try {
      await Promise.race([
        window.__API_READY__,
        new Promise<void>((resolve) => {
          window.setTimeout(() => {
            apiReadyStatus = 'timeout';
            resolve();
          }, API_READY_TIMEOUT_MS);
        }),
      ]);

      if (apiReadyStatus !== 'timeout') {
        apiReadyStatus = 'ready';
        updateDebugSnapshot('api-ready:resolved');
      } else {
        await reportError(new Error('Timed out waiting for __API_READY__'), {
          code: ERROR_CODES.WEEKLY.API_READY_TIMEOUT,
          severity: 'warning',
          context: { timeoutMs: API_READY_TIMEOUT_MS },
          showToast: true,
        });
        updateDebugSnapshot('api-ready:timeout');
      }
    } catch (error) {
      apiReadyStatus = 'error';
      await reportError(error, {
        code: ERROR_CODES.WEEKLY.API_READY_FAILED,
        severity: 'error',
        context: {
          phase: 'waitForApiReadyWithTimeout',
          action: 'wait-api-ready',
          timeoutMs: API_READY_TIMEOUT_MS,
        },
        showToast: false,
      });
      updateDebugSnapshot('api-ready:error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  onMount(async () => {
    debugWeekly('onMount:start');
    await waitForApiReadyWithTimeout();
    debugWeekly('onMount:api-ready', { apiReadyStatus });
    await loadAll();
    startTimer();

    let isInitialRosterSync = true;
    unsubscribeRosterChanges = rosterChangeVersion.subscribe(() => {
      if (isInitialRosterSync) {
        isInitialRosterSync = false;
        return;
      }
      debugWeekly('sync:rosterChangeVersion');
      handleRosterChanged();
    });

    let isInitialVisibleRosterSync = true;
    unsubscribeVisibleRosterChanges = visibleRostersChangeVersion.subscribe(() => {
      if (isInitialVisibleRosterSync) {
        isInitialVisibleRosterSync = false;
        return;
      }
      debugWeekly('sync:visibleRostersChangeVersion');
      handleRosterChanged();
    });

    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleGlobalKeydown);
    document.addEventListener('visibilitychange', handleVisibilityChangeForAutoRaid);
    document.addEventListener('settingsChanged', handleSettingsChanged as EventListener);
  });

  onDestroy(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    unsubscribeRosterChanges?.();
    unsubscribeRosterChanges = null;
    unsubscribeVisibleRosterChanges?.();
    unsubscribeVisibleRosterChanges = null;
    document.removeEventListener('click', handleGlobalClick);
    document.removeEventListener('keydown', handleGlobalKeydown);
    document.removeEventListener('visibilitychange', handleVisibilityChangeForAutoRaid);
    document.removeEventListener('settingsChanged', handleSettingsChanged as EventListener);
  });

  function handleGlobalClick(event: MouseEvent) {
    if (!goldPopoverCharacter) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.gold-cell')) return;
    goldPopoverCharacter = null;
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      goldPopoverCharacter = null;
      columnSettingsOpen = false;
    }
  }

  function showToast(message: string, type = TOAST_TYPES.INFO) {
    ui.showToast(message, type);
  }

  async function refreshSettingsSnapshot() {
    try {
      const loaded = await api.loadSettings?.();
      if (loaded && typeof loaded === 'object') {
        settings = {
          ...(settings || {}),
          ...(loaded as SettingsPayload),
        } as SettingsPayload;
      }
    } catch (error) {
      await reportError(error, {
        code: ERROR_CODES.WEEKLY.SETTINGS_REFRESH_FAILED,
        severity: 'warning',
        context: {
          phase: 'refreshSettingsSnapshot',
          action: 'refresh-settings-snapshot',
          rosterId: activeRosterId,
        },
        showToast: false,
      });
    }
  }

  function handleSettingsChanged(event: Event) {
    const customEvent = event as CustomEvent<{ settings?: SettingsPayload }>;
    const nextSettings = customEvent?.detail?.settings;
    if (nextSettings && typeof nextSettings === 'object') {
      const previousVisibleLegacy = Array.isArray(settings?.visibleWeeklyRosters)
        ? [...(settings?.visibleWeeklyRosters as string[])]
        : [];
      const previousVisibleByRoster = JSON.stringify(settings?.visibleWeeklyRostersByRoster || {});

      settings = {
        ...(settings || {}),
        ...nextSettings,
      } as SettingsPayload;

      const nextVisibleLegacy = Array.isArray(settings?.visibleWeeklyRosters)
        ? [...(settings?.visibleWeeklyRosters as string[])]
        : [];
      const nextVisibleByRoster = JSON.stringify(settings?.visibleWeeklyRostersByRoster || {});

      if (
        previousVisibleByRoster !== nextVisibleByRoster ||
        JSON.stringify(previousVisibleLegacy) !== JSON.stringify(nextVisibleLegacy)
      ) {
        void loadAll();
      }

      return;
    }

    void refreshSettingsSnapshot();
  }

  function isAutoRaidOnFocusEnabled() {
    if (!settings) return false;

    const rawValue = (settings as Record<string, unknown>).autoRaidUpdateOnFocus;
    if (rawValue === true || rawValue === 'true' || rawValue === 1) {
      return true;
    }

    if (rawValue === false || rawValue === 'false' || rawValue === 0) {
      return false;
    }

    return false;
  }

  async function triggerAutoRaidFocusUpdate() {
    if (!isAutoRaidOnFocusEnabled()) {
      return;
    }

    if (isAutoRaidFocusUpdateInFlight) {
      return;
    }

    if (loading) {
      return;
    }

    const now = Date.now();
    if ((now - lastAutoRaidFocusTriggerAt) < AUTO_RAID_FOCUS_DEDUP_MS) {
      return;
    }

    lastAutoRaidFocusTriggerAt = now;
    isAutoRaidFocusUpdateInFlight = true;

    try {
      await loadFromDatabase({ silent: true, overlay: false });
    } finally {
      isAutoRaidFocusUpdateInFlight = false;
    }
  }

  async function handleVisibilityChangeForAutoRaid() {
    if (document.visibilityState !== 'visible') {
      return;
    }

    await refreshSettingsSnapshot();

    await triggerAutoRaidFocusUpdate();
  }

  function sanitizeHiddenColumns(values: unknown): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    const normalized = values
      .map((entry) => String(entry || '').trim())
      .filter((entry) => Boolean(entry) && VALID_COLUMN_IDS.has(entry));

    return Array.from(new Set(normalized));
  }

  function getHiddenColumnsForRoster(settings: SettingsPayload | null | undefined, rosterId: string) {
    const safeSettings: Partial<SettingsPayload> = settings ?? {};
    const byRoster = (safeSettings.hiddenColumnsByRoster || {}) as Record<string, string[]>;

    if (rosterId && Array.isArray(byRoster[rosterId])) {
      return sanitizeHiddenColumns(byRoster[rosterId]);
    }

    if (Array.isArray(safeSettings.hiddenColumns)) {
      return sanitizeHiddenColumns(safeSettings.hiddenColumns);
    }

    if (Array.isArray(safeSettings.hiddenBossColumns)) {
      return sanitizeHiddenColumns(safeSettings.hiddenBossColumns);
    }

    return [];
  }

  function getVisibleRosterIdsForActive(
    safeSettings: SettingsPayload | null | undefined,
    activeId: string,
    rosterIds: string[]
  ) {
    const settingsNow: Partial<SettingsPayload> = safeSettings ?? {};
    const byRoster = (settingsNow.visibleWeeklyRostersByRoster || {}) as Record<string, string[]>;
    const legacy = Array.isArray(settingsNow.visibleWeeklyRosters) ? settingsNow.visibleWeeklyRosters : [];
    const hasEntry = Boolean(activeId) && Object.prototype.hasOwnProperty.call(byRoster, activeId);

    const selected = hasEntry
      ? (Array.isArray(byRoster[activeId]) ? byRoster[activeId] : [])
      : (legacy.length > 0 ? legacy : rosterIds);

    const selectedSet = new Set((selected || []).map((id: unknown) => String(id)).filter((id: string) => rosterIds.includes(id)));
    if (activeId) {
      selectedSet.add(activeId);
    }

    return rosterIds.filter((id) => selectedSet.has(id));
  }

  function buildWeeklyCardsFromState(
    activeRosterIdState: string,
    visibleRosterIdsState: string[],
    rosterNamesByIdState: Record<string, string>,
    rosterCardsCacheState: Record<string, WeeklyCardSnapshot>,
    rosterState: Record<string, RosterCharacter | unknown>,
    orderState: string[],
    characterDataState: CharacterDataMap,
    dailyDataState: DailyData | null,
    hiddenColumnsState: string[]
  ) {
    const cards: WeeklyCardSnapshot[] = [];

    const normalizedActiveRosterId = String(activeRosterIdState || '').trim();
    const normalizedVisibleRosterIds = Array.from(
      new Set((visibleRosterIdsState || []).map((id) => String(id || '').trim()).filter((id) => Boolean(id)))
    );

    if (normalizedActiveRosterId && !normalizedVisibleRosterIds.includes(normalizedActiveRosterId)) {
      normalizedVisibleRosterIds.unshift(normalizedActiveRosterId);
    }

    normalizedVisibleRosterIds.forEach((rosterId) => {
      if (rosterId === normalizedActiveRosterId) {
        cards.push({
          rosterId,
          rosterName: rosterNamesByIdState[rosterId] || 'Weekly Tracker',
          roster: rosterState,
          order: orderState,
          characterData: characterDataState,
          dailyData: dailyDataState,
          hiddenColumns: hiddenColumnsState,
          isActive: true,
        });
        return;
      }

      const cached = rosterCardsCacheState[rosterId];
      if (!cached) return;

      cards.push({
        ...cached,
        rosterName: rosterNamesByIdState[rosterId] || cached.rosterName || 'Weekly Tracker',
        isActive: false,
      });
    });

    const hasActiveCard = cards.some((card) => card.isActive);
    if (!hasActiveCard && normalizedActiveRosterId) {
      cards.unshift({
        rosterId: normalizedActiveRosterId,
        rosterName: rosterNamesByIdState[normalizedActiveRosterId] || 'Weekly Tracker',
        roster: rosterState,
        order: orderState,
        characterData: characterDataState,
        dailyData: dailyDataState,
        hiddenColumns: hiddenColumnsState,
        isActive: true,
      });
    }

    return cards;
  }

  async function ensureActiveRosterId() {
    const current = await api.getActiveRoster?.();
    const currentId = String(current || '').trim();
    debugWeekly('ensureActiveRosterId:read-active', { currentId });

    if (currentId) {
      activeRosterId = currentId;
      debugWeekly('ensureActiveRosterId:using-active', { activeRosterId });
      return activeRosterId;
    }

    const rosterList = await api.getRosterList?.();
    debugWeekly('ensureActiveRosterId:roster-list', {
      rosterCount: Array.isArray(rosterList) ? rosterList.length : 0,
      rosterIds: Array.isArray(rosterList) ? rosterList.map((entry) => String(entry?.id || '')) : [],
    });
    if (Array.isArray(rosterList) && rosterList.length > 0) {
      const fallbackId = String(rosterList[0]?.id || '').trim();
      if (fallbackId) {
        await api.switchActiveRoster?.(fallbackId);
        activeRosterId = fallbackId;
        debugWeekly('ensureActiveRosterId:switched-fallback', { activeRosterId });
        return activeRosterId;
      }
    }

    const created = await api.createRoster?.('Main Roster');
    if (created) {
      await api.switchActiveRoster?.(created);
      activeRosterId = created;
      debugWeekly('ensureActiveRosterId:created-main', { activeRosterId });
      return activeRosterId;
    }

    debugWeekly('ensureActiveRosterId:failed-empty');
    return '';
  }

  function handleRosterChanged() {
    debugWeekly('handleRosterChanged:reload');
    loadAll();
  }

  function getCharacter(name: string) {
    const value = roster[name] as RosterCharacter | undefined;
    if (!value || typeof value !== 'object') return null;

    const source = value as Record<string, unknown>;
    const candidate = source.data && typeof source.data === 'object'
      ? (source.data as Record<string, unknown>)
      : source;

    const rawVisible = candidate.visible ?? source.visible;
    const rawCombatPower = candidate.combatPower ?? candidate.cp ?? source.combatPower;

    return {
      class: String(candidate.class ?? candidate.charClass ?? candidate.characterClass ?? ''),
      ilvl: Number(candidate.ilvl ?? candidate.itemLevel ?? candidate.iLvl ?? 0),
      visible: rawVisible !== false,
      combatPower: Number.isFinite(Number(rawCombatPower)) && Number(rawCombatPower) > 0 ? Number(rawCombatPower) : null,
    };
  }

  function getCharacterFromRoster(rosterState: Record<string, RosterCharacter | unknown>, name: string) {
    const value = rosterState[name] as RosterCharacter | undefined;
    if (!value || typeof value !== 'object') return null;

    const source = value as Record<string, unknown>;
    const candidate = source.data && typeof source.data === 'object'
      ? (source.data as Record<string, unknown>)
      : source;

    const rawVisible = candidate.visible ?? source.visible;
    const rawCombatPower = candidate.combatPower ?? candidate.cp ?? source.combatPower;

    return {
      class: String(candidate.class ?? candidate.charClass ?? candidate.characterClass ?? ''),
      ilvl: Number(candidate.ilvl ?? candidate.itemLevel ?? candidate.iLvl ?? 0),
      visible: rawVisible !== false,
      combatPower: Number.isFinite(Number(rawCombatPower)) && Number(rawCombatPower) > 0 ? Number(rawCombatPower) : null,
    };
  }

  function getClassIconPath(className: string) {
    const icon = (CLASS_ICONS as Record<string, string>)[className];
    return icon ? `./assets/icons/${icon}` : null;
  }

  function getCharacterNames() {
    return Object.keys(roster).filter((name) => name !== 'dailyData');
  }

  function getVisibleCharacters(
    rosterState: Record<string, RosterCharacter | unknown>,
    orderState: string[]
  ) {
    const names = Object.keys(rosterState).filter((name) => name !== 'dailyData');
    const normalizedOrder = orderState.filter((name) => names.includes(name));
    const missing = names.filter((name) => !normalizedOrder.includes(name));
    const all = [...normalizedOrder, ...missing];

    const visible = all.filter((name) => getCharacter(name)?.visible !== false);

    if (visible.length === 0 && all.length > 0) {
      debugWeekly('getVisibleCharacters:all-filtered-out', {
        all,
        sampleEntries: all.map((name) => {
          const raw = roster[name] as unknown;
          return {
            name,
            rawType: typeof raw,
            hasRaw: raw !== undefined && raw !== null,
            parsed: getCharacter(name),
          };
        }),
      });
    }

    if (visible.length === 0 && all.length > 0) {
      debugWeekly('getVisibleCharacters:fallback-all', {
        names: all,
        visibilityByName: all.map((name) => ({
          name,
          visible: getCharacter(name)?.visible,
        })),
      });
      return all;
    }

    return visible;
  }

  function getVisibleCharactersForRoster(
    rosterState: Record<string, RosterCharacter | unknown>,
    orderState: string[]
  ) {
    const names = Object.keys(rosterState || {}).filter((name) => name !== 'dailyData');
    const normalizedOrder = (orderState || []).filter((name) => names.includes(name));
    const missing = names.filter((name) => !normalizedOrder.includes(name));
    const all = [...normalizedOrder, ...missing];
    const visible = all.filter((name) => getCharacterFromRoster(rosterState, name)?.visible !== false);
    return visible.length === 0 ? all : visible;
  }

  function normalizeDifficulty(value: unknown): Difficulty {
    const safe = String(value || '').trim();
    if (safe === 'Normal' || safe === 'Hard') return safe;
    return 'Solo';
  }

  function normalizeRaidBossId(boss: string) {
    const safeBoss = String(boss || '').trim().toLowerCase();
    if (!safeBoss) return '';

    const directById = RAID_CONFIG.find((entry: any) => String(entry.id || '').toLowerCase() === safeBoss);
    if (directById) return String((directById as any).id || '');

    const directByLabel = RAID_CONFIG.find((entry: any) => String(entry.label || '').trim().toLowerCase() === safeBoss);
    if (directByLabel) return String((directByLabel as any).id || '');

    const softByLabel = RAID_CONFIG.find((entry: any) => {
      const label = String(entry.label || '').toLowerCase();
      const id = String(entry.id || '').toLowerCase();
      return label.includes(safeBoss) || safeBoss.includes(id);
    });
    if (softByLabel) return String((softByLabel as any).id || '');

    return '';
  }

  function getBossLookupKeys(boss: string) {
    const normalizedId = normalizeRaidBossId(boss);
    const keys = new Set<string>();

    const raw = String(boss || '').trim();
    if (raw) keys.add(raw);
    if (normalizedId) keys.add(normalizedId);

    const legacySimple = BOSSES.find((item) => normalizeRaidBossId(item) === normalizedId);
    if (legacySimple) keys.add(String(legacySimple));

    return Array.from(keys);
  }

  function getRaidCell(characterDataState: CharacterDataMap, characterName: string, boss: string): RaidCell {
    const lookupKeys = getBossLookupKeys(boss);
    let cell: unknown = undefined;

    for (const key of lookupKeys) {
      const candidate = characterDataState?.[characterName]?.[key];
      if (candidate && typeof candidate === 'object') {
        cell = candidate;
        break;
      }
    }

    if (!cell || typeof cell !== 'object') {
      return { ...DEFAULT_RAID_CELL };
    }

    return {
      cleared: Boolean((cell as RaidCell).cleared),
      difficulty: normalizeDifficulty((cell as RaidCell).difficulty),
      hidden: Boolean((cell as RaidCell).hidden),
      chestOpened: Boolean((cell as RaidCell).chestOpened),
      timestamp: (cell as RaidCell).timestamp || null,
    };
  }

  function ensureCharacterData(characterName: string) {
    if (!characterData[characterName]) {
      characterData[characterName] = {} as CharacterBossData;
    }
  }

  function getRaidConfigByBoss(boss: string) {
    const normalizedId = normalizeRaidBossId(boss);
    if (!normalizedId) return undefined;
    return RAID_CONFIG.find((entry: any) => String(entry.id || '') === normalizedId);
  }

  function getRaidLabel(boss: string) {
    const raid = getRaidConfigByBoss(boss) as { label?: string } | undefined;
    return String(raid?.label || boss);
  }

  function isEligible(characterName: string, boss: string) {
    const character = getCharacter(characterName);
    const raid = getRaidConfigByBoss(boss);
    if (!character || !raid) return false;
    return character.ilvl >= Number(raid.nm || 0);
  }

  function isEligibleForRoster(
    rosterState: Record<string, RosterCharacter | unknown>,
    characterName: string,
    boss: string
  ) {
    const character = getCharacterFromRoster(rosterState, characterName);
    const raid = getRaidConfigByBoss(boss);
    if (!character || !raid) return false;
    return character.ilvl >= Number(raid.nm || 0);
  }

  function disallowSoloForBoss(boss: string) {
    const raid = getRaidConfigByBoss(boss) as { id?: string } | undefined;
    const raidId = String(raid?.id || normalizeRaidBossId(boss) || '').toLowerCase();
    return raidId === 'armoche' || raidId === 'kazeros';
  }

  function getAllowedDifficulties(characterName: string, boss: string): Difficulty[] {
    const character = getCharacter(characterName);
    const raid = getRaidConfigByBoss(boss);
    const soloDisabled = disallowSoloForBoss(boss);

    if (!character || !raid) {
      return soloDisabled ? ['Normal'] : ['Solo', 'Normal'];
    }

    if (character.ilvl >= Number(raid.hm || 9999)) {
      return soloDisabled ? ['Normal', 'Hard'] : ['Solo', 'Normal', 'Hard'];
    }

    return soloDisabled ? ['Normal'] : ['Solo', 'Normal'];
  }

  function getNextDifficulty(characterName: string, boss: string, current: Difficulty): Difficulty {
    const allowed = getAllowedDifficulties(characterName, boss);
    const index = allowed.indexOf(current);
    if (index < 0) return allowed[0];
    return allowed[(index + 1) % allowed.length];
  }

  async function persistCharacterData() {
    if (!activeRosterId) return;
    await api.saveCharacterData?.(activeRosterId, characterData);
  }

  async function persistRoster() {
    if (!activeRosterId) return;
    await api.saveRoster?.(activeRosterId, { roster, order });
  }

  function getCurrentDailyStartIso() {
    return getCurrentDailyPeriod().startIso;
  }

  function getCurrentDailyPeriod(now = new Date()): DailyPeriod {
    const start = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      DAILY_RESET.HOUR_UTC,
      0,
      0,
      0,
    ));

    if (now.getUTCHours() < DAILY_RESET.HOUR_UTC) {
      start.setUTCDate(start.getUTCDate() - 1);
    }

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return {
      start,
      end,
      startIso: start.toISOString(),
    };
  }

  function isDailyDataExpired(savedDate: unknown, period: DailyPeriod) {
    if (!savedDate) return true;
    const parsed = new Date(String(savedDate));
    if (Number.isNaN(parsed.getTime())) return true;
    return parsed < period.start || parsed >= period.end;
  }

  function getRosterCharacterNames(rosterState: Record<string, unknown>, orderState: string[]) {
    const names = Object.keys(rosterState || {}).filter((name) => name !== 'dailyData');
    const normalizedOrder = (orderState || [])
      .map((name) => String(name || '').trim())
      .filter((name) => Boolean(name) && names.includes(name));
    const missing = names.filter((name) => !normalizedOrder.includes(name));
    return [...normalizedOrder, ...missing];
  }

  function buildResetDailyData(characterNames: string[], period: DailyPeriod): DailyData {
    return {
      date: period.startIso,
      characters: Object.fromEntries(
        characterNames.map((name) => [
          name,
          {
            guardianRaid: defaultActivity(),
            chaosDungeon: defaultActivity(),
          },
        ])
      ),
      roster: {
        fieldBoss: defaultActivity(),
        chaosGate: defaultActivity(),
      },
    };
  }

  async function resetExpiredDailiesForAllRosters(period: DailyPeriod) {
    const rosterList = await api.getRosterList?.();
    if (!Array.isArray(rosterList) || rosterList.length === 0) {
      return;
    }

    for (const rosterMeta of rosterList) {
      const rosterId = String(rosterMeta?.id || '').trim();
      if (!rosterId) continue;

      const loaded = await api.loadRoster?.(rosterId);
      const rosterData = (loaded?.roster || {}) as Record<string, unknown>;
      const orderData = Array.isArray(loaded?.order) ? loaded.order : [];

      const savedDailyDate = (rosterData?.dailyData as DailyData | undefined)?.date;
      if (!isDailyDataExpired(savedDailyDate, period)) {
        continue;
      }

      const characterNames = getRosterCharacterNames(rosterData, orderData);
      const resetDailyData = buildResetDailyData(characterNames, period);

      await api.saveRoster?.(rosterId, {
        roster: {
          ...rosterData,
          dailyData: resetDailyData,
        },
        order: orderData,
      });
    }
  }

  async function ensureDailyResetParity() {
    const period = getCurrentDailyPeriod();
    if (dailyResetCheckedForPeriod === period.startIso) {
      return;
    }

    await resetExpiredDailiesForAllRosters(period);
    dailyResetCheckedForPeriod = period.startIso;
  }

  function defaultActivity(overrides?: Partial<DailyActivity>): DailyActivity {
    return {
      completed: false,
      boss: null,
      timestamp: null,
      ...(overrides || {}),
    };
  }

  function normalizeApiActivity(result: unknown, fallbackBoss: string | null = null): DailyActivity {
    if (typeof result === 'boolean') {
      return defaultActivity({
        completed: result,
        boss: result ? fallbackBoss : null,
        timestamp: result ? new Date().toISOString() : null,
      });
    }

    if (!result || typeof result !== 'object') {
      return defaultActivity();
    }

    const source = result as Record<string, unknown>;
    const completed = Boolean(source.completed);
    const rawTimestamp = source.timestamp;
    const timestamp = rawTimestamp ? new Date(rawTimestamp as string | number).toISOString() : (completed ? new Date().toISOString() : null);
    const boss = String(source.boss || '').trim() || (completed ? fallbackBoss : null);

    return defaultActivity({
      completed,
      boss,
      timestamp,
    });
  }

  function formatTimestamp(timestamp: string | null) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';

    const timezone = settings?.timezone && settings.timezone !== 'browser' && settings.timezone !== 'local'
      ? settings.timezone
      : undefined;
    const locale = navigator?.language || 'en-US';
    const hour12 = settings?.timeFormat === '12h'
      ? true
      : settings?.timeFormat === '24h'
        ? false
        : undefined;

    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    }).format(date);
  }

  function buildDailyTooltip(activity: DailyActivity | null | undefined) {
    if (!activity?.timestamp) return '';
    const dateText = formatTimestamp(activity.timestamp);
    const bossText = activity.boss ? ` - ${activity.boss}` : '';
    return `${dateText}${bossText}`;
  }

  function preserveHiddenStates(source: CharacterDataMap) {
    const hiddenStates: Record<string, Record<string, true>> = {};

    Object.keys(source || {}).forEach((characterName) => {
      const entry = source[characterName];
      if (!entry || typeof entry !== 'object') return;
      Object.keys(entry).forEach((boss) => {
        if (boss === '_extraGold') return;
        const cell = (entry as Record<string, unknown>)[boss] as RaidCell | undefined;
        if (cell?.hidden) {
          if (!hiddenStates[characterName]) {
            hiddenStates[characterName] = {};
          }
          hiddenStates[characterName][boss] = true;
        }
      });
    });

    return hiddenStates;
  }

  function restoreHiddenStates(target: CharacterDataMap, hiddenStates: Record<string, Record<string, true>>) {
    Object.keys(hiddenStates || {}).forEach((characterName) => {
      if (!target[characterName]) {
        target[characterName] = {} as CharacterBossData;
      }

      Object.keys(hiddenStates[characterName] || {}).forEach((boss) => {
        const current = getRaidCell(target, characterName, boss);
        target[characterName][boss] = {
          ...current,
          hidden: true,
        };
      });
    });
  }

  function buildDefaultDailyDataForRoster() {
    return {
      date: getCurrentDailyStartIso(),
      characters: Object.fromEntries(
        getCharacterNames().map((name) => [
          name,
          {
            guardianRaid: defaultActivity(),
            chaosDungeon: defaultActivity(),
          },
        ])
      ),
      roster: {
        fieldBoss: defaultActivity(),
        chaosGate: defaultActivity(),
      },
    } satisfies DailyData;
  }

  async function ensureDatabaseReady(silent = false) {
    let hasDb = await api.checkDatabaseExists?.();
    if (hasDb) {
      return true;
    }

    if (!silent && api.requestDatabasePermission) {
      const permResult = await api.requestDatabasePermission();

      if (permResult?.ok) {
        hasDb = await api.checkDatabaseExists?.();
        if (hasDb) return true;
      } else if (permResult?.reason === 'permission-denied') {
        showToast('Browser permission denied. Grant access and try again.', TOAST_TYPES.ERROR);
        return false;
      }
    }

    if (!silent) {
      showToast('No database loaded. Set encounters.db in Settings first.', TOAST_TYPES.ERROR);
    }

    return false;
  }

  function normalizeDailyData() {
    const raw = (roster.dailyData as DailyData | undefined) || null;
    const date = raw?.date || getCurrentDailyStartIso();

    const characters = Object.fromEntries(
      getCharacterNames().map((name) => {
        const entry = raw?.characters?.[name];
        return [
          name,
          {
            guardianRaid: defaultActivity(entry?.guardianRaid),
            chaosDungeon: defaultActivity(entry?.chaosDungeon),
          },
        ];
      })
    );

    const rosterDaily = {
      fieldBoss: defaultActivity(raw?.roster?.fieldBoss),
      chaosGate: defaultActivity(raw?.roster?.chaosGate),
    };

    dailyData = {
      date,
      characters,
      roster: rosterDaily,
    };

    roster = {
      ...roster,
      dailyData,
    };
  }

  async function loadAll() {
    loading = true;
    updateDebugSnapshot('loadAll:start');
    debugWeekly('loadAll:start');
    try {
      await ensureDailyResetParity();

      const rosterId = await ensureActiveRosterId();
      if (!rosterId) {
        updateDebugSnapshot('loadAll:no-active-roster');
        showToast('No active roster selected', TOAST_TYPES.ERROR);
        debugWeekly('loadAll:no-active-roster');
        return;
      }

      activeRosterId = rosterId;
      const [loadedRoster, loadedCharacterData, loadedSettings, loadedRosterMeta] = await Promise.all([
        api.loadRoster?.(rosterId),
        api.loadCharacterData?.(rosterId),
        api.loadSettings?.(),
        api.getRosterList?.(),
      ]);
      debugWeekly('loadAll:payload-loaded', {
        rosterId,
        loadedRosterKeys: Object.keys((loadedRoster?.roster || {}) as Record<string, unknown>),
        loadedOrder: Array.isArray(loadedRoster?.order) ? loadedRoster.order : [],
        characterDataKeys: Object.keys((loadedCharacterData || {}) as Record<string, unknown>),
      });

      roster = (loadedRoster?.roster || {}) as Record<string, RosterCharacter | unknown>;

      const rosterNames = Object.keys(roster).filter((name) => name !== 'dailyData');
      const loadedOrder = Array.isArray(loadedRoster?.order)
        ? loadedRoster.order.map((name: unknown) => String(name || '').trim()).filter((name: string) => Boolean(name) && rosterNames.includes(name))
        : [];
      const missingNames = rosterNames.filter((name) => !loadedOrder.includes(name));
      order = [...loadedOrder, ...missingNames];
      debugWeekly('loadAll:order-normalized', {
        rosterId,
        rosterNames,
        loadedOrder,
        missingNames,
        finalOrder: order,
      });

      characterData = (loadedCharacterData || {}) as CharacterDataMap;
      settings = (loadedSettings || {}) as SettingsPayload;
      hiddenColumns = getHiddenColumnsForRoster(settings, rosterId);
      const rosterMeta = Array.isArray(loadedRosterMeta) ? loadedRosterMeta : [];
      const allRosterIdsFromMeta = rosterMeta
        .map((item) => String(item?.id || '').trim())
        .filter((id) => Boolean(id));
      const allRosterIds = Array.from(new Set([
        ...allRosterIdsFromMeta,
        rosterId,
      ]));
      rosterNamesById = Object.fromEntries(
        rosterMeta
          .map((item) => [String(item?.id || '').trim(), String(item?.name || '').trim() || 'Weekly Tracker'])
          .filter(([id]) => Boolean(id))
      );
      rosterNamesById = {
        [rosterId]: rosterNamesById[rosterId] || 'Weekly Tracker',
        ...rosterNamesById,
      };
      visibleRosterIds = getVisibleRosterIdsForActive(settings, rosterId, allRosterIds);
      if (visibleRosterIds.length === 0) {
        visibleRosterIds = [rosterId];
      }

      const nextCache: Record<string, WeeklyCardSnapshot> = {};
      await Promise.all(
        visibleRosterIds
          .filter((id) => id !== rosterId)
          .map(async (id) => {
            const [rosterPayload, characterPayload] = await Promise.all([
              api.loadRoster?.(id),
              api.loadCharacterData?.(id),
            ]);

            const rosterState = (rosterPayload?.roster || {}) as Record<string, RosterCharacter | unknown>;
            const rosterNamesLocal = Object.keys(rosterState).filter((name) => name !== 'dailyData');
            const rawOrder = Array.isArray(rosterPayload?.order)
              ? rosterPayload.order.map((name: unknown) => String(name || '').trim()).filter((name: string) => Boolean(name) && rosterNamesLocal.includes(name))
              : [];
            const missing = rosterNamesLocal.filter((name) => !rawOrder.includes(name));
            const finalOrder = [...rawOrder, ...missing];

            nextCache[id] = {
              rosterId: id,
              rosterName: rosterNamesById[id] || 'Weekly Tracker',
              roster: rosterState,
              order: finalOrder,
              characterData: (characterPayload || {}) as CharacterDataMap,
              dailyData: ((rosterState.dailyData as DailyData | undefined) || null),
              hiddenColumns: getHiddenColumnsForRoster(settings, id),
              isActive: false,
            };
          })
      );
      rosterCardsCache = nextCache;
      normalizeDailyData();

      const nextCards = buildWeeklyCardsFromState(
        activeRosterId,
        visibleRosterIds,
        rosterNamesById,
        rosterCardsCache,
        roster,
        order,
        characterData,
        dailyData,
        hiddenColumns
      );
      weeklyCards = nextCards;
      lastComputedCardsCount = nextCards.length;
      if (nextCards.length === 0) {
        await reportError(new Error('Weekly cards list is empty after loadAll'), {
          code: ERROR_CODES.WEEKLY.EMPTY_CARDS,
          severity: 'warning',
          context: {
            activeRosterId: rosterId,
            allRosterIds,
            visibleRosterIds,
            rosterNamesCount: Object.keys(rosterNamesById || {}).length,
            rosterKeys: Object.keys(roster || {}).filter((name) => name !== 'dailyData'),
          },
          showToast: true,
        });
      }

      updateDebugSnapshot('loadAll:success', {
        allRosterIds,
        rosterNamesCount: Object.keys(rosterNamesById || {}).length,
        computedCardsCount: nextCards.length,
        activeRosterCardExpected: String(activeRosterId || '').trim(),
      });

      debugWeeklyState('loadAll:completed');
    } catch (error: any) {
      const reported = await reportError(error, {
        code: ERROR_CODES.WEEKLY.LOAD_ALL_FAILED,
        severity: 'error',
        context: {
          action: 'load-all',
          rosterId: activeRosterId,
          activeRosterId,
          visibleRosterIds,
          rosterKeys: Object.keys(roster || {}).filter((name) => name !== 'dailyData'),
          orderCount: Array.isArray(order) ? order.length : 0,
        },
        showToast: false,
      });
      updateDebugSnapshot('loadAll:error', {
        error: error?.message || String(error),
      });
      showToast(reported.message, TOAST_TYPES.ERROR);
      debugWeekly('loadAll:error', {
        message: error?.message || 'unknown error',
      });
    } finally {
      loading = false;
      updateDebugSnapshot('loadAll:finish');
      debugWeekly('loadAll:finish', { loading });
    }
  }

  async function toggleRaid(characterName: string, boss: string, checked: boolean) {
    if (loading || !activeRosterId) {
      showToast('Weekly action blocked: page is loading or no active roster.', TOAST_TYPES.WARNING);
      return;
    }
    if (!isEligible(characterName, boss)) {
      showToast(`Character not eligible for ${getRaidLabel(boss)}.`, TOAST_TYPES.WARNING);
      return;
    }

    ensureCharacterData(characterName);
    const current = getRaidCell(characterData, characterName, boss);
    const allowedDifficulties = getAllowedDifficulties(characterName, boss);
    const nextDifficulty = checked
      ? (allowedDifficulties.includes(current.difficulty) ? current.difficulty : allowedDifficulties[0])
      : current.difficulty;

    characterData[characterName][boss] = {
      ...current,
      cleared: checked,
      difficulty: nextDifficulty,
      timestamp: checked ? new Date().toISOString() : null,
    };
    characterData = {
      ...characterData,
      [characterName]: { ...characterData[characterName] },
    };
    await persistCharacterData();
  }

  async function cycleDifficulty(characterName: string, boss: string) {
    if (loading || !activeRosterId) {
      showToast('Difficulty change blocked: page is loading or no active roster.', TOAST_TYPES.WARNING);
      return;
    }
    if (!isEligible(characterName, boss)) {
      showToast(`Character not eligible for ${getRaidLabel(boss)}.`, TOAST_TYPES.WARNING);
      return;
    }

    ensureCharacterData(characterName);
    const current = getRaidCell(characterData, characterName, boss);
    if (!current.cleared) return;
    characterData[characterName][boss] = {
      ...current,
      difficulty: getNextDifficulty(characterName, boss, current.difficulty),
    };
    characterData = {
      ...characterData,
      [characterName]: { ...characterData[characterName] },
    };
    await persistCharacterData();
  }

  async function toggleChest(characterName: string, boss: string) {
    if (loading || !activeRosterId) {
      showToast('Chest toggle blocked: page is loading or no active roster.', TOAST_TYPES.WARNING);
      return;
    }
    if (!isEligible(characterName, boss)) {
      showToast(`Character not eligible for ${getRaidLabel(boss)}.`, TOAST_TYPES.WARNING);
      return;
    }

    ensureCharacterData(characterName);
    const current = getRaidCell(characterData, characterName, boss);
    characterData[characterName][boss] = {
      ...current,
      chestOpened: !current.chestOpened,
    };
    characterData = {
      ...characterData,
      [characterName]: { ...characterData[characterName] },
    };
    await persistCharacterData();
  }

  async function toggleHidden(characterName: string, boss: string) {
    if (loading || !activeRosterId) {
      showToast('Hide toggle blocked: page is loading or no active roster.', TOAST_TYPES.WARNING);
      return;
    }
    if (!isEligible(characterName, boss)) {
      showToast(`Character not eligible for ${getRaidLabel(boss)}.`, TOAST_TYPES.WARNING);
      return;
    }

    ensureCharacterData(characterName);
    const current = getRaidCell(characterData, characterName, boss);
    characterData[characterName][boss] = {
      ...current,
      hidden: !current.hidden,
    };
    characterData = {
      ...characterData,
      [characterName]: { ...characterData[characterName] },
    };
    await persistCharacterData();
  }

  async function openGoldBonus(characterName: string) {
    goldPopoverCharacter = characterName;
    const currentExtra = Number((characterData?.[characterName] as CharacterBossData)?._extraGold || 0);
    goldBonusInput = String(Math.max(0, Math.floor(currentExtra)));
    await tick();
    goldBonusInputRef?.focus();
    goldBonusInputRef?.select();
  }

  async function applyGoldBonus(characterName: string) {
    if (loading || !activeRosterId) return;
    const parsed = Number(String(goldBonusInput || '0').trim().replace(',', '.'));
    const safeValue = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;

    if (!characterData[characterName]) {
      characterData[characterName] = {} as CharacterBossData;
    }

    (characterData[characterName] as CharacterBossData)._extraGold = safeValue;
    characterData = {
      ...characterData,
      [characterName]: { ...characterData[characterName] },
    };
    await persistCharacterData();
    goldPopoverCharacter = null;
  }

  function startCharacterDrag(event: DragEvent, characterName: string) {
    draggingCharacterName = characterName;
    dragOverCharacterName = null;
    event.dataTransfer?.setData('text/plain', characterName);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function onCharacterDragOver(event: DragEvent, characterName: string) {
    if (!draggingCharacterName || draggingCharacterName === characterName) return;
    event.preventDefault();
    dragOverCharacterName = characterName;
  }

  function endCharacterDrag() {
    draggingCharacterName = null;
    dragOverCharacterName = null;
  }

  function moveCharacterInOrder(currentOrder: string[], draggedName: string, targetName: string) {
    const nextOrder = [...currentOrder];
    const draggedIndex = nextOrder.indexOf(draggedName);
    const targetIndex = nextOrder.indexOf(targetName);

    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
      return nextOrder;
    }

    const [dragged] = nextOrder.splice(draggedIndex, 1);
    nextOrder.splice(targetIndex, 0, dragged);
    return nextOrder;
  }

  async function onCharacterDrop(event: DragEvent, targetName: string) {
    event.preventDefault();
    if (loading || !activeRosterId) {
      endCharacterDrag();
      return;
    }

    const draggedFromTransfer = event.dataTransfer?.getData('text/plain') || '';
    const draggedName = String(draggingCharacterName || draggedFromTransfer || '').trim();
    const safeTarget = String(targetName || '').trim();

    if (!draggedName || !safeTarget || draggedName === safeTarget) {
      endCharacterDrag();
      return;
    }

    const nextOrder = moveCharacterInOrder(order, draggedName, safeTarget);
    const changed = nextOrder.length === order.length && nextOrder.some((name, index) => name !== order[index]);
    if (!changed) {
      endCharacterDrag();
      return;
    }

    order = nextOrder;
    await persistRoster();
    notifyRosterChanged();
    endCharacterDrag();
  }

  async function toggleRosterDaily(key: 'fieldBoss' | 'chaosGate') {
    if (loading || !activeRosterId) return;
    if (!dailyData) return;

    const current = dailyData.roster?.[key] || defaultActivity();
    const nextCompleted = !current.completed;

    dailyData.roster = {
      ...(dailyData.roster || {
        fieldBoss: defaultActivity(),
        chaosGate: defaultActivity(),
      }),
      [key]: defaultActivity({
        completed: nextCompleted,
        boss: nextCompleted ? (key === 'fieldBoss' ? 'Sevek Atun' : 'Chaos Gate') : null,
        timestamp: nextCompleted ? new Date().toISOString() : null,
      }),
    };

    roster = { ...roster, dailyData };
    await persistRoster();
  }

  function openColumnsConfig() {
    if (loading) return;
    const hidden = new Set(hiddenColumns);
    draftVisibleColumns = Object.fromEntries(
      columnEntries.map((entry) => [entry.id, !hidden.has(entry.id)])
    );
    columnSettingsOpen = true;
  }

  function closeColumnsConfig() {
    columnSettingsOpen = false;
  }

  function toggleDraftColumn(columnId: string, checked: boolean) {
    draftVisibleColumns = {
      ...draftVisibleColumns,
      [columnId]: checked,
    };
  }

  async function saveColumnsConfig() {
    if (loading || !activeRosterId) return;
    const nextHidden = columnEntries
      .filter((entry) => !Boolean(draftVisibleColumns[entry.id]))
      .map((entry) => entry.id);

    const loadedSettings = await api.loadSettings?.();
    const safeSettings = (loadedSettings || {}) as SettingsPayload;
    const byRoster = safeSettings.hiddenColumnsByRoster || {};

    const legacyHidden = nextHidden.filter((id) => RAID_CONFIG.some((raid) => raid.id === id));

    const nextSettings: SettingsPayload = {
      ...safeSettings,
      hiddenColumns: nextHidden,
      hiddenBossColumns: legacyHidden,
      hiddenColumnsByRoster: {
        ...byRoster,
        [activeRosterId]: nextHidden,
      },
    };

    await api.saveSettings?.(nextSettings);
    hiddenColumns = nextHidden;
    columnSettingsOpen = false;
    showToast('Columns updated', TOAST_TYPES.SUCCESS);
  }

  function mapDifficultyFromRaid(value: unknown): Difficulty {
    const safe = String(value || '').toLowerCase();
    if (safe.includes('hard')) return 'Hard';
    if (safe.includes('normal')) return 'Normal';
    return 'Solo';
  }

  async function loadFromDatabase(options?: { silent?: boolean; overlay?: boolean }) {
    const silent = Boolean(options?.silent);
    const overlay = options?.overlay !== false;
    if (loading) return;
    if (overlay) loading = true;
    try {
      const hasDb = await ensureDatabaseReady(silent);
      if (!hasDb) {
        return;
      }

      await api.reloadCurrentDatabase?.();

      const raids = await api.getRaids?.();
      if (!Array.isArray(raids)) {
        if (!silent) {
          showToast('No raid data available', TOAST_TYPES.WARNING);
        }
        return;
      }

      const period = await api.getWeeklyResetPeriod?.();
      const resetStart = Number(period?.start || 0);
      const resetEnd = Number(period?.end || 0);

      const next = { ...characterData } as CharacterDataMap;
      let weeklyRowsInWindow = 0;
      let mappedBossRows = 0;
      let matchedCharacterRows = 0;
      let updatedCells = 0;

      raids.forEach((raid: any) => {
        if (!raid?.cleared) return;

        const fightTime = new Date(raid.fight_start).getTime();
        if (resetStart && resetEnd && !(fightTime >= resetStart && fightTime < resetEnd)) {
          return;
        }
        weeklyRowsInWindow += 1;

        const rawBoss = (BOSS_MAP as Record<string, string>)[String(raid.current_boss || '')];
        const boss = normalizeRaidBossId(rawBoss);
        if (!boss) return;
        mappedBossRows += 1;

        const characterName = String(raid.local_player || '');
        const character = getCharacter(characterName);
        if (!character || character.visible === false) return;
        matchedCharacterRows += 1;

        if (!next[characterName]) next[characterName] = {} as CharacterBossData;
        const previous = getRaidCell(characterData, characterName, boss);
        const allowedDifficulties = getAllowedDifficulties(characterName, boss);
        const mappedDifficulty = mapDifficultyFromRaid(raid.difficulty);
        const resolvedDifficulty = allowedDifficulties.includes(mappedDifficulty)
          ? mappedDifficulty
          : allowedDifficulties[0];

        next[characterName][boss] = {
          ...previous,
          cleared: true,
          difficulty: resolvedDifficulty,
          timestamp: raid.fight_start ? String(raid.fight_start) : previous.timestamp,
        };
        updatedCells += 1;
      });

      characterData = next;
      await persistCharacterData();
      await syncDailyFromDatabaseData(false);

      updateDebugSnapshot('loadFromDatabase:summary', {
        totalRows: Array.isArray(raids) ? raids.length : 0,
        weeklyRowsInWindow,
        mappedBossRows,
        matchedCharacterRows,
        updatedCells,
      });

      if (!silent) {
        if (updatedCells > 0) {
          showToast(`Weekly loaded: ${updatedCells} raid entries updated.`, TOAST_TYPES.SUCCESS);
        } else {
          showToast(
            `No raids updated (window=${weeklyRowsInWindow}, bossMapped=${mappedBossRows}, rosterMatch=${matchedCharacterRows}).`,
            TOAST_TYPES.WARNING
          );
        }
      }
    } catch (error: any) {
      const reported = await reportError(error, {
        code: ERROR_CODES.WEEKLY.LOAD_FROM_DB_FAILED,
        severity: 'error',
        context: {
          phase: 'loadFromDatabase',
          action: 'load-weekly-from-database',
          rosterId: activeRosterId,
          activeRosterId,
        },
        showToast: false,
      });
      if (!silent) {
        showToast(reported.message, TOAST_TYPES.ERROR);
      }
    } finally {
      if (overlay) {
        loading = false;
      }
    }
  }

  async function resetWeekly() {
    if (loading || !activeRosterId) return;

    const hiddenStates = preserveHiddenStates(characterData);
    const next = {} as CharacterDataMap;
    restoreHiddenStates(next, hiddenStates);
    characterData = next;

    dailyData = buildDefaultDailyDataForRoster();
    roster = {
      ...roster,
      dailyData,
    };

    await persistCharacterData();
    await persistRoster();
    showToast('Weekly data reset', TOAST_TYPES.SUCCESS);
  }

  async function resetDaily() {
    if (loading || !activeRosterId) return;
    if (!window.confirm('Reset daily data now?')) return;
    dailyData = buildDefaultDailyDataForRoster();

    roster = {
      ...roster,
      dailyData,
    };
    await persistRoster();
    showToast('Daily data reset', TOAST_TYPES.SUCCESS);
  }

  async function toggleCharacterDaily(characterName: string, key: 'guardianRaid' | 'chaosDungeon', checked: boolean) {
    if (loading || !activeRosterId) return;
    if (!dailyData) return;

    dailyData.characters[characterName] = {
      ...(dailyData.characters[characterName] || {
        guardianRaid: defaultActivity(),
        chaosDungeon: defaultActivity(),
      }),
      [key]: defaultActivity({
        completed: checked,
        boss: checked ? (key === 'guardianRaid' ? 'Guardian Raid' : 'Chaos Dungeon') : null,
        timestamp: checked ? new Date().toISOString() : null,
      }),
    };

    roster = { ...roster, dailyData };
    await persistRoster();
  }

  async function syncDailyFromDatabaseData(showSuccessToast = true) {
    if (!dailyData) return;
    if (visibleCharacters.length === 0) return;

    try {
      const hasDb = await ensureDatabaseReady(!showSuccessToast);
      if (!hasDb) {
        return;
      }

      for (const characterName of visibleCharacters) {
        const guardianHit = await api.getDailyGuardianRaids?.(characterName);
        const guardianActivity = normalizeApiActivity(guardianHit, 'Guardian Raid');
        const currentCharacter = dailyData.characters[characterName] || {
          guardianRaid: defaultActivity(),
          chaosDungeon: defaultActivity(),
        };

        dailyData.characters[characterName] = {
          ...currentCharacter,
          guardianRaid: guardianActivity.completed ? guardianActivity : currentCharacter.guardianRaid,
        };
      }

      const rosterNames = [...visibleCharacters];
      const [fieldBossHit, chaosGateHit] = await Promise.all([
        api.getDailyFieldBoss?.(rosterNames),
        api.getDailyChaosGate?.(rosterNames),
      ]);

      const fieldBossActivity = normalizeApiActivity(fieldBossHit, 'Sevek Atun');
      const chaosGateActivity = normalizeApiActivity(chaosGateHit, 'Chaos Gate');
      const currentRosterDaily = dailyData.roster || {
        fieldBoss: defaultActivity(),
        chaosGate: defaultActivity(),
      };

      dailyData.roster = {
        fieldBoss: fieldBossActivity.completed ? fieldBossActivity : currentRosterDaily.fieldBoss,
        chaosGate: chaosGateActivity.completed ? chaosGateActivity : currentRosterDaily.chaosGate,
      };

      roster = { ...roster, dailyData };
      await persistRoster();

      if (showSuccessToast) {
        showToast('Daily data synced from database', TOAST_TYPES.SUCCESS);
      }
    } catch (error: any) {
      const reported = await reportError(error, {
        code: ERROR_CODES.WEEKLY.LOAD_FROM_DB_FAILED,
        severity: 'error',
        context: {
          phase: 'syncDailyFromDatabaseData',
          action: 'sync-daily-from-database',
          rosterId: activeRosterId,
          activeRosterId,
          visibleCharactersCount: visibleCharacters.length,
        },
        showToast: false,
      });
      if (showSuccessToast) {
        showToast(reported.message, TOAST_TYPES.ERROR);
      }
    }
  }

  async function syncDailyFromDatabase() {
    if (loading || !activeRosterId) return;

    if (visibleCharacters.length === 0) {
      showToast('No visible characters to sync daily data', TOAST_TYPES.WARNING);
      return;
    }

    loading = true;
    try {
      await syncDailyFromDatabaseData(true);
    } finally {
      loading = false;
    }
  }

  function getCharacterGold(characterName: string) {
    const character = getCharacter(characterName);
    if (!character) return 0;

    let total = 0;
    visibleBosses.forEach((boss) => {
      const raid = getRaidConfigByBoss(boss);
      if (!raid) return;
      const cell = getRaidCell(characterData, characterName, boss);
      if (!cell.cleared || cell.hidden) return;

      const diff = cell.difficulty === 'Hard' ? 'hm' : 'nm';
      const goldValue = Number((raid as any).gold?.[diff] || 0);
      const chestCost = Number((raid as any).chest?.[diff] || 0);
      total += cell.chestOpened ? (goldValue - chestCost) : goldValue;
    });

    const extra = Number((characterData?.[characterName] as CharacterBossData)?._extraGold || 0);
    return total + extra;
  }

  function computeGoldByCharacter(
    names: string[],
    _characterDataState: CharacterDataMap,
    _visibleBossesState: string[]
  ): Record<string, number> {
    const next: Record<string, number> = {};
    names.forEach((characterName) => {
      next[characterName] = getCharacterGold(characterName);
    });
    return next;
  }

  function getCharacterGoldForCard(characterName: string, cardCharacterData: CharacterDataMap, cardVisibleBosses: string[]) {
    let total = 0;

    cardVisibleBosses.forEach((boss) => {
      const raid = getRaidConfigByBoss(boss);
      if (!raid) return;

      const cell = getRaidCell(cardCharacterData, characterName, boss);
      if (!cell.cleared || cell.hidden) return;

      const diff = cell.difficulty === 'Hard' ? 'hm' : 'nm';
      const goldValue = Number((raid as any).gold?.[diff] || 0);
      const chestCost = Number((raid as any).chest?.[diff] || 0);
      total += cell.chestOpened ? (goldValue - chestCost) : goldValue;
    });

    const extra = Number((cardCharacterData?.[characterName] as CharacterBossData | undefined)?._extraGold || 0);
    return total + extra;
  }

  function computeGoldByCharacterForCard(
    names: string[],
    cardCharacterData: CharacterDataMap,
    cardVisibleBosses: string[]
  ) {
    const next: Record<string, number> = {};
    names.forEach((characterName) => {
      next[characterName] = getCharacterGoldForCard(characterName, cardCharacterData, cardVisibleBosses);
    });
    return next;
  }

  async function startTimer() {
    const updateTimer = async () => {
      try {
        const period = await api.getWeeklyResetPeriod?.();
        const end = Number(period?.end || 0);
        if (!end) {
          timerText = 'Weekly Reset: --:--:--';
          return;
        }

        const remaining = Math.max(0, end - Date.now());
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        timerText = `Weekly Reset: ${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      } catch {
        timerText = 'Weekly Reset: --:--:--';
      }
    };

    await updateTimer();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
  }

  function getRosterDailyTooltip(key: 'fieldBoss' | 'chaosGate') {
    return buildDailyTooltip(dailyData?.roster?.[key]);
  }

  function getRosterDailyTooltipFrom(data: DailyData | null | undefined, key: 'fieldBoss' | 'chaosGate') {
    return buildDailyTooltip(data?.roster?.[key]);
  }

  function getCharacterDailyTooltip(characterName: string, key: 'guardianRaid' | 'chaosDungeon') {
    return buildDailyTooltip(dailyData?.characters?.[characterName]?.[key]);
  }

  function getCharacterDailyTooltipFrom(
    data: DailyData | null | undefined,
    characterName: string,
    key: 'guardianRaid' | 'chaosDungeon'
  ) {
    return buildDailyTooltip(data?.characters?.[characterName]?.[key]);
  }
</script>

<section class="tab-content active" id="weekly-tab">
  <div id="weekly-cards" class="weekly-cards">
    {#if weeklyCards.length === 0}
      <article class="weekly-card" data-roster-id="__fallback__">
        <div class="weekly-header-block">
          <h1 class="weekly-title">Weekly Tracker</h1>
        </div>

        <div class="friends-empty" style="min-width: 420px; padding: 12px 0;">
          {#if loading}
            Loading weekly data...
          {:else}
            Weekly cards are empty.
            {#if apiReadyStatus === 'timeout'}
              API readiness timed out.
            {:else if apiReadyStatus === 'error'}
              API readiness failed.
            {/if}
          {/if}
        </div>

        <div class="weekly-actions" style="margin-top: 8px;">
          <div class="weekly-actions-left">
            <button type="button" class="header-icon-btn weekly-action-btn" on:click={loadAll} disabled={loading}>
              <img src="./assets/icons/items/download.svg" alt="" aria-hidden="true" />
              <span class="btn-label">Retry Load</span>
            </button>
            <button type="button" class="header-icon-btn weekly-action-btn" on:click={copyWeeklyDebugSnapshot}>
              <span class="btn-label">Copy Debug</span>
            </button>
          </div>
        </div>

        <details style="margin-top: 8px;">
          <summary>Debug snapshot</summary>
          <pre style="white-space: pre-wrap; max-width: 700px;">{JSON.stringify(debugSnapshot, null, 2)}</pre>
        </details>
      </article>
    {/if}

    {#each weeklyCards as card}
      {@const cardVisibleBosses = RAID_CONFIG
        .map((raid) => String((raid as any).id || '').trim())
        .filter((bossId) => Boolean(bossId) && !card.hiddenColumns.includes(bossId))}
      {@const cardShowGoldColumn = !card.hiddenColumns.includes('gold')}
      {@const cardShowGuardianColumn = !card.hiddenColumns.includes('guardianRaid')}
      {@const cardShowChaosColumn = !card.hiddenColumns.includes('chaosDungeon')}
      {@const cardTotalColumnsCount = 1 + cardVisibleBosses.length + (cardShowGoldColumn ? 1 : 0) + (cardShowGuardianColumn ? 1 : 0) + (cardShowChaosColumn ? 1 : 0)}
      {@const cardVisibleCharacters = getVisibleCharactersForRoster(card.roster, card.order)}
      {@const cardGoldByCharacter = computeGoldByCharacterForCard(cardVisibleCharacters, card.characterData, cardVisibleBosses)}
      {@const cardTotalGold = Object.values(cardGoldByCharacter).reduce((sum, value) => sum + value, 0)}
      {@const cardDailyData = card.isActive ? dailyData : card.dailyData}

      <article class="weekly-card" data-roster-id={card.rosterId}>
        <div class="weekly-header-block">
          <div class="weekly-top-row">
            <div class="weekly-top-left">
              <h1 class="weekly-title">{card.rosterName}</h1>
              <div class="roster-dailies" aria-label="Roster dailies">
                <button
                  type="button"
                  class="roster-daily-btn"
                  class:completed={Boolean(cardDailyData?.roster?.fieldBoss?.completed)}
                  title={getRosterDailyTooltipFrom(cardDailyData, 'fieldBoss') || 'Toggle Field Boss'}
                  aria-label="Toggle Field Boss"
                  disabled={!card.isActive}
                  on:click={() => card.isActive && toggleRosterDaily('fieldBoss')}
                >
                  <img src="./assets/icons/items/field_boss_icon.webp" alt="" aria-hidden="true" />
                  <span class="roster-daily-check">✓</span>
                </button>

                <button
                  type="button"
                  class="roster-daily-btn"
                  class:completed={Boolean(cardDailyData?.roster?.chaosGate?.completed)}
                  title={getRosterDailyTooltipFrom(cardDailyData, 'chaosGate') || 'Toggle Chaos Gate'}
                  aria-label="Toggle Chaos Gate"
                  disabled={!card.isActive}
                  on:click={() => card.isActive && toggleRosterDaily('chaosGate')}
                >
                  <img src="./assets/icons/items/chaos_gate_icon.webp" alt="" aria-hidden="true" />
                  <span class="roster-daily-check">✓</span>
                </button>
              </div>
            </div>
          </div>

          <div class="weekly-actions" style="margin-bottom: 12px;">
            <div class="weekly-actions-left">
              {#if card.isActive}
                <button type="button" class="header-icon-btn weekly-columns-btn" aria-label="Configure raid columns" title="Configure raid columns" on:click={openColumnsConfig}>⚙️</button>
                <button type="button" class="header-icon-btn weekly-action-btn" on:click={() => loadFromDatabase()} disabled={loading}>
                  <img src="./assets/icons/items/download.svg" alt="" aria-hidden="true" />
                  <span class="btn-label">Load Data</span>
                </button>
                <button type="button" class="header-icon-btn weekly-action-btn" on:click={() => openWeeklyConfirm('reset-weekly')} disabled={loading}>
                  <img src="./assets/icons/refresh.svg" alt="" aria-hidden="true" />
                  <span class="btn-label">Reset Data</span>
                </button>
              {/if}
            </div>
            <div class="weekly-actions-right">
              {#if card.isActive}
                <div class="reset-timer" aria-live="polite">{timerText}</div>
              {/if}
            </div>
          </div>
        </div>

        <table class="tracker-table">
          <thead>
            <tr>
              <th>Character</th>
              {#each cardVisibleBosses as boss}
                <th>{getRaidLabel(boss)}</th>
              {/each}
              {#if cardShowGoldColumn}
                <th>Gold</th>
              {/if}
              {#if cardShowGuardianColumn}
                <th class="daily-header daily-divider">Guardian Raid</th>
              {/if}
              {#if cardShowChaosColumn}
                <th class="daily-header" class:daily-divider={!cardShowGuardianColumn}><span>Chaos Dungeon</span><span class="daily-subtext">(manual)</span></th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#if cardVisibleCharacters.length === 0}
              <tr>
                <td colspan={cardTotalColumnsCount} class="friends-empty">No visible characters in roster.</td>
              </tr>
            {/if}

            {#each cardVisibleCharacters as characterName}
              {@const character = getCharacterFromRoster(card.roster, characterName)}
              {@const classIconPath = character ? getClassIconPath(character.class) : null}
              {#if character}
                <tr
                  draggable={card.isActive}
                  class:dragging-row={card.isActive && draggingCharacterName === characterName}
                  class:drag-over-row={card.isActive && dragOverCharacterName === characterName}
                  on:dragstart={(event) => card.isActive && startCharacterDrag(event, characterName)}
                  on:dragover={(event) => card.isActive && onCharacterDragOver(event, characterName)}
                  on:drop={(event) => card.isActive && onCharacterDrop(event, characterName)}
                  on:dragend={() => card.isActive && endCharacterDrag()}
                >
                  <td class="char-cell">
                    <div class="char-name" title={characterName}>
                      <span class="char-name-text">{characterName}</span>
                      {#if classIconPath}
                        <img src={classIconPath} alt={character.class} width="28" height="28" />
                      {/if}
                    </div>
                    <div class="char-info">
                      <span class="char-class">{character.class}</span>
                      <span class="char-ilvl">({formatItemLevelDisplay(character.ilvl)})</span>
                    </div>
                  </td>

                  {#each cardVisibleBosses as boss}
                    {@const eligible = isEligibleForRoster(card.roster, characterName, boss)}
                    {@const cell = getRaidCell(card.characterData, characterName, boss)}
                    <td class="boss-cell">
                      {#if !eligible}
                        <span style="color:#888;">-</span>
                      {:else}
                        {#if card.isActive}
                          <div class="cell" class:cell-hidden={cell.hidden}>
                            <button
                              type="button"
                              class={`difficulty-box ${cell.difficulty.toLowerCase()}`}
                              class:inactive={!cell.cleared}
                              on:click={() => cycleDifficulty(characterName, boss)}
                              style={`visibility: ${cell.cleared ? 'visible' : 'hidden'}`}
                              title="Cycle difficulty"
                              disabled={!cell.cleared}
                            >
                              {cell.difficulty}
                            </button>

                            <input
                              type="checkbox"
                              class="checkmark"
                              checked={cell.cleared}
                              title={cell.timestamp ? formatTimestamp(cell.timestamp) : ''}
                              on:change={(event) => toggleRaid(characterName, boss, Boolean((event.currentTarget as HTMLInputElement).checked))}
                              aria-label={`Toggle ${boss} for ${characterName}`}
                            />

                            <span
                              class="eye-icon"
                              role="button"
                              tabindex="0"
                              title="Hide from gold"
                              on:click={() => toggleHidden(characterName, boss)}
                              on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && toggleHidden(characterName, boss)}
                            >👁</span>

                            <span
                              class="chest-icon"
                              class:active={cell.chestOpened}
                              role="button"
                              tabindex="0"
                              title="Chest opened"
                              on:click={() => toggleChest(characterName, boss)}
                              on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && toggleChest(characterName, boss)}
                            ></span>
                          </div>
                        {:else}
                          <div class="cell" class:cell-hidden={cell.hidden}>
                            <span
                              class={`difficulty-box ${cell.difficulty.toLowerCase()}`}
                              class:inactive={!cell.cleared}
                              style={`visibility: ${cell.cleared ? 'visible' : 'hidden'}`}
                            >
                              {cell.difficulty}
                            </span>
                            <input
                              type="checkbox"
                              class="checkmark"
                              checked={cell.cleared}
                              title={cell.timestamp ? formatTimestamp(cell.timestamp) : ''}
                              disabled
                              aria-label={`Readonly ${boss} for ${characterName}`}
                            />
                            <span
                              class="chest-icon"
                              class:active={cell.chestOpened}
                              title="Chest opened"
                            ></span>
                          </div>
                        {/if}
                      {/if}
                    </td>
                  {/each}

                  {#if cardShowGoldColumn}
                    <td class="gold-cell">
                      <div class="gold-display">
                        <span class="gold-icon" aria-hidden="true"></span>
                        <span class="gold-amount">{Number(cardGoldByCharacter[characterName] || 0).toLocaleString()}</span>
                        {#if card.isActive}
                          <button
                            type="button"
                            class="gold-bonus-handle"
                            title="Add bonus gold"
                            aria-label={`Add bonus gold for ${characterName}`}
                            on:click|stopPropagation={() => openGoldBonus(characterName)}
                          >+
                          </button>

                          {#if goldPopoverCharacter === characterName}
                            <div class="gold-bonus-popover">
                              <input
                                class="gold-bonus-input"
                                type="number"
                                min="0"
                                step="10"
                                bind:value={goldBonusInput}
                                bind:this={goldBonusInputRef}
                                aria-label="Extra gold"
                                on:mousedown|stopPropagation
                                on:keydown={(event) => event.key === 'Enter' && applyGoldBonus(characterName)}
                              />
                              <button type="button" class="gold-bonus-confirm primary" on:mousedown|stopPropagation on:click={() => applyGoldBonus(characterName)}>OK</button>
                            </div>
                          {/if}
                        {/if}
                      </div>
                    </td>
                  {/if}

                  {#if cardShowGuardianColumn}
                    <td class="daily-cell daily-divider">
                      <input
                        type="checkbox"
                        class="daily-checkmark"
                        checked={Boolean(cardDailyData?.characters?.[characterName]?.guardianRaid?.completed)}
                        title={getCharacterDailyTooltipFrom(cardDailyData, characterName, 'guardianRaid')}
                        disabled={!card.isActive}
                        on:change={(event) => card.isActive && toggleCharacterDaily(characterName, 'guardianRaid', Boolean((event.currentTarget as HTMLInputElement).checked))}
                        aria-label={`Guardian raid completed for ${characterName}`}
                      />
                    </td>
                  {/if}

                  {#if cardShowChaosColumn}
                    <td class="daily-cell" class:daily-divider={!cardShowGuardianColumn}>
                      <input
                        type="checkbox"
                        class="daily-checkmark"
                        checked={Boolean(cardDailyData?.characters?.[characterName]?.chaosDungeon?.completed)}
                        title={getCharacterDailyTooltipFrom(cardDailyData, characterName, 'chaosDungeon')}
                        disabled={!card.isActive}
                        on:change={(event) => card.isActive && toggleCharacterDaily(characterName, 'chaosDungeon', Boolean((event.currentTarget as HTMLInputElement).checked))}
                        aria-label={`Chaos dungeon completed for ${characterName}`}
                      />
                    </td>
                  {/if}
                </tr>
              {/if}
            {/each}

            {#if cardVisibleCharacters.length > 0}
              <tr class="total-row">
                <td class="total-label">Total Gold</td>
                {#each cardVisibleBosses as _}
                  <td class="total-empty"></td>
                {/each}
                {#if cardShowGoldColumn}
                  <td class="gold-cell">
                    <div class="gold-display">
                      <span class="gold-icon" aria-hidden="true"></span>
                      <span class="gold-amount">{cardTotalGold.toLocaleString()}</span>
                    </div>
                  </td>
                {/if}
                {#if cardShowGuardianColumn}
                  <td class="total-empty"></td>
                {/if}
                {#if cardShowChaosColumn}
                  <td class="total-empty"></td>
                {/if}
              </tr>
            {/if}
          </tbody>
        </table>

        {#if card.isActive && columnSettingsOpen}
          <div id="column-settings-modal" style="display: block;" role="dialog" aria-modal="true" aria-labelledby="column-settings-title">
            <div class="modal-overlay"></div>
            <div class="modal-content column-settings-modal" role="document">
              <button id="column-settings-close" class="close-btn" aria-label="Close column settings" on:click={closeColumnsConfig}>×</button>
              <h2 id="column-settings-title" style="margin-top: 0;">Table Columns</h2>
              <p class="modal-subtitle">Choose which columns appear in the Weekly Tracker (raids, gold, guardian raid, chaos dungeon). Hidden columns will not count toward gold.</p>

              <div id="column-settings-list" class="column-settings-list">
                {#each columnEntries as entry}
                  <label class="column-settings-item">
                    <input
                      type="checkbox"
                      checked={Boolean(draftVisibleColumns[entry.id])}
                      on:change={(event) => toggleDraftColumn(entry.id, Boolean((event.currentTarget as HTMLInputElement).checked))}
                    />
                    <div class="column-settings-copy">
                      <span class="column-settings-title">{entry.label}</span>
                      <span class="column-settings-sub">{entry.subtitle}</span>
                    </div>
                  </label>
                {/each}
              </div>

              <div class="modal-buttons">
                <button id="column-settings-save" on:click={saveColumnsConfig}>Save</button>
                <button id="column-settings-cancel" on:click={closeColumnsConfig}>Cancel</button>
              </div>
            </div>
          </div>
        {/if}
      </article>
    {/each}

    {#if weeklyConfirmOpen}
      <div
        class="settings-confirm-overlay"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="weekly-confirm-title"
        aria-describedby="weekly-confirm-description"
        tabindex="0"
        on:click={onWeeklyConfirmOverlayClick}
        on:keydown={onWeeklyConfirmOverlayKeydown}
      >
        <div class="settings-confirm-card" role="document">
          <h3 id="weekly-confirm-title">{weeklyConfirmTitle}</h3>
          <p id="weekly-confirm-description">{weeklyConfirmMessage}</p>
          <div class="settings-confirm-actions">
            <button type="button" bind:this={weeklyConfirmCancelButton} on:click={closeWeeklyConfirm} disabled={loading}>Cancel</button>
            <button type="button" bind:this={weeklyConfirmConfirmButton} class="danger-action-btn" on:click={confirmWeeklyAction} disabled={loading}>Confirm</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</section>
