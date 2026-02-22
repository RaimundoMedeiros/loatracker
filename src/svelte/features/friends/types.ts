export interface FriendEntry {
  id: string;
  rosterCode: string;
  pin: string;
  alias?: string;
  heatmapColor?: string;
}

export interface FriendCharacterSnapshot {
  name: string;
  sortIndex: number;
  raidMask: number;
  visibleMask: number;
}

export interface FriendSnapshot {
  weekKey: string;
  rosterCode: string;
  rosterName: string;
  raidIds: string[];
  characters: FriendCharacterSnapshot[];
  updatedAt: string | null;
}

export interface FriendsRosterConfig {
  autoSyncEnabled: boolean;
  heatmapVisible: boolean;
  friends: FriendEntry[];
  selfPinsByRoster: Record<string, string>;
  selfHeatmapColorByRoster: Record<string, string>;
  lastUploadFingerprintByRoster: Record<string, string>;
  friendSnapshotsByFriendId: Record<string, FriendSnapshot>;
  friendSnapshotFetchedAtByFriendId: Record<string, number>;
}
