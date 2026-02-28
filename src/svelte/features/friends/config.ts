import type { FriendSnapshot, FriendsRosterConfig } from './types';

export const FRIEND_SNAPSHOT_CACHE_TTL_MS = 15 * 60 * 1000;

export const DEFAULT_FRIENDS_CONFIG: FriendsRosterConfig = {
  autoSyncEnabled: false,
  heatmapVisible: false,
  friends: [],
  selfPinsByRoster: {},
  selfHeatmapColorByRoster: {},
  lastUploadFingerprintByRoster: {},
  friendSnapshotsByFriendId: {},
  friendSnapshotFetchedAtByFriendId: {},
};

export function normalizeFriendsConfig(raw: unknown): FriendsRosterConfig {
  const safe = raw && typeof raw === 'object' ? (raw as Partial<FriendsRosterConfig>) : {};

  return {
    autoSyncEnabled: Boolean(safe.autoSyncEnabled),
    heatmapVisible: Boolean(safe.heatmapVisible),
    friends: Array.isArray(safe.friends) ? safe.friends : [],
    selfPinsByRoster: isRecord(safe.selfPinsByRoster) ? safe.selfPinsByRoster : {},
    selfHeatmapColorByRoster: isRecord(safe.selfHeatmapColorByRoster) ? safe.selfHeatmapColorByRoster : {},
    lastUploadFingerprintByRoster: isRecord(safe.lastUploadFingerprintByRoster) ? safe.lastUploadFingerprintByRoster : {},
    friendSnapshotsByFriendId: isRecord(safe.friendSnapshotsByFriendId) ? safe.friendSnapshotsByFriendId : {},
    friendSnapshotFetchedAtByFriendId: isRecord(safe.friendSnapshotFetchedAtByFriendId)
      ? safe.friendSnapshotFetchedAtByFriendId
      : {},
  };
}

export function sanitizeCachedSnapshot(rawSnapshot: unknown): FriendSnapshot | null {
  if (!rawSnapshot || typeof rawSnapshot !== 'object') {
    return null;
  }

  const raw = rawSnapshot as Partial<FriendSnapshot>;
  const characters = Array.isArray(raw.characters)
    ? raw.characters
      .map((character, index) => ({
        name: String(character?.name || '').trim(),
        sortIndex: Number.isInteger(character?.sortIndex) ? character.sortIndex : index,
        raidMask: Number(character?.raidMask) || 0,
        visibleMask: Number(character?.visibleMask) || 0,
        diffMask: Number(character?.diffMask) || 0,
        maxDiffMask: Number(character?.maxDiffMask) || 0,
      }))
      .filter((character) => Boolean(character.name))
    : [];

  if (characters.length === 0) {
    return null;
  }

  return {
    weekKey: String(raw.weekKey || ''),
    rosterCode: String(raw.rosterCode || ''),
    rosterName: String(raw.rosterName || raw.rosterCode || ''),
    raidIds: Array.isArray(raw.raidIds) ? raw.raidIds.map((raidId) => String(raidId || '')) : [],
    characters,
    updatedAt: raw.updatedAt || null,
  };
}

export function shouldRefreshByTtl(config: FriendsRosterConfig, snapshots: Map<string, FriendSnapshot>, currentWeekKey: string): boolean {
  if (!config.friends.length) {
    return false;
  }

  const now = Date.now();
  const fetchedAtByFriendId = config.friendSnapshotFetchedAtByFriendId || {};

  return config.friends.some((friend) => {
    const snapshot = snapshots.get(friend.id);
    if (!snapshot) {
      return true;
    }

    if (currentWeekKey && snapshot.weekKey !== currentWeekKey) {
      return true;
    }

    const fetchedAt = Number(fetchedAtByFriendId[friend.id]) || 0;
    if (!fetchedAt) {
      return true;
    }

    return (now - fetchedAt) >= FRIEND_SNAPSHOT_CACHE_TTL_MS;
  });
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
