<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import { onDestroy, onMount } from 'svelte';
  import { UIHelper } from '../../utils/uiHelper';
  import { rosterChangeVersion } from '../../stores/rosterSync';
  import { RAID_CONFIG, TOAST_TYPES } from '../../legacy/config/constants.js';
  import { reportError } from '../../utils/errorHandler';
  import { ERROR_CODES } from '../../utils/errorCodes';
  import { withAsyncError } from '../../utils/errorWrappers';
  import { FriendsStateService } from '../../services/FriendsStateService';
  import { FriendsRosterService } from './services/FriendsRosterService';
  import {
    DEFAULT_FRIENDS_CONFIG,
    normalizeFriendsConfig,
    sanitizeCachedSnapshot,
    shouldRefreshByTtl,
  } from './config';
  import FriendsCards from './components/FriendsCards.svelte';
  import FriendsSetupModal from './components/FriendsSetupModal.svelte';
  import FriendsHeatmapModal from './components/FriendsHeatmapModal.svelte';
  import type { FriendSnapshot, FriendsRosterConfig } from './types';
  import type {
    FriendGridCard,
    FriendRow,
    HeatmapDetailRow,
    HeatmapGroup,
    RaidCellState,
    SyncBadgeState,
  } from './viewModels';

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
  let _disableUpload = true;
  let _uploadTitle = '';
  let _disableSetupUpload = true;
  let editingAliasFriendId = '';
  let aliasDraft = '';
  let rows: FriendRow[] = [];
  let heatmapGroups: HeatmapGroup[] = [];
  let heatmapDetailRows: HeatmapDetailRow[] = [];
  let gridCards: FriendGridCard[] = [];
  let visibleRaidIndices: number[] = RAID_CONFIG.map((_: any, index: number) => index);

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

  function getRaidConfigAt(raidIndex: number): { id?: string } | undefined {
    return RAID_CONFIG[raidIndex] as { id?: string } | undefined;
  }

  const friendSnapshots = new SvelteMap<string, FriendSnapshot>();
  const ui = new UIHelper();
  let friendsState: FriendsStateService | null = null;
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

  function getSavedPin() {
    return resolveSelfPin(friendsConfig);
  }

  function getActivePin() {
    return String(selfPin || getSavedPin() || '').trim();
  }

  function isPinMissing() {
    return getActivePin().length < MIN_PIN_LENGTH;
  }

  function getUploadRemainingSec() {
    return Math.ceil(getUploadCooldownRemainingMs() / 1000);
  }

  function getRefreshRemainingSec() {
    return Math.ceil(getRefreshCooldownRemainingMs() / 1000);
  }

  function isUploadLocked() {
    return getUploadRemainingSec() > 0;
  }

  function isRefreshLocked() {
    return getRefreshRemainingSec() > 0;
  }

  function getDisableUpload() {
    return isBusy || isUploadLocked() || isPinMissing();
  }

  function getDisableRefresh() {
    return isBusy || isRefreshLocked();
  }

  function getUploadTitle() {
    if (isPinMissing()) {
      return 'Set your PIN first';
    }

    if (isUploadLocked()) {
      return `Available in ${Math.max(0, getUploadRemainingSec())}s`;
    }

    return 'Upload your weekly to friends sync';
  }

  function getRefreshTitle() {
    return isRefreshLocked() ? `Available in ${Math.max(0, getRefreshRemainingSec())}s` : '';
  }

  function getCopyLabel() {
    return copyFeedbackUntil > Date.now() ? 'Copied!' : 'Copy';
  }

  function getMaskedSelfCode() {
    return selfCodeVisible ? (selfCode || '-') : '******';
  }

  function getSelfPinInputType(): 'text' | 'password' {
    return selfPinVisible ? 'text' : 'password';
  }

  // Svelte 4 only tracks variables referenced DIRECTLY in $: expressions,
  // not inside function bodies. Inline the expressions or void-reference the deps.
  $: _maskedSelfCode = selfCodeVisible ? (selfCode || '-') : '******';
  $: _selfPinInputType = selfPinVisible ? 'text' : 'password';
  $: {
    // Reference every reactive variable these helpers depend on so Svelte re-runs the block.
    void selfPin; void cooldownNow; void isBusy; void uploadCooldownUntil;
    _disableUpload = getDisableUpload();
    _uploadTitle = getUploadTitle();
  }
  $: {
    // Setup modal: no cooldown gate, only busy + PIN check
    void selfPin; void isBusy; void friendsConfig;
    _disableSetupUpload = isBusy || getActivePin().length < MIN_PIN_LENGTH;
  }

  async function initialize() {
    loading = true;
    message = '';

    try {
      await (window as any).__API_READY__;

      friendsState = new FriendsStateService(window.api);
      await friendsState.initialize();

      friendsService = new FriendsRosterService(
        friendsState.toWeeklyTrackerAdapter(),
        friendsState.toRosterManagerAdapter(),
        friendsState.toStateAdapter(),
      );
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
      message = `Failed to initialize Friends: ${error?.message || error}`;
    } finally {
      loading = false;
    }
  }

  async function handleActiveRosterChanged() {
    if (!friendsState) {
      return;
    }

    try {
      loading = true;
      message = '';

      await friendsState.reloadActiveRosterContext();

      friendsService = new FriendsRosterService(
        friendsState.toWeeklyTrackerAdapter(),
        friendsState.toRosterManagerAdapter(),
        friendsState.toStateAdapter(),
      );
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
          rosterId: String(friendsState?.getActiveRosterId() || ''),
        },
        showToast: false,
      });
      message = error?.message || 'Failed to refresh friends roster data.';
    } finally {
      loading = false;
    }
  }

  function getFriendsConfig(): FriendsRosterConfig {
    const settings = friendsState?.get('settings') || {};
    return {
      ...DEFAULT_FRIENDS_CONFIG,
      ...normalizeFriendsConfig((settings as any).friendsRoster),
    };
  }

  function saveFriendsConfig(nextConfig: FriendsRosterConfig) {
    if (!friendsState) return;

    const settings = friendsState.get('settings') || {};
    friendsState.setState({
      settings: {
        ...settings,
        friendsRoster: nextConfig,
      },
    });

    void friendsState.saveSettings((friendsState.get('settings') || {}) as any).catch((error) => {
      void reportError(error, {
        code: ERROR_CODES.FRIENDS.SAVE_CONFIG_FAILED,
        severity: 'warning',
        context: {
          phase: 'saveFriendsConfig',
          action: 'persist-friends-config',
          rosterId: String(friendsState?.getActiveRosterId() || ''),
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
        const isDone = ((character?.raidMask || 0) & (1 << raidIndex)) !== 0;

        if (!visible && !isDone) {
          return;
        }

        total += 1;
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
    const done = ((character?.raidMask || 0) & (1 << raidIndex)) !== 0;

    if (!visible) {
      if (done) {
        return { className: 'state-hidden-done', text: '✓', label: 'Completed (hidden from gold)' };
      }
      return { className: 'state-none', text: '-', label: 'Hidden for this character' };
    }

    if (done) {
      return { className: 'state-self-done', text: '✓', label: 'Completed' };
    }

    return { className: 'state-self-available', text: '●', label: 'Available and not completed' };
  }

  function getRosterSummaryCounts(characters: FriendSnapshot['characters'], raidIndex: number) {
    const safeChars = Array.isArray(characters) ? characters : [];
    const visibleCount = safeChars.reduce((count, character) => {
      const visible = ((character?.visibleMask || 0) & (1 << raidIndex)) !== 0;
      const done = ((character?.raidMask || 0) & (1 << raidIndex)) !== 0;
      return count + ((visible || done) ? 1 : 0);
    }, 0);

    const doneCount = safeChars.reduce((count, character) => {
      const visible = ((character?.visibleMask || 0) & (1 << raidIndex)) !== 0;
      const done = ((character?.raidMask || 0) & (1 << raidIndex)) !== 0;
      if (!visible && !done) return count;
      return count + (done ? 1 : 0);
    }, 0);

    return { doneCount, visibleCount };
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

  function getColorInputValue(event: Event): string {
    const target = event.currentTarget as HTMLInputElement | null;
    return String(target?.value || '').trim();
  }

  function handleSelfHeatmapColorEvent(event: Event) {
    updateSelfHeatmapColor(getColorInputValue(event));
  }

  function handleFriendHeatmapColorEvent(friendId: string, event: Event) {
    updateFriendHeatmapColor(friendId, getColorInputValue(event));
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

    scheduleAutoSync();
  }

  async function handleManualUpload() {
    if (!friendsService) return;
    const service = friendsService;

    const cooldownMs = getUploadCooldownRemainingMs();
    if (cooldownMs > 0) {
      showToast(`Please wait ${Math.ceil(cooldownMs / 1000)}s before uploading again.`, TOAST_TYPES.INFO);
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

  async function handleSetupUpload() {
    if (!friendsService) return;
    const service = friendsService;

    const currentSelfCode = service.getSelfRosterCode();
    if (!currentSelfCode) {
      showToast('Select a roster before uploading weekly data.', TOAST_TYPES.WARNING);
      return;
    }

    if (!service.isConfigured()) {
      showToast('Configure Supabase env vars before uploading.', TOAST_TYPES.WARNING);
      return;
    }

    const pin = getActivePin();
    if (!pin || pin.length < MIN_PIN_LENGTH) {
      showToast('Set your PIN in Friends Roster before uploading.', TOAST_TYPES.WARNING);
      return;
    }

    setBusy(true);
    uploading = true;

    const result = await withAsyncError(
      () => service.uploadSelfWeekly(pin),
      {
        code: ERROR_CODES.FRIENDS.UPLOAD_FAILED,
        severity: 'error',
        context: {
          phase: 'handleSetupUpload',
          action: 'setup-upload-weekly',
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

  function startEditingFriendAlias(friendId: string) {
    const friend = friendsConfig.friends.find((entry) => entry.id === friendId);
    if (!friend) {
      return;
    }

    editingAliasFriendId = friendId;
    aliasDraft = String(friend.alias || '').trim();
  }

  function cancelEditingFriendAlias() {
    editingAliasFriendId = '';
    aliasDraft = '';
  }

  function saveEditingFriendAlias(friendId: string) {
    const friend = friendsConfig.friends.find((entry) => entry.id === friendId);
    if (!friend) {
      cancelEditingFriendAlias();
      return;
    }

    const nextAlias = String(aliasDraft || '').trim().slice(0, 32);

    saveFriendsConfig({
      ...friendsConfig,
      friends: friendsConfig.friends.map((entry) => {
        if (entry.id !== friendId) {
          return entry;
        }

        return {
          ...entry,
          alias: nextAlias || undefined,
        };
      }),
    });

    cancelEditingFriendAlias();
    recomputeUiModels();
    showToast(nextAlias ? 'Alias updated.' : 'Alias cleared.', TOAST_TYPES.SUCCESS);
  }

  async function refreshFriends(showToastFeedback: boolean) {
    const service = friendsService;
    if (!service) return;

    if (showToastFeedback) {
      const remainingMs = getRefreshCooldownRemainingMs();
      if (remainingMs > 0) {
        showToast(`Please wait ${Math.ceil(remainingMs / 1000)}s before refreshing again.`, TOAST_TYPES.INFO);
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
          rosterId: String(friendsState?.getActiveRosterId() || ''),
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

  function toggleSelfCodeVisibility() {
    selfCodeVisible = !selfCodeVisible;
  }

  function toggleSelfPinVisibility() {
    selfPinVisible = !selfPinVisible;
  }

  function updateSelfPinInput(nextValue: string) {
    selfPin = String(nextValue || '');
  }

  function updateAddRosterCode(nextValue: string) {
    addRosterCode = String(nextValue || '');
  }

  function updateAddPin(nextValue: string) {
    addPin = String(nextValue || '');
  }

  function updateAddAlias(nextValue: string) {
    addAlias = String(nextValue || '');
  }

  function updateAliasDraft(nextValue: string) {
    aliasDraft = String(nextValue || '');
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
          disabled={_disableUpload || loading || !configured}
          title={_uploadTitle}
          on:click={handleManualUpload}
        >
          <span class="btn-label">{uploading ? 'Uploading...' : 'Upload Weekly'}</span>
        </button>

        <button
          id="friends-refresh-btn"
          class="header-icon-btn"
          type="button"
          on:click={onManualRefresh}
          disabled={getDisableRefresh() || loading || !configured}
          title={getRefreshTitle()}
        >
          <span class="btn-label">{refreshing ? 'Refreshing...' : 'Refresh Friends'}</span>
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

  <FriendsCards
    {loading}
    {message}
    {gridCards}
    {visibleRaidIndices}
    friendsRaidLabels={FRIENDS_RAID_LABELS}
    {computeCardRaidProgress}
    {resolveCardSyncState}
    {getRaidConfigAt}
  />

  <FriendsSetupModal
    visible={setupVisible}
    maskedSelfCode={_maskedSelfCode}
    {selfHeatmapColor}
    {selfCodeVisible}
    copyFeedbackActive={copyFeedbackUntil > Date.now()}
    copyLabel={getCopyLabel()}
    {selfPin}
    selfPinInputType={_selfPinInputType}
    {selfPinVisible}
    disableUpload={_disableSetupUpload}
    {loading}
    {configured}
    uploadTitle={_disableSetupUpload ? 'Set your PIN first' : 'Upload your weekly to friends sync'}
    {uploading}
    {addRosterCode}
    {addPin}
    {addAlias}
    {refreshing}
    {rows}
    {editingAliasFriendId}
    {aliasDraft}
    {formatDateTime}
    onClose={() => toggleSetupView(false)}
    onSelfColorInput={handleSelfHeatmapColorEvent}
    onToggleSelfCodeVisibility={toggleSelfCodeVisibility}
    onCopySelfCode={copySelfRosterCode}
    onSelfPinInput={updateSelfPinInput}
    onSelfPinChange={() => updateSelfPin(selfPin)}
    onToggleSelfPinVisibility={toggleSelfPinVisibility}
    onUpload={handleSetupUpload}
    onAddRosterCodeInput={updateAddRosterCode}
    onAddPinInput={updateAddPin}
    onAddAliasInput={updateAddAlias}
    onAddFriend={addFriend}
    onStartEditingAlias={startEditingFriendAlias}
    onAliasDraftInput={updateAliasDraft}
    onSaveEditingAlias={saveEditingFriendAlias}
    onCancelEditingAlias={cancelEditingFriendAlias}
    onFriendColorInput={handleFriendHeatmapColorEvent}
    onRemoveFriend={removeFriend}
  />

  <FriendsHeatmapModal
    visible={friendsConfig.heatmapVisible}
    {heatmapGroups}
    {heatmapDetailRows}
    {visibleRaidIndices}
    friendsRaidLabels={FRIENDS_RAID_LABELS}
    {getRaidConfigAt}
    {getRosterSummaryCounts}
    {resolveRosterSummaryState}
    {resolveDetailedState}
    onClose={() => toggleHeatmapView(false)}
  />
</section>
