<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { UIHelper } from '../../utils/uiHelper';
  import { rosterChangeVersion } from '../../stores/rosterSync';
  import { RAID_CONFIG, TOAST_TYPES } from '../../legacy/config/constants.js';
  import { reportError } from '../../utils/errorHandler';
  import { ERROR_CODES } from '../../utils/errorCodes';
  import { withAsyncError } from '../../utils/errorWrappers';
  import { StateManager } from '../../legacy/modules/stateManager.js';
  import { RosterManager } from '../../legacy/modules/rosterManager.js';
  import { WeeklyTracker } from '../../legacy/modules/weeklyTracker.js';
  import { FriendsRosterService } from './services/FriendsRosterService';
  import {
    DEFAULT_FRIENDS_CONFIG,
    normalizeFriendsConfig,
    sanitizeCachedSnapshot,
    shouldRefreshByTtl,
  } from './config';
  import type { FriendSnapshot, FriendsRosterConfig } from './types';

  type FriendRow = {
    id: string;
    title: string;
    rosterCode: string;
    updatedAt: string | null;
    characterCount: number;
    cacheAgeMin: number | null;
    heatmapColor: string;
  };

  type HeatmapGroup = {
    id: string;
    name: string;
    isSelf: boolean;
    color: string;
    characters: FriendSnapshot['characters'];
  };

  type HeatmapDetailRow = {
    id: string;
    group: HeatmapGroup;
    character: FriendSnapshot['characters'][number] | null;
  };

  type SyncBadgeState = {
    className: string;
    label: string;
    title: string;
  };

  type RaidCellState = {
    className: string;
    text: string;
    label: string;
  };

  type FriendGridCard = {
    id: string;
    title: string;
    rosterCode: string;
    isSelf: boolean;
    updatedAt: string | null;
    cacheAgeMin: number | null;
    heatmapColor: string;
    characters: FriendSnapshot['characters'];
  };

  let loading = true;
  let refreshing = false;
  let message = '';
  let configured = false;
  let selfCode = '';
  let selfPin = '';
  let selfHeatmapColor = '#64b5f6';
  let addRosterCode = '';
  let addPin = '';
  let addAlias = '';
  let uploading = false;
  let isBusy = false;
  let pendingPinSync = false;
  let refreshCooldownUntil = 0;
  let uploadCooldownUntil = 0;
  let cooldownNow = Date.now();
  let cooldownTimer: ReturnType<typeof setInterval> | null = null;
  let autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  let copyFeedbackUntil = 0;
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let selfCodeVisible = false;
  let selfPinVisible = false;
  let setupVisible = false;
  let rows: FriendRow[] = [];
  let heatmapGroups: HeatmapGroup[] = [];
  let heatmapDetailRows: HeatmapDetailRow[] = [];
  let gridCards: FriendGridCard[] = [];
  let visibleRaidIndices: number[] = RAID_CONFIG.map((_: any, index: number) => index);
  let summaryHoveredRow = '-2';
  let summaryHoveredCol = '-2';
  let detailHoveredRow = '-2';
  let detailHoveredCol = '-2';
  let savedPin = '';
  let activePin = '';
  let pinMissing = true;
  let uploadRemainingSec = 0;
  let refreshRemainingSec = 0;
  let uploadLocked = false;
  let refreshLocked = false;
  let disableUpload = true;
  let disableRefresh = true;
  let uploadTitle = 'Upload your weekly to friends sync';
  let refreshTitle = '';

  const MAX_FRIENDS = 7;
  const MIN_PIN_LENGTH = 4;
  const MANUAL_UPLOAD_COOLDOWN_MS = 60_000;
  const MANUAL_REFRESH_COOLDOWN_MS = 60_000;
  const AUTO_SYNC_INTERVAL_MS = 2 * 60_000;
  const CACHE_FRESH_BADGE_MINUTES = 15;
  const DEFAULT_FRIEND_HEATMAP_COLOR = '#d4af37';
  const HEATMAP_COLOR_PALETTE = ['#64b5f6', '#ec407a', '#4dd0e1', '#9575cd', '#81c784', '#ffb74d', '#f06292'];
  const FRIENDS_RAID_LABELS: Record<string, string> = {
    aegir: 'AEGIR',
    brel: 'BREL',
    mordum: 'MORDUM',
    armoche: 'ARMOCHE',
    kazeros: 'KAZEROS',
  };

  const friendSnapshots = new Map<string, FriendSnapshot>();
  const ui = new UIHelper();
  let appState: StateManager | null = null;
  let rosterManagerRef: RosterManager | null = null;
  let weeklyTrackerRef: WeeklyTracker | null = null;
  let friendsService: FriendsRosterService | null = null;
  let friendsConfig: FriendsRosterConfig = { ...DEFAULT_FRIENDS_CONFIG };
  let onGlobalKeydown: ((event: KeyboardEvent) => void) | null = null;
  let unsubscribeRosterChanges: (() => void) | null = null;

  onMount(async () => {
    onGlobalKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (setupVisible) {
        toggleSetupView(false);
        return;
      }

      if (friendsConfig.heatmapVisible) {
        toggleHeatmapView(false);
      }
    };
    document.addEventListener('keydown', onGlobalKeydown);
    await initialize();

    let isInitialRosterSync = true;
    unsubscribeRosterChanges = rosterChangeVersion.subscribe(() => {
      if (isInitialRosterSync) {
        isInitialRosterSync = false;
        return;
      }

      void handleActiveRosterChanged();
    });
  });

  $: if (typeof document !== 'undefined') {
    document.body.style.overflow = (setupVisible || friendsConfig.heatmapVisible) ? 'hidden' : '';
  }

  onDestroy(() => {
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }

    if (autoSyncTimer) {
      clearInterval(autoSyncTimer);
      autoSyncTimer = null;
    }

    if (copyFeedbackTimer) {
      clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = null;
    }

    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }

    if (onGlobalKeydown) {
      document.removeEventListener('keydown', onGlobalKeydown);
      onGlobalKeydown = null;
    }

    unsubscribeRosterChanges?.();
    unsubscribeRosterChanges = null;
  });

  $: savedPin = resolveSelfPin(friendsConfig);
  $: activePin = String(selfPin || savedPin || '').trim();
  $: pinMissing = activePin.length < MIN_PIN_LENGTH;
  $: uploadRemainingSec = Math.ceil(getUploadCooldownRemainingMs() / 1000);
  $: refreshRemainingSec = Math.ceil(getRefreshCooldownRemainingMs() / 1000);
  $: uploadLocked = uploadRemainingSec > 0;
  $: refreshLocked = refreshRemainingSec > 0;
  $: disableUpload = isBusy || uploadLocked || pinMissing;
  $: disableRefresh = isBusy || refreshLocked;
  $: uploadTitle = pinMissing
    ? 'Set your PIN first'
    : (uploadLocked ? `Available in ${Math.max(0, uploadRemainingSec)}s` : 'Upload your weekly to friends sync');
  $: refreshTitle = refreshLocked ? `Available in ${Math.max(0, refreshRemainingSec)}s` : '';
  $: copyLabel = copyFeedbackUntil > Date.now() ? 'Copied!' : 'Copy';
  $: maskedSelfCode = selfCodeVisible ? (selfCode || '-') : (selfCode ? '******' : '-');
  $: selfPinInputType = selfPinVisible ? 'text' : 'password';

  async function initialize() {
    loading = true;
    message = '';

    try {
      await (window as any).__API_READY__;

      appState = new StateManager();
      await appState.initializeMultiRoster();

      const rosterManager = new RosterManager(appState);
      const weeklyTracker = new WeeklyTracker(appState);
      rosterManagerRef = rosterManager;
      weeklyTrackerRef = weeklyTracker;

      const savedSettings = await window.api.loadSettings();
      if (savedSettings) {
        appState.setState({ settings: savedSettings });
      }

      await rosterManager.loadRoster();
      await weeklyTracker.loadData();

      friendsService = new FriendsRosterService(weeklyTracker, rosterManager, appState);
      configured = friendsService.isConfigured();
      selfCode = String(friendsService.getSelfRosterCode() || '').trim();

      friendsConfig = getFriendsConfig();
      selfPin = resolveSelfPin(friendsConfig);
      selfHeatmapColor = resolveSelfHeatmapColor(friendsConfig);
      hydrateSnapshotsFromCache(friendsConfig);
      recomputeUiModels();
      scheduleAutoSync();

      if (configured && shouldRefreshByTtl(friendsConfig, friendSnapshots, friendsService.getCurrentWeekKey())) {
        await refreshFriends(false);
      }
    } catch (error: any) {
      await reportError(error, {
        code: ERROR_CODES.FRIENDS.INIT_FAILED,
        severity: 'error',
        context: {
          phase: 'initialize',
          action: 'initialize-friends',
        },
        showToast: false,
      });
      message = `Erro ao inicializar Friends: ${error?.message || error}`;
    } finally {
      loading = false;
    }
  }

  async function handleActiveRosterChanged() {
    if (!appState || !rosterManagerRef || !weeklyTrackerRef) {
      return;
    }

    try {
      loading = true;
      message = '';

      const persistedActiveRosterId = String((await window.api.getActiveRoster()) || '').trim();
      if (persistedActiveRosterId) {
        appState.setState({ activeRosterId: persistedActiveRosterId });
      }

      await rosterManagerRef.loadRoster();
      await weeklyTrackerRef.loadData();

      friendsService = new FriendsRosterService(weeklyTrackerRef, rosterManagerRef, appState);
      configured = friendsService.isConfigured();
      selfCode = String(friendsService.getSelfRosterCode() || '').trim();

      friendsConfig = getFriendsConfig();
      selfPin = resolveSelfPin(friendsConfig);
      selfHeatmapColor = resolveSelfHeatmapColor(friendsConfig);
      hydrateSnapshotsFromCache(friendsConfig);

      recomputeUiModels();
      scheduleAutoSync();

      if (configured && shouldRefreshByTtl(friendsConfig, friendSnapshots, friendsService.getCurrentWeekKey())) {
        await refreshFriends(false);
      }
    } catch (error: any) {
      await reportError(error, {
        code: ERROR_CODES.FRIENDS.ACTIVE_ROSTER_REFRESH_FAILED,
        severity: 'error',
        context: {
          phase: 'handleActiveRosterChanged',
          action: 'sync-after-roster-change',
          rosterId: String(appState?.get('activeRosterId') || ''),
        },
        showToast: false,
      });
      message = error?.message || 'Failed to refresh friends roster data.';
    } finally {
      loading = false;
    }
  }

  function getFriendsConfig(): FriendsRosterConfig {
    const settings = appState?.get('settings') || {};
    return {
      ...DEFAULT_FRIENDS_CONFIG,
      ...normalizeFriendsConfig((settings as any).friendsRoster),
    };
  }

  function saveFriendsConfig(nextConfig: FriendsRosterConfig) {
    if (!appState) return;

    const settings = appState.get('settings') || {};
    appState.setState({
      settings: {
        ...settings,
        friendsRoster: nextConfig,
      },
    });

    void window.api.saveSettings(appState.get('settings')).catch((error) => {
      void reportError(error, {
        code: ERROR_CODES.FRIENDS.SAVE_CONFIG_FAILED,
        severity: 'warning',
        context: {
          phase: 'saveFriendsConfig',
          action: 'persist-friends-config',
          rosterId: String(appState?.get('activeRosterId') || ''),
        },
        showToast: false,
      });
    });
    friendsConfig = nextConfig;
    selfPin = resolveSelfPin(nextConfig);
    selfHeatmapColor = resolveSelfHeatmapColor(nextConfig);
  }

  function showToast(text: string, type = TOAST_TYPES.INFO) {
    ui.showToast(text, type);
  }

  function hydrateSnapshotsFromCache(config: FriendsRosterConfig) {
    friendSnapshots.clear();

    const validFriendIds = new Set(config.friends.map((friend) => friend.id));
    Object.entries(config.friendSnapshotsByFriendId || {}).forEach(([friendId, snapshot]) => {
      if (!validFriendIds.has(friendId)) return;
      const safeSnapshot = sanitizeCachedSnapshot(snapshot);
      if (safeSnapshot) {
        friendSnapshots.set(friendId, safeSnapshot);
      }
    });
  }

  function persistSnapshotCache(fetchedFriendIds: string[] = []) {
    const fetchedSet = new Set(fetchedFriendIds);
    const nextSnapshotsByFriendId: Record<string, FriendSnapshot> = {};
    const nextFetchedAtByFriendId: Record<string, number> = {};

    friendsConfig.friends.forEach((friend) => {
      const snapshot = friendSnapshots.get(friend.id);
      const safeSnapshot = sanitizeCachedSnapshot(snapshot);
      if (!safeSnapshot) return;

      nextSnapshotsByFriendId[friend.id] = safeSnapshot;
      const existingFetchedAt = Number(friendsConfig.friendSnapshotFetchedAtByFriendId?.[friend.id]) || 0;
      nextFetchedAtByFriendId[friend.id] = fetchedSet.has(friend.id)
        ? Date.now()
        : (existingFetchedAt || Date.now());
    });

    saveFriendsConfig({
      ...friendsConfig,
      friendSnapshotsByFriendId: nextSnapshotsByFriendId,
      friendSnapshotFetchedAtByFriendId: nextFetchedAtByFriendId,
    });
  }

  function computeRows() {
    rows = friendsConfig.friends.map((friend) => {
      const snapshot = friendSnapshots.get(friend.id);
      const fetchedAt = Number(friendsConfig.friendSnapshotFetchedAtByFriendId?.[friend.id]) || 0;
      const cacheAgeMin = fetchedAt ? Math.floor((Date.now() - fetchedAt) / 60000) : null;
      return {
        id: friend.id,
        title: friend.alias || snapshot?.rosterName || friend.rosterCode,
        rosterCode: friend.rosterCode,
        updatedAt: snapshot?.updatedAt || null,
        characterCount: Array.isArray(snapshot?.characters) ? snapshot.characters.length : 0,
        cacheAgeMin,
        heatmapColor: resolveFriendHeatmapColor(friend.id),
      };
    });
  }

  function recomputeUiModels() {
    computeRows();
    visibleRaidIndices = resolveVisibleRaidIndices(friendsService?.getVisibleRaidIndices());
    gridCards = buildGridCards();
    heatmapGroups = buildHeatmapGroups();
    heatmapDetailRows = buildHeatmapDetailRows(heatmapGroups);
  }

  function buildGridCards(): FriendGridCard[] {
    if (!friendsService) {
      return [];
    }

    const selfSnapshot = friendsService.buildSelfSnapshot();

    const cards: FriendGridCard[] = [
      {
        id: selfSnapshot.rosterCode || 'self',
        title: selfSnapshot.rosterName || 'Main Roster',
        rosterCode: selfSnapshot.rosterCode || '-',
        isSelf: true,
        updatedAt: null,
        cacheAgeMin: 0,
        heatmapColor: resolveSelfHeatmapColor(friendsConfig),
        characters: [...(selfSnapshot.characters || [])],
      },
    ];

    friendsConfig.friends.forEach((friend) => {
      const snapshot = friendSnapshots.get(friend.id);
      const fetchedAt = Number(friendsConfig.friendSnapshotFetchedAtByFriendId?.[friend.id]) || 0;
      const cacheAgeMin = fetchedAt ? Math.floor((Date.now() - fetchedAt) / 60000) : null;

      cards.push({
        id: friend.id,
        title: friend.alias || snapshot?.rosterName || friend.rosterCode,
        rosterCode: friend.rosterCode,
        isSelf: false,
        updatedAt: snapshot?.updatedAt || null,
        cacheAgeMin,
        heatmapColor: resolveFriendHeatmapColor(friend.id),
        characters: Array.isArray(snapshot?.characters) ? [...snapshot.characters] : [],
      });
    });

    return cards;
  }

  function buildHeatmapDetailRows(groups: HeatmapGroup[]) {
    const rowsBuffer: HeatmapDetailRow[] = [];
    groups.forEach((group) => {
      const characters = Array.isArray(group.characters) ? group.characters : [];
      if (!characters.length) {
        rowsBuffer.push({ id: `${group.id}-empty`, group, character: null });
        return;
      }

      characters.forEach((character, index) => {
        rowsBuffer.push({
          id: `${group.id}-${character.name || 'char'}-${index}`,
          group,
          character,
        });
      });
    });

    return rowsBuffer;
  }

  function resolveVisibleRaidIndices(indices: unknown) {
    if (Array.isArray(indices) && indices.length > 0) {
      return indices
        .filter((index) => Number.isInteger(index) && Number(index) >= 0 && Number(index) < RAID_CONFIG.length)
        .map((index) => Number(index));
    }

    return RAID_CONFIG.map((_: any, index: number) => index);
  }

  function computeCardRaidProgress(characters: FriendSnapshot['characters'] = [], raidIndices: number[] = []) {
    let total = 0;
    let done = 0;

    const safeCharacters = Array.isArray(characters) ? characters : [];
    safeCharacters.forEach((character) => {
      raidIndices.forEach((raidIndex) => {
        const visible = ((character?.visibleMask || 0) & (1 << raidIndex)) !== 0;
        if (!visible) {
          return;
        }

        total += 1;
        const isDone = ((character?.raidMask || 0) & (1 << raidIndex)) !== 0;
        if (isDone) {
          done += 1;
        }
      });
    });

    return { done, total };
  }

  function resolveCardSyncState(card: FriendGridCard): SyncBadgeState {
    if (card.isSelf) {
      return {
        className: 'is-self',
        label: 'You',
        title: 'Your roster',
      };
    }

    const updatedAt = card.updatedAt ? new Date(card.updatedAt) : null;
    if (!updatedAt || Number.isNaN(updatedAt.getTime())) {
      return {
        className: 'is-nosync',
        label: 'No Sync',
        title: 'No synced data yet',
      };
    }

    const elapsedMs = Date.now() - updatedAt.getTime();
    const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));

    if (elapsedMinutes <= 180) {
      return {
        className: 'is-fresh',
        label: `Updated ${formatElapsed(elapsedMinutes)}`,
        title: `Last sync ${formatDateTime(updatedAt)}`,
      };
    }

    return {
      className: 'is-stale',
      label: `Updated ${formatElapsed(elapsedMinutes)}`,
      title: `Last sync ${formatDateTime(updatedAt)}`,
    };
  }

  function formatElapsed(elapsedMinutes: number) {
    if (elapsedMinutes < 1) {
      return 'just now';
    }

    if (elapsedMinutes < 60) {
      return `${elapsedMinutes}m ago`;
    }

    const hours = Math.floor(elapsedMinutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function formatDateTime(value: unknown) {
    const date = new Date(String(value || ''));
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function resolveRosterSummaryState(doneCount: number, visibleCount: number): RaidCellState {
    if (!visibleCount) {
      return { className: 'state-none', text: '-', label: 'No visible characters' };
    }

    if (doneCount <= 0) {
      return { className: 'state-self-available', text: `0/${visibleCount}`, label: `0 of ${visibleCount} completed` };
    }

    if (doneCount >= visibleCount) {
      return { className: 'state-self-done', text: `${doneCount}/${visibleCount}`, label: `All ${visibleCount} completed` };
    }

    return {
      className: 'state-self-available',
      text: `${doneCount}/${visibleCount}`,
      label: `${doneCount} of ${visibleCount} completed`,
    };
  }

  function resolveDetailedState(character: FriendSnapshot['characters'][number] | null, raidIndex: number): RaidCellState {
    if (!character) {
      return { className: 'state-none', text: '-', label: 'No character data' };
    }

    const visible = ((character?.visibleMask || 0) & (1 << raidIndex)) !== 0;
    if (!visible) {
      return { className: 'state-none', text: '-', label: 'Hidden for this character' };
    }

    const done = ((character?.raidMask || 0) & (1 << raidIndex)) !== 0;
    if (done) {
      return { className: 'state-self-done', text: '✓', label: 'Completed' };
    }

    return { className: 'state-self-available', text: '●', label: 'Available and not completed' };
  }

  function getRosterSummaryCounts(characters: FriendSnapshot['characters'], raidIndex: number) {
    const safeChars = Array.isArray(characters) ? characters : [];
    const visibleCount = safeChars.reduce((count, character) => {
      const visible = ((character?.visibleMask || 0) & (1 << raidIndex)) !== 0;
      return count + (visible ? 1 : 0);
    }, 0);

    const doneCount = safeChars.reduce((count, character) => {
      const visible = ((character?.visibleMask || 0) & (1 << raidIndex)) !== 0;
      if (!visible) return count;
      const done = ((character?.raidMask || 0) & (1 << raidIndex)) !== 0;
      return count + (done ? 1 : 0);
    }, 0);

    return { doneCount, visibleCount };
  }

  function shouldHighlightRow(rowId: string, hoveredRow: string) {
    return hoveredRow !== '-2' && rowId === hoveredRow;
  }

  function shouldHighlightCol(colId: string, hoveredCol: string) {
    return hoveredCol !== '-2' && hoveredCol !== '-1' && colId === hoveredCol;
  }

  function getVisibilityIconSvg(isVisible: boolean) {
    if (isVisible) {
      return '<svg class="friends-visibility-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-1.01 2.28-2.79 4.18-5.05 5.33" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.61 6.61C4.62 7.85 3.08 9.76 2 12c.81 1.68 1.96 3.12 3.36 4.22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    return '<svg class="friends-visibility-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  }

  function getDefaultHeatmapColor(seed = '') {
    const text = String(seed || 'seed');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }

    return HEATMAP_COLOR_PALETTE[Math.abs(hash) % HEATMAP_COLOR_PALETTE.length];
  }

  function resolveSelfHeatmapColor(config: FriendsRosterConfig) {
    if (!friendsService) return '#64b5f6';
    const currentSelfCode = friendsService.getSelfRosterCode();
    const byRoster = config.selfHeatmapColorByRoster || {};
    return byRoster[currentSelfCode] || getDefaultHeatmapColor(currentSelfCode || 'self');
  }

  function resolveFriendHeatmapColor(friendId: string) {
    const friend = friendsConfig.friends.find((entry) => entry.id === friendId);
    return friend?.heatmapColor || DEFAULT_FRIEND_HEATMAP_COLOR;
  }

  function updateSelfHeatmapColor(color: string) {
    if (!friendsService) return;
    const safeColor = String(color || '').trim();
    if (!safeColor) return;

    const currentSelfCode = friendsService.getSelfRosterCode();
    if (!currentSelfCode) return;

    saveFriendsConfig({
      ...friendsConfig,
      selfHeatmapColorByRoster: {
        ...(friendsConfig.selfHeatmapColorByRoster || {}),
        [currentSelfCode]: safeColor,
      },
    });
    selfHeatmapColor = safeColor;
    recomputeUiModels();
  }

  function updateFriendHeatmapColor(friendId: string, color: string) {
    const safeColor = String(color || '').trim();
    if (!safeColor) return;

    saveFriendsConfig({
      ...friendsConfig,
      friends: friendsConfig.friends.map((friend) => (
        friend.id === friendId ? { ...friend, heatmapColor: safeColor } : friend
      )),
    });

    recomputeUiModels();
  }

  function buildHeatmapGroups(): HeatmapGroup[] {
    if (!friendsService) return [];

    const selfSnapshot = friendsService.buildSelfSnapshot();
    const groups: HeatmapGroup[] = [
      {
        id: selfSnapshot.rosterCode || 'self',
        name: selfSnapshot.rosterName || 'Main Roster',
        isSelf: true,
        color: resolveSelfHeatmapColor(friendsConfig),
        characters: Array.isArray(selfSnapshot.characters) ? selfSnapshot.characters : [],
      },
    ];

    friendsConfig.friends.forEach((friend) => {
      const snapshot = friendSnapshots.get(friend.id);
      groups.push({
        id: friend.id,
        name: friend.alias || snapshot?.rosterName || friend.rosterCode,
        isSelf: false,
        color: friend.heatmapColor || DEFAULT_FRIEND_HEATMAP_COLOR,
        characters: Array.isArray(snapshot?.characters) ? snapshot.characters : [],
      });
    });

    return groups;
  }

  function createFriendId() {
    if (crypto?.randomUUID) {
      return crypto.randomUUID();
    }

    return `friend-${Math.random().toString(36).slice(2, 10)}`;
  }

  function persistLastUploadFingerprint(selfRosterCode: string, fingerprint: string) {
    saveFriendsConfig({
      ...friendsConfig,
      lastUploadFingerprintByRoster: {
        ...(friendsConfig.lastUploadFingerprintByRoster || {}),
        [selfRosterCode]: fingerprint,
      },
    });
  }

  function getUniqueFailureMessages(messages: string[]) {
    return [...new Set(messages)];
  }

  function resetAddFriendForm() {
    addRosterCode = '';
    addPin = '';
    addAlias = '';
  }

  function getUploadCooldownRemainingMs() {
    void cooldownNow;
    return Math.max(0, uploadCooldownUntil - Date.now());
  }

  function getRefreshCooldownRemainingMs() {
    void cooldownNow;
    return Math.max(0, refreshCooldownUntil - Date.now());
  }

  function ensureCooldownTicker() {
    if (cooldownTimer) return;
    cooldownTimer = setInterval(() => {
      cooldownNow = Date.now();
      const hasUploadCooldown = getUploadCooldownRemainingMs() > 0;
      const hasRefreshCooldown = getRefreshCooldownRemainingMs() > 0;
      if (!hasUploadCooldown && !hasRefreshCooldown && cooldownTimer) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
    }, 1000);
  }

  function startCooldown(type: 'upload' | 'refresh', durationMs: number) {
    const now = Date.now();
    if (type === 'upload') {
      uploadCooldownUntil = Math.max(uploadCooldownUntil, now + durationMs);
    }
    if (type === 'refresh') {
      refreshCooldownUntil = Math.max(refreshCooldownUntil, now + durationMs);
    }
    cooldownNow = Date.now();
    ensureCooldownTicker();
  }

  function setBusy(nextBusy: boolean) {
    isBusy = Boolean(nextBusy);
    if (!isBusy && pendingPinSync) {
      pendingPinSync = false;
      void syncPinChangeUpload();
    }
  }

  function scheduleAutoSync() {
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer);
      autoSyncTimer = null;
    }

    if (!friendsConfig.autoSyncEnabled || !configured) {
      return;
    }

    autoSyncTimer = setInterval(() => {
      void tryAutoUpload();
    }, AUTO_SYNC_INTERVAL_MS);
  }

  async function toggleAutoSync(enabled: boolean) {
    saveFriendsConfig({
      ...friendsConfig,
      autoSyncEnabled: Boolean(enabled),
    });
    scheduleAutoSync();
    showToast(enabled ? 'Auto upload enabled.' : 'Auto upload disabled.', TOAST_TYPES.INFO);
  }

  async function tryAutoUpload() {
    if (!friendsService || isBusy || !configured || !friendsConfig.autoSyncEnabled) {
      return;
    }
    const service = friendsService;

    const currentSelfCode = service.getSelfRosterCode();
    const pin = resolveSelfPin(friendsConfig);
    if (!currentSelfCode || !pin) {
      return;
    }

    const snapshot = service.buildSelfSnapshot();
    const pinHash = await service.hashPin(pin);
    const fingerprint = service.buildSyncFingerprint(snapshot, pinHash);
    const lastFingerprint = friendsConfig.lastUploadFingerprintByRoster?.[currentSelfCode];
    if (lastFingerprint === fingerprint) {
      return;
    }

    setBusy(true);
    const result = await withAsyncError(
      () => service.uploadSelfWeekly(pin),
      {
        code: ERROR_CODES.FRIENDS.AUTO_UPLOAD_FAILED,
        severity: 'warning',
        context: {
          phase: 'tryAutoUpload',
          action: 'auto-upload-weekly',
          rosterCode: currentSelfCode,
        },
        showToast: false,
      }
    );

    if (result) {
      persistLastUploadFingerprint(currentSelfCode, result.fingerprint);
    } else {
      showToast('Auto upload failed.', TOAST_TYPES.ERROR);
    }

    setBusy(false);
  }

  function resolveSelfPin(config: FriendsRosterConfig) {
    if (!friendsService) return '';
    const currentSelfCode = friendsService.getSelfRosterCode();
    const ownFriendEntry = config.friends.find((friend) => friend.rosterCode === currentSelfCode);
    if (ownFriendEntry?.pin) {
      return ownFriendEntry.pin;
    }

    const byRoster = config.selfPinsByRoster || {};
    return byRoster[currentSelfCode] || '';
  }

  async function copySelfRosterCode() {
    const code = String(selfCode || '').trim();
    if (!code) {
      showToast('No roster code to copy.', TOAST_TYPES.WARNING);
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      triggerCopyFeedback();
      showToast('Roster code copied to clipboard.', TOAST_TYPES.SUCCESS);
      return;
    } catch (error) {
      await reportError(error, {
        code: ERROR_CODES.FRIENDS.COPY_CODE_FAILED,
        severity: 'warning',
        context: {
          phase: 'copySelfRosterCode',
          fallback: 'execCommand',
          action: 'copy-self-roster-code',
          rosterCode: code,
        },
        showToast: false,
      });
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();

      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (copied) {
        triggerCopyFeedback();
        showToast('Roster code copied to clipboard.', TOAST_TYPES.SUCCESS);
        return;
      }

      showToast('Could not copy roster code.', TOAST_TYPES.ERROR);
    }
  }

  function triggerCopyFeedback() {
    copyFeedbackUntil = Date.now() + 1400;
    if (copyFeedbackTimer) {
      clearTimeout(copyFeedbackTimer);
    }
    copyFeedbackTimer = setTimeout(() => {
      copyFeedbackUntil = 0;
      copyFeedbackTimer = null;
    }, 1400);
  }

  function toggleHeatmapView(forceVisible: boolean | null = null) {
    const nextVisible = typeof forceVisible === 'boolean' ? forceVisible : !friendsConfig.heatmapVisible;
    saveFriendsConfig({
      ...friendsConfig,
      heatmapVisible: nextVisible,
    });
    recomputeUiModels();
  }

  function toggleSetupView(forceVisible: boolean | null = null) {
    setupVisible = typeof forceVisible === 'boolean' ? forceVisible : !setupVisible;
  }

  async function updateSelfPin(nextPin: string) {
    if (!friendsService) return;
    const safePin = String(nextPin || '').trim();
    const currentSelfCode = friendsService.getSelfRosterCode();
    if (!currentSelfCode) return;

    saveFriendsConfig({
      ...friendsConfig,
      selfPinsByRoster: {
        ...(friendsConfig.selfPinsByRoster || {}),
        [currentSelfCode]: safePin,
      },
    });

    if (!safePin || !friendsService.isConfigured()) {
      return;
    }

    if (isBusy) {
      pendingPinSync = true;
      return;
    }

    await syncPinChangeUpload();
    scheduleAutoSync();
  }

  async function syncPinChangeUpload() {
    if (!friendsService) return;
    const service = friendsService;

    const currentSelfCode = service.getSelfRosterCode();
    const pin = resolveSelfPin(friendsConfig);

    if (!currentSelfCode || !pin || !service.isConfigured() || isBusy) {
      return;
    }

    setBusy(true);
    uploading = true;

    const result = await withAsyncError(
      () => service.uploadSelfWeekly(pin),
      {
        code: ERROR_CODES.FRIENDS.PIN_SYNC_FAILED,
        severity: 'error',
        context: {
          phase: 'syncPinChangeUpload',
          action: 'sync-pin-upload',
          rosterCode: currentSelfCode,
        },
        showToast: false,
      }
    );

    if (result) {
      persistLastUploadFingerprint(currentSelfCode, result.fingerprint);
      showToast('PIN updated and synced.', TOAST_TYPES.SUCCESS);
    } else {
      showToast('Failed to sync updated PIN.', TOAST_TYPES.ERROR);
    }

    uploading = false;
    setBusy(false);
  }

  async function handleManualUpload() {
    if (!friendsService) return;
    const service = friendsService;

    const cooldownMs = getUploadCooldownRemainingMs();
    if (cooldownMs > 0) {
      showToast(`Aguarde ${Math.ceil(cooldownMs / 1000)}s para enviar novamente.`, TOAST_TYPES.INFO);
      return;
    }

    const currentSelfCode = service.getSelfRosterCode();
    if (!currentSelfCode) {
      showToast('Select a roster before uploading weekly data.', TOAST_TYPES.WARNING);
      return;
    }

    if (!service.isConfigured()) {
      showToast('Configure Supabase env vars before uploading.', TOAST_TYPES.WARNING);
      return;
    }

    const pin = resolveSelfPin(friendsConfig);
    if (!pin) {
      showToast('Set your PIN in Friends Roster before uploading.', TOAST_TYPES.WARNING);
      return;
    }

    const snapshot = service.buildSelfSnapshot();
    const pinHash = await service.hashPin(pin);
    const fingerprint = service.buildSyncFingerprint(snapshot, pinHash);
    const lastFingerprint = friendsConfig.lastUploadFingerprintByRoster?.[currentSelfCode];

    if (lastFingerprint && lastFingerprint === fingerprint) {
      showToast('No changes detected. Upload skipped.', TOAST_TYPES.INFO);
      return;
    }

    startCooldown('upload', MANUAL_UPLOAD_COOLDOWN_MS);
    setBusy(true);
    uploading = true;

    const result = await withAsyncError(
      () => service.uploadSelfWeekly(pin),
      {
        code: ERROR_CODES.FRIENDS.UPLOAD_FAILED,
        severity: 'error',
        context: {
          phase: 'handleManualUpload',
          action: 'manual-upload-weekly',
          rosterCode: currentSelfCode,
        },
        showToast: false,
      }
    );

    if (!result) {
      showToast('Weekly upload failed.', TOAST_TYPES.ERROR);
      uploading = false;
      setBusy(false);
      return;
    }

    persistLastUploadFingerprint(currentSelfCode, result.fingerprint);

    if (result.skipped) {
      showToast('No changes detected. Upload skipped.', TOAST_TYPES.INFO);
    } else {
      showToast(`Weekly uploaded (${result.uploaded} characters).`, TOAST_TYPES.SUCCESS);
    }

    uploading = false;
    setBusy(false);
  }

  async function addFriend() {
    if (!friendsService) return;
    const service = friendsService;

    const safeCode = String(addRosterCode || '').trim();
    const safePin = String(addPin || '').trim();
    const safeAlias = String(addAlias || '').trim();

    if (!safeCode || !safePin) {
      showToast('Roster code and PIN are required.', TOAST_TYPES.WARNING);
      return;
    }

    if (friendsConfig.friends.length >= MAX_FRIENDS) {
      showToast(`You can add up to ${MAX_FRIENDS} friends.`, TOAST_TYPES.WARNING);
      return;
    }

    const alreadyAdded = friendsConfig.friends.some((friend) => friend.rosterCode === safeCode);
    if (alreadyAdded) {
      showToast('This roster code is already added.', TOAST_TYPES.WARNING);
      return;
    }

    if (!service.isConfigured()) {
      showToast('Friends sync is not configured.', TOAST_TYPES.WARNING);
      return;
    }

    setBusy(true);
    refreshing = true;
    const snapshot = await withAsyncError(
      () => service.fetchFriendWeekly({ rosterCode: safeCode, pin: safePin }),
      {
        code: ERROR_CODES.FRIENDS.ADD_FRIEND_FAILED,
        severity: 'warning',
        context: {
          phase: 'addFriend',
          action: 'add-friend',
          rosterCode: safeCode,
        },
        showToast: false,
      }
    );

    if (!snapshot) {
      showToast('Invalid roster code or PIN.', TOAST_TYPES.ERROR);
      refreshing = false;
      setBusy(false);
      return;
    }

    const friendId = createFriendId();

    friendSnapshots.set(friendId, snapshot);

    saveFriendsConfig({
      ...friendsConfig,
      friends: [
        ...friendsConfig.friends,
        {
          id: friendId,
          rosterCode: safeCode,
          pin: safePin,
          alias: safeAlias,
          heatmapColor: DEFAULT_FRIEND_HEATMAP_COLOR,
        },
      ],
    });

    persistSnapshotCache([friendId]);
    recomputeUiModels();

    resetAddFriendForm();
    showToast('Friend added.', TOAST_TYPES.SUCCESS);
    refreshing = false;
    setBusy(false);
  }

  function removeFriend(friendId: string) {
    friendSnapshots.delete(friendId);

    saveFriendsConfig({
      ...friendsConfig,
      friends: friendsConfig.friends.filter((friend) => friend.id !== friendId),
    });

    persistSnapshotCache();
    recomputeUiModels();
    showToast('Friend removed.', TOAST_TYPES.INFO);
  }

  async function refreshFriends(showToastFeedback: boolean) {
    const service = friendsService;
    if (!service) return;

    if (showToastFeedback) {
      const remainingMs = getRefreshCooldownRemainingMs();
      if (remainingMs > 0) {
        showToast(`Aguarde ${Math.ceil(remainingMs / 1000)}s para atualizar novamente.`, TOAST_TYPES.INFO);
        return;
      }
    }

    if (!friendsConfig.friends.length) {
      recomputeUiModels();
      if (showToastFeedback) {
        showToast('No friends to refresh.', TOAST_TYPES.INFO);
      }
      return;
    }

    if (!service.isConfigured()) {
      if (showToastFeedback) {
        showToast('Configure Supabase env vars to refresh friends.', TOAST_TYPES.WARNING);
      }
      return;
    }

    if (showToastFeedback) {
      startCooldown('refresh', MANUAL_REFRESH_COOLDOWN_MS);
    }

    setBusy(true);
    refreshing = true;
    message = '';

    try {
      const results = await Promise.allSettled(
        friendsConfig.friends.map((friend) =>
          service.fetchFriendWeekly({ rosterCode: friend.rosterCode, pin: friend.pin })
            .then((snapshot) => ({ friendId: friend.id, snapshot }))
        )
      );

      const refreshedFriendIds: string[] = [];
      const failureMessages: string[] = [];
      let successCount = 0;

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          successCount += 1;
          friendSnapshots.set(result.value.friendId, result.value.snapshot);
          refreshedFriendIds.push(result.value.friendId);
          return;
        }

        const failureMessage = result.reason?.message || 'Failed to refresh friend.';
        failureMessages.push(failureMessage);
      });

      if (refreshedFriendIds.length > 0) {
        persistSnapshotCache(refreshedFriendIds);
      }

      recomputeUiModels();

      if (showToastFeedback) {
        showToast(`Friends refreshed: ${successCount}/${friendsConfig.friends.length}.`, TOAST_TYPES.SUCCESS);
      }

      if (failureMessages.length > 0) {
        const unique = getUniqueFailureMessages(failureMessages);
        if (showToastFeedback) {
          showToast(unique.slice(0, 2).join(' | '), TOAST_TYPES.WARNING);
        } else if (refreshedFriendIds.length === 0) {
          message = unique[0];
        }
      }
    } catch (error: any) {
      const reported = await reportError(error, {
        code: ERROR_CODES.FRIENDS.REFRESH_FAILED,
        severity: 'error',
        context: {
          phase: 'refreshFriends',
          action: 'refresh-friends',
          rosterId: String(appState?.get('activeRosterId') || ''),
          showToastFeedback,
          friendsCount: friendsConfig.friends.length,
        },
        showToast: false,
      });
      if (showToastFeedback) {
        showToast(reported.message, TOAST_TYPES.ERROR);
      } else {
        message = reported.message;
      }
    } finally {
      refreshing = false;
      setBusy(false);
    }
  }

  async function onManualRefresh() {
    await refreshFriends(true);
  }
</script>

<section id="friends-tab" class="tab-content active">
  <div class="friends-header">
    <h1>Friends Roster(WIP)</h1>
    <div class="friends-header-actions">
      <div class="friends-header-actions__primary">
        <button
          id="friends-setup-btn"
          class={`header-icon-btn ${setupVisible ? 'is-active' : ''}`}
          type="button"
          title={setupVisible ? 'Close friends setup' : 'Open friends setup'}
          aria-pressed={setupVisible}
          on:click={() => toggleSetupView()}
        >
          <span class="btn-label">Setup</span>
        </button>
      </div>
      <div class="friends-header-actions__secondary">
        <button
          id="friends-upload-btn"
          class="header-icon-btn"
          type="button"
          disabled={disableUpload || loading || !configured}
          title={uploadTitle}
          on:click={handleManualUpload}
        >
          <span class="btn-label">{uploading ? 'Uploading...' : 'Upload Weekly'}</span>
        </button>

        <button
          id="friends-refresh-btn"
          class="header-icon-btn"
          type="button"
          on:click={onManualRefresh}
          disabled={disableRefresh || loading || !configured}
          title={refreshTitle}
        >
          <span class="btn-label">{refreshing ? 'Atualizando...' : 'Refresh Friends'}</span>
        </button>

        <button
          id="friends-heatmap-btn"
          class={`header-icon-btn ${friendsConfig.heatmapVisible ? 'is-active' : ''}`}
          type="button"
          title={friendsConfig.heatmapVisible ? 'Hide group view' : 'Open group view'}
          aria-pressed={friendsConfig.heatmapVisible}
          on:click={() => toggleHeatmapView()}
        >
          <span class="btn-label">Group View</span>
        </button>
      </div>
    </div>
  </div>

  <div class="friends-grid" aria-live="polite">
    {#if loading}
      <p class="friends-empty">Carregando Friends...</p>
    {:else}
      {#if message}
        <p class="friends-empty">{message}</p>
      {/if}

      {#if gridCards.length === 0}
        <p class="friends-empty">No roster data to display.</p>
      {:else}
        {#each gridCards as card}
          {@const progress = computeCardRaidProgress(card.characters, visibleRaidIndices)}
          {@const syncState = resolveCardSyncState(card)}
          <section class={`friends-card${card.isSelf ? ' friends-card--self' : ''}`}>
            <div class="friends-card__header">
              <h2 class="friends-card__title" style={`color:${card.heatmapColor};`}>{card.title}</h2>
              <div class="friends-card__meta">
                <span class="friends-card__summary">
                  {#if progress.total > 0}
                    {progress.done}/{progress.total} raids done
                  {:else}
                    No visible raids
                  {/if}
                </span>
                <span class={`friends-card__sync-badge ${syncState.className}`} title={syncState.title}>
                  {syncState.label}
                </span>
              </div>
            </div>

            <div class="friends-table-wrap">
              <table class="friends-table" style={`min-width: ${56 + (visibleRaidIndices.length * 58)}px;`}>
                <thead>
                  <tr>
                    <th>CHAR</th>
                    {#each visibleRaidIndices as raidIndex}
                      {@const raid = RAID_CONFIG[raidIndex] as any}
                      <th>{FRIENDS_RAID_LABELS[String(raid?.id || '')] || String(raid?.id || '').toUpperCase()}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#if card.characters.length === 0}
                    <tr>
                      <td class="friends-row-empty" colspan={visibleRaidIndices.length + 1}>No characters synced yet</td>
                    </tr>
                  {:else}
                    {#each card.characters as character}
                      <tr>
                        <td class="friends-char-name">{character.name}</td>
                        {#each visibleRaidIndices as raidIndex}
                          {@const hasVisibleMask = character.visibleMask !== null && character.visibleMask !== undefined}
                          {@const visible = hasVisibleMask ? (((character.visibleMask || 0) & (1 << raidIndex)) !== 0) : true}
                          {@const ignored = !visible}
                          {@const done = !ignored && (((character.raidMask || 0) & (1 << raidIndex)) !== 0)}
                          <td class={`friends-raid-cell${ignored ? ' is-ignored' : (done ? ' is-done' : ' is-pending')}`}>
                            {ignored ? '-' : (done ? '✓' : '●')}
                          </td>
                        {/each}
                      </tr>
                    {/each}
                  {/if}
                </tbody>
              </table>
            </div>
          </section>
        {/each}
      {/if}
    {/if}
  </div>

  <div id="friends-setup-modal" class="friends-setup-modal" style={setupVisible ? 'display: block;' : 'display: none;'} role="dialog" aria-modal="true" aria-labelledby="friends-setup-title">
    <div class="modal-overlay" role="button" tabindex="0" aria-label="Close friends setup" on:click={() => toggleSetupView(false)} on:keydown={(event) => { if (event.key === 'Enter' || event.key === ' ') toggleSetupView(false); }}></div>
    <div class="modal-content friends-setup-modal__content">
      <button id="friends-setup-close-btn" class="close-btn" aria-label="Close friends setup" on:click={() => toggleSetupView(false)}>×</button>
      <div class="friends-setup-titlebar">
        <h2 id="friends-setup-title">Friends Setup</h2>
        <p>Configure your profile and manage who appears in your sync list.</p>
      </div>

      <div class="friends-setup-layout">
        <section class="friends-setup-card friends-setup-card--profile" aria-labelledby="friends-profile-title">
          <div class="friends-setup-card__header">
            <h3 id="friends-profile-title">My Profile</h3>
            <span class="friends-setup-card__subtitle">Share your roster code and PIN so your friends can add you</span>
          </div>

          <div class="friends-self-code-row">
            <div class="friends-self-code friends-self-code--id-card">
              <span class="friends-self-label">Your roster code</span>
              <code id="friends-self-code">{maskedSelfCode}</code>
            </div>
            <label class="friends-self-color" for="friends-self-color-input" title="Roster color used for your card and character names in this tab">
              <span class="visually-hidden">Roster color for your card and character names in this tab</span>
              <input
                id="friends-self-color-input"
                type="color"
                value={selfHeatmapColor}
                aria-label="Roster color for your card and character names in this tab"
                on:input={(event) => updateSelfHeatmapColor((event.currentTarget as HTMLInputElement).value || '')}
                on:change={(event) => updateSelfHeatmapColor((event.currentTarget as HTMLInputElement).value || '')}
              />
            </label>
            <button
              id="friends-code-visibility-btn"
              class="friends-visibility-btn"
              type="button"
              title={selfCodeVisible ? 'Hide roster code' : 'Show roster code'}
              aria-label={selfCodeVisible ? 'Hide roster code' : 'Show roster code'}
              aria-pressed={selfCodeVisible}
              on:click={() => { selfCodeVisible = !selfCodeVisible; }}
            >
              {@html getVisibilityIconSvg(selfCodeVisible)}
            </button>
            <button
              id="friends-copy-code-btn"
              class={`friends-copy-code-btn ${copyFeedbackUntil > Date.now() ? 'is-copied' : ''}`}
              type="button"
              title={copyFeedbackUntil > Date.now() ? 'Copied' : 'Copy to clipboard'}
              aria-label={copyFeedbackUntil > Date.now() ? 'Copied' : 'Copy to clipboard'}
              on:click={copySelfRosterCode}
            >
              <img src="assets/icons/items/copy.svg" alt="" aria-hidden="true" />
              <span class="friends-copy-code-btn__text">{copyLabel}</span>
            </button>
          </div>

          <div class="friends-controls-row">
            <label class="friends-self-pin-label" for="friends-self-pin-input">
              <span>Your PIN</span>
              <div class="friends-self-pin-input-wrap">
                <input
                  id="friends-self-pin-input"
                  type={selfPinInputType}
                  maxlength="32"
                  bind:value={selfPin}
                  on:change={() => updateSelfPin(selfPin)}
                  placeholder="PIN for your uploads"
                />
                <button
                  id="friends-self-pin-visibility-btn"
                  class="friends-visibility-btn"
                  type="button"
                  title={selfPinVisible ? 'Hide PIN' : 'Show PIN'}
                  aria-label={selfPinVisible ? 'Hide PIN' : 'Show PIN'}
                  aria-pressed={selfPinVisible}
                  on:click={() => { selfPinVisible = !selfPinVisible; }}
                >
                  {@html getVisibilityIconSvg(selfPinVisible)}
                </button>
              </div>
            </label>
          </div>

          <button
            id="friends-upload-profile-btn"
            class="friends-profile-upload-btn"
            type="button"
            disabled={disableUpload || loading || !configured}
            title={uploadTitle}
            on:click={handleManualUpload}
          >
            {uploading ? 'Uploading...' : 'Upload Weekly'}
          </button>

          <div class="friends-profile-instructions" role="note" aria-label="Instructions">
            <span class="friends-profile-instructions__title">Instructions:</span>
            <p>Set your PIN and click Upload Weekly before sharing.</p>
            <p>Then share roster code + PIN with your friend so they can add you. The color picker sets your roster and character name color in this tab.</p>
          </div>
        </section>

        <section class="friends-setup-card friends-setup-card--friends" aria-labelledby="friends-manage-title">
          <div class="friends-setup-card__header">
            <h3 id="friends-manage-title">Manage Friends</h3>
            <span class="friends-setup-card__subtitle">Add friends to compare weekly raid progress</span>
          </div>

          <form id="friends-add-form" class="friends-add-form" autocomplete="off" on:submit|preventDefault={addFriend}>
            <input id="friends-code-input" bind:value={addRosterCode} type="text" placeholder="Friend roster code" maxlength="80" required />
            <input id="friends-pin-input" bind:value={addPin} type="password" placeholder="PIN" maxlength="32" required />
            <input id="friends-alias-input" bind:value={addAlias} type="text" placeholder="Alias (optional)" maxlength="32" />
            <button id="friends-add-btn" type="submit" disabled={refreshing || loading || !configured}>Add Friend</button>
          </form>

          <div id="friends-list" class={`friends-list ${rows.length === 0 ? 'friends-list--empty' : ''}`} aria-label="Configured friends">
            {#if rows.length === 0}
              <div class="friends-empty-state" role="status" aria-live="polite">
                <div class="friends-empty-state__icon" aria-hidden="true">⚔</div>
                <p class="friends-empty-state__text">Your friends list is empty. Add someone to compare raid progress!</p>
              </div>
            {:else}
              {#each rows as row}
                <div class="friends-list-item">
                  <span class="friends-list-item__alias" style={`color:${row.heatmapColor};`}>{row.title}</span>
                  <span class="friends-list-item__updated-at">{row.updatedAt ? `Updated at: ${formatDateTime(row.updatedAt)}` : 'Updated at: -'}</span>
                  <span class="friends-list-item__code">{row.rosterCode}</span>
                  <div class="friends-list-item__actions">
                    <input
                      class="friends-list-item__color"
                      type="color"
                      value={row.heatmapColor}
                      aria-label={`Heatmap color for ${row.title}`}
                      on:input={(event) => updateFriendHeatmapColor(row.id, (event.currentTarget as HTMLInputElement).value || '')}
                      on:change={(event) => updateFriendHeatmapColor(row.id, (event.currentTarget as HTMLInputElement).value || '')}
                    />
                    <button class="friends-list-item__remove" type="button" aria-label={`Remove ${row.title}`} on:click={() => removeFriend(row.id)}>
                      <span aria-hidden="true">🗑</span><span class="visually-hidden">Remove friend</span>
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </section>
      </div>
    </div>
  </div>

  <div id="friends-heatmap-modal" class="friends-heatmap-modal" style={friendsConfig.heatmapVisible ? 'display: block;' : 'display: none;'} role="dialog" aria-modal="true" aria-labelledby="friends-heatmap-title">
    <div class="modal-overlay" role="button" tabindex="0" aria-label="Close group view" on:click={() => toggleHeatmapView(false)} on:keydown={(event) => { if (event.key === 'Enter' || event.key === ' ') toggleHeatmapView(false); }}></div>
    <div class="modal-content friends-heatmap-modal__content">
      <button class="close-btn" aria-label="Close group view" on:click={() => toggleHeatmapView(false)}>×</button>
      <h2 id="friends-heatmap-title">Group View</h2>
      <div class="friends-heatmap" aria-label="Group raid view">
        {#if heatmapGroups.length === 0}
          <div class="friends-heatmap-empty" role="status" aria-live="polite">
            <h3>Group View is empty</h3>
            <p>Upload your weekly data in Friends Setup, then refresh friends to compare progress.</p>
          </div>
        {:else}
          <div class="friends-heatmap-dual">
            <div class="friends-heatmap-intro">
              <div class="friends-heatmap-intro__text">
                <h3 class="friends-heatmap-intro__title">Compare roster progress at a glance</h3>
                <p class="friends-heatmap-intro__meta">
                  {heatmapGroups.length} rosters • {heatmapDetailRows.length} characters • {visibleRaidIndices.length} raids
                </p>
              </div>
              <div class="friends-heatmap-legend">
                <span class="friends-heatmap-legend__item state-self-done">✓ Completed</span>
                <span class="friends-heatmap-legend__item state-self-available">● Available</span>
                <span class="friends-heatmap-legend__item state-none">- Hidden</span>
                <span class="friends-heatmap-legend__item state-progress">0/x Progress</span>
              </div>
            </div>

            <h3 class="friends-heatmap-section-title">Roster Summary</h3>
            <div class="friends-heatmap-wrap friends-heatmap-wrap--primary">
              <table class="friends-heatmap-table friends-heatmap-table--summary" on:mouseleave={() => { summaryHoveredRow = '-2'; summaryHoveredCol = '-2'; }}>
                <thead>
                  <tr>
                    <th>ROSTER</th>
                    {#each visibleRaidIndices as raidIndex, columnIndex}
                      {@const raid = RAID_CONFIG[raidIndex] as any}
                      {@const colId = String(columnIndex)}
                      <th class:is-hover-col={shouldHighlightCol(colId, summaryHoveredCol)}>
                        {FRIENDS_RAID_LABELS[String(raid?.id || '')] || String(raid?.id || '').toUpperCase()}
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each heatmapGroups as group, rowIndex}
                    {@const rowId = String(rowIndex)}
                    <tr style={`--friends-row-color:${group.color || '#64b5f6'};`} class:friends-heatmap-group={group.isSelf} class:is-self={group.isSelf}>
                      <th
                        class={`friends-heatmap-roster${group.isSelf ? ' is-self' : ''} ${shouldHighlightRow(rowId, summaryHoveredRow) ? 'is-hover-row' : ''}`}
                        on:pointerenter={() => { summaryHoveredRow = rowId; summaryHoveredCol = '-1'; }}
                      >
                        {group.name}
                      </th>
                      {#each visibleRaidIndices as raidIndex, columnIndex}
                        {@const colId = String(columnIndex)}
                        {@const counts = getRosterSummaryCounts(group.characters, raidIndex)}
                        {@const state = resolveRosterSummaryState(counts.doneCount, counts.visibleCount)}
                        <td
                          class={`friends-heatmap-cell ${state.className} ${shouldHighlightRow(rowId, summaryHoveredRow) ? 'is-hover-row' : ''} ${shouldHighlightCol(colId, summaryHoveredCol) ? 'is-hover-col' : ''}`}
                          title={state.label}
                          on:pointerenter={() => { summaryHoveredRow = rowId; summaryHoveredCol = colId; }}
                        >
                          {state.text}
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <h3 class="friends-heatmap-section-title">Characters Detail</h3>
            <div class="friends-heatmap-wrap friends-heatmap-wrap--secondary">
              <table class="friends-heatmap-table friends-heatmap-table--detail" on:mouseleave={() => { detailHoveredRow = '-2'; detailHoveredCol = '-2'; }}>
                <thead>
                  <tr>
                    <th>CHAR</th>
                    {#each visibleRaidIndices as raidIndex, columnIndex}
                      {@const raid = RAID_CONFIG[raidIndex] as any}
                      {@const colId = String(columnIndex)}
                      <th class:is-hover-col={shouldHighlightCol(colId, detailHoveredCol)}>
                        {FRIENDS_RAID_LABELS[String(raid?.id || '')] || String(raid?.id || '').toUpperCase()}
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each heatmapDetailRows as entry, rowIndex (entry.id)}
                    {@const rowId = String(rowIndex)}
                    <tr style={`--friends-char-color:${entry.group?.color || 'var(--color-text)'};`}>
                      <th
                        class={`friends-heatmap-char-name ${shouldHighlightRow(rowId, detailHoveredRow) ? 'is-hover-row' : ''}`}
                        on:pointerenter={() => { detailHoveredRow = rowId; detailHoveredCol = '-1'; }}
                      >
                        {entry.character?.name || '—'}
                      </th>
                      {#each visibleRaidIndices as raidIndex, columnIndex}
                        {@const colId = String(columnIndex)}
                        {@const state = resolveDetailedState(entry.character, raidIndex)}
                        <td
                          class={`friends-heatmap-cell ${state.className} ${shouldHighlightRow(rowId, detailHoveredRow) ? 'is-hover-row' : ''} ${shouldHighlightCol(colId, detailHoveredCol) ? 'is-hover-col' : ''}`}
                          title={state.label}
                          on:pointerenter={() => { detailHoveredRow = rowId; detailHoveredCol = colId; }}
                        >
                          {state.text}
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>
