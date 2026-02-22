import { RAID_CONFIG, WEEKLY_RESET } from '../../../legacy/config/constants.js';
import { getHiddenRaidIdsForSettings, getVisibleRaidIndices, normalizeRaidKey } from '../../../domain/shared/raidDomain';

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_FRIENDS_PROXY_URL = 'https://friendsweekly.ychainstyle.workers.dev';

type CharacterSnapshot = {
  name: string;
  sortIndex: number;
  raidMask: number;
  visibleMask: number;
  hiddenMask?: number;
};

type SelfSnapshot = {
  weekKey: string;
  rosterCode: string;
  rosterName: string;
  raidIds: string[];
  visibleRaidIndices: number[];
  characters: CharacterSnapshot[];
};

type FriendSnapshot = {
  weekKey: string;
  rosterCode: string;
  rosterName: string;
  raidIds: string[];
  characters: CharacterSnapshot[];
  updatedAt: string | null;
};

type UploadResult = {
  uploaded: number;
  weekKey: string;
  fingerprint: string;
  rosterCode?: string;
  raidIds?: string[];
  skipped?: boolean;
};

type FetchFriendParams = {
  rosterCode: string;
  pin: string;
};

type WeeklyTrackerLike = {
  characterData?: Record<string, Record<string, any>>;
  getBosses?: () => string[];
  getHiddenRaidIds?: () => string[];
  isCharacterEligible?: (ilvl: number, bossId: string) => boolean | undefined;
};

type RosterManagerLike = {
  roster?: Record<string, any>;
  rosterOrder?: string[];
};

type StateManagerLike = {
  get: (key: string) => any;
  getActiveRosterId?: () => string | null;
  multiRosterManager?: {
    getRosters?: () => Array<{ id: string; name?: string }>;
  };
};

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getWeekStartUtc(now = new Date()): Date {
  const result = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    WEEKLY_RESET.HOUR_UTC,
    0,
    0,
    0,
  ));

  const dayDiff = (result.getUTCDay() - WEEKLY_RESET.DAY_OF_WEEK + 7) % 7;
  result.setUTCDate(result.getUTCDate() - dayDiff);

  if (now.getTime() < result.getTime()) {
    result.setUTCDate(result.getUTCDate() - 7);
  }

  return result;
}

function getWeekKey(now = new Date()): string {
  const start = getWeekStartUtc(now);
  const year = start.getUTCFullYear();
  const month = String(start.getUTCMonth() + 1).padStart(2, '0');
  const day = String(start.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class FriendsRosterService {
  private weeklyTracker: WeeklyTrackerLike;
  private rosterManager: RosterManagerLike;
  private state: StateManagerLike;
  private proxyUrl: string;
  private supabaseUrl: string;
  private supabaseAnonKey: string;
  private uploadRpc: string;
  private fetchRpc: string;

  constructor(weeklyTracker: WeeklyTrackerLike, rosterManager: RosterManagerLike, stateManager: StateManagerLike) {
    this.weeklyTracker = weeklyTracker;
    this.rosterManager = rosterManager;
    this.state = stateManager;

    this.proxyUrl = (import.meta.env.VITE_FRIENDS_PROXY_URL || DEFAULT_FRIENDS_PROXY_URL).replace(/\/$/, '');
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    this.supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    this.uploadRpc = import.meta.env.VITE_SUPABASE_FRIENDS_UPLOAD_RPC || 'upsert_friends_weekly_payload';
    this.fetchRpc = import.meta.env.VITE_SUPABASE_FRIENDS_FETCH_RPC || 'get_friends_weekly';
  }

  isConfigured(): boolean {
    return Boolean(this.proxyUrl || (this.supabaseUrl && this.supabaseAnonKey));
  }

  getCurrentWeekKey(): string {
    return getWeekKey();
  }

  getSelfRosterCode(): string {
    return this.state.getActiveRosterId?.() || '';
  }

  getSelfRosterName(): string {
    const activeRosterId = this.state.getActiveRosterId?.();
    const rosters = this.state.multiRosterManager?.getRosters?.() || [];
    const active = rosters.find((roster) => roster.id === activeRosterId);
    return active?.name || 'Main Roster';
  }

  getVisibleRaidIndices(): number[] {
    const hiddenRaidIds = this.getHiddenRaidIdSet();
    return getVisibleRaidIndices(RAID_CONFIG as Array<any>, hiddenRaidIds);
  }

  getHiddenRaidIdSet(): Set<string> {
    const hiddenRaidIds = new Set(
      (this.weeklyTracker.getHiddenRaidIds?.() || [])
        .map((value: string) => normalizeRaidKey(value, RAID_CONFIG as Array<any>, { allowUnknown: false }))
        .filter(Boolean),
    );

    const settings = this.state.get('settings') || {};
    const activeId = this.state.getActiveRosterId?.();

    const fromSettings = getHiddenRaidIdsForSettings(settings, String(activeId || ''), RAID_CONFIG as Array<any>);
    fromSettings.forEach((raidId) => hiddenRaidIds.add(raidId));

    return hiddenRaidIds;
  }

  getVisibleRaidMask(): number {
    return this.getVisibleRaidIndices().reduce((mask, index) => mask | (1 << index), 0);
  }

  buildSelfSnapshot(): SelfSnapshot {
    const roster = this.rosterManager.roster || {};
    const order = Array.isArray(this.rosterManager.rosterOrder) ? this.rosterManager.rosterOrder : [];
    const characterData = this.weeklyTracker.characterData || {};
    const bosses = this.weeklyTracker.getBosses?.() || [];
    const visibleRaidIndices = this.getVisibleRaidIndices();
    const visibleRaidIndexSet = new Set(visibleRaidIndices);

    const names = order.length > 0
      ? order
      : Object.keys(roster).filter((name) => name !== 'dailyData');

    const characters: CharacterSnapshot[] = names
      .filter((name) => roster[name] && name !== 'dailyData')
      .map((name, orderIndex) => {
        const charRaids = characterData[name] || {};
        const charInfo = roster[name] || {};
        let raidMask = 0;
        let hiddenMask = 0;
        let visibleMask = 0;

        bosses.forEach((boss, index) => {
          const raidId = RAID_CONFIG[index]?.id;
          const bossData = this.resolveCharacterRaidData(charRaids, boss, raidId);
          const isVisibleInColumns = visibleRaidIndexSet.has(index);
          const isEligible = this.weeklyTracker.isCharacterEligible?.(charInfo?.ilvl, raidId) ?? true;

          if (isVisibleInColumns && isEligible && !bossData?.hidden) {
            visibleMask |= (1 << index);
          }

          if (bossData?.hidden && isVisibleInColumns) {
            hiddenMask |= (1 << index);
          }

          if (bossData?.cleared && isVisibleInColumns && isEligible) {
            raidMask |= (1 << index);
          }
        });

        return {
          name,
          sortIndex: orderIndex,
          raidMask,
          visibleMask,
          hiddenMask,
        };
      });

    return {
      weekKey: this.getCurrentWeekKey(),
      rosterCode: this.getSelfRosterCode(),
      rosterName: this.getSelfRosterName(),
      raidIds: RAID_CONFIG.map((raid: any) => raid.id),
      visibleRaidIndices,
      characters,
    };
  }

  private resolveCharacterRaidData(charRaids: Record<string, any>, bossName: string, raidId: string): Record<string, any> | null {
    const safeRaids = (charRaids && typeof charRaids === 'object') ? charRaids : {};
    const directCandidates = [
      String(bossName || ''),
      String(raidId || ''),
      this.toTitleCase(raidId),
      String(raidId || '').toUpperCase(),
    ].filter(Boolean);

    for (const key of directCandidates) {
      if (safeRaids[key] && typeof safeRaids[key] === 'object') {
        return safeRaids[key];
      }
    }

    const targetId = normalizeRaidKey(raidId || bossName, RAID_CONFIG as Array<any>, { allowUnknown: true });
    if (!targetId) {
      return null;
    }

    for (const [key, value] of Object.entries(safeRaids)) {
      if (!value || typeof value !== 'object') {
        continue;
      }

      if (normalizeRaidKey(key, RAID_CONFIG as Array<any>, { allowUnknown: true }) === targetId) {
        return value as Record<string, any>;
      }
    }

    return null;
  }

  private toTitleCase(value: unknown): string {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }

    return `${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}`;
  }

  async hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(pin || '').trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return toHex(hashBuffer);
  }

  buildSyncFingerprint(snapshot: SelfSnapshot, pinHash: string): string {
    const normalized = {
      weekKey: snapshot.weekKey,
      rosterCode: snapshot.rosterCode,
      pinHash,
      characters: [...snapshot.characters]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((character) => ({
          name: character.name,
          sortIndex: Number.isInteger(character.sortIndex) ? character.sortIndex : 999,
          raidMask: character.raidMask,
          visibleMask: character.visibleMask,
        })),
    };

    return JSON.stringify(normalized);
  }

  async uploadSelfWeekly(pin: string): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error('Friends sync is not configured. Set VITE_FRIENDS_PROXY_URL or Supabase env vars.');
    }

    const snapshot = this.buildSelfSnapshot();
    if (!snapshot.rosterCode) {
      throw new Error('No active roster selected.');
    }

    const pinHash = await this.hashPin(pin);
    const visibleRaidMask = this.getVisibleRaidMask();
    const rows = snapshot.characters.map((character) => ({
      char_name: character.name,
      sort_index: Number.isInteger(character.sortIndex) ? character.sortIndex : 999,
      raid_mask: character.raidMask & visibleRaidMask,
      visible_mask: character.visibleMask & visibleRaidMask,
    }));

    if (!rows.length) {
      return { uploaded: 0, fingerprint: this.buildSyncFingerprint(snapshot, pinHash), weekKey: snapshot.weekKey };
    }

    const requestPayload = {
      p_week_key: snapshot.weekKey,
      p_roster_code: snapshot.rosterCode,
      p_roster_name: snapshot.rosterName,
      p_pin_hash: pinHash,
      p_payload: rows,
    };

    const response = this.proxyUrl
      ? await this.requestProxy('/proxy/friends/upload', requestPayload)
      : await this.requestSupabaseRpc(this.uploadRpc, requestPayload);

    if (!response.ok) {
      const details = await this.extractErrorMessage(response);
      throw new Error(`Friends upload failed (${response.status}): ${details}`);
    }

    const responseBody = await response.json().catch(() => null);
    const skipped = Boolean(responseBody?.skipped || responseBody?.data?.skipped);

    return {
      uploaded: skipped ? 0 : rows.length,
      weekKey: snapshot.weekKey,
      fingerprint: this.buildSyncFingerprint(snapshot, pinHash),
      rosterCode: snapshot.rosterCode,
      raidIds: snapshot.raidIds,
      skipped,
    };
  }

  async fetchFriendWeekly({ rosterCode, pin }: FetchFriendParams): Promise<FriendSnapshot> {
    if (!this.isConfigured()) {
      throw new Error('Friends sync is not configured. Set VITE_FRIENDS_PROXY_URL or Supabase env vars.');
    }

    const safeRosterCode = String(rosterCode || '').trim();
    const pinHash = await this.hashPin(pin);
    const weekKey = this.getCurrentWeekKey();
    const visibleRaidMask = this.getVisibleRaidMask();

    const requestPayload = {
      p_week_key: weekKey,
      p_roster_code: safeRosterCode,
      p_pin_hash: pinHash,
    };

    const response = this.proxyUrl
      ? await this.requestProxy('/proxy/friends/get', requestPayload)
      : await this.requestSupabaseRpc(this.fetchRpc, requestPayload);

    if (!response.ok) {
      const details = await this.extractErrorMessage(response);
      throw new Error(`Friends fetch failed (${response.status}): ${details}`);
    }

    const responseBody = await response.json();
    const rows = Array.isArray(responseBody)
      ? responseBody
      : (Array.isArray(responseBody?.rows) ? responseBody.rows : []);

    const characters: CharacterSnapshot[] = rows
      .map((row: any, index: number) => ({
        name: row.char_name,
        sortIndex: Number.isInteger(row.sort_index) ? row.sort_index : index,
        raidMask: (Number(row.raid_mask) || 0) & visibleRaidMask,
        visibleMask: ((row.visible_mask === null || row.visible_mask === undefined)
          ? visibleRaidMask
          : (Number(row.visible_mask) || 0)) & visibleRaidMask,
      }))
      .sort((a: CharacterSnapshot, b: CharacterSnapshot) => {
        if (a.sortIndex !== b.sortIndex) {
          return a.sortIndex - b.sortIndex;
        }
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

    return {
      weekKey,
      rosterCode: safeRosterCode,
      rosterName: rows?.[0]?.roster_name || safeRosterCode,
      raidIds: RAID_CONFIG.map((raid: any) => raid.id),
      characters,
      updatedAt: rows?.[0]?.updated_at || null,
    };
  }

  private async requestProxy(path: string, payload: unknown): Promise<Response> {
    const url = `${this.proxyUrl}${path}`;
    return this.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  private async requestSupabaseRpc(rpcName: string, payload: unknown): Promise<Response> {
    const url = `${this.supabaseUrl}/rest/v1/rpc/${rpcName}`;
    return this.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.supabaseAnonKey,
        Authorization: `Bearer ${this.supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
    });
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort('friends-timeout'), DEFAULT_TIMEOUT_MS);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    try {
      const payload = await response.clone().json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
      if (payload?.details) return String(payload.details);
      return JSON.stringify(payload);
    } catch {
      try {
        const text = await response.clone().text();
        return text || response.statusText || 'Unknown error';
      } catch {
        return response.statusText || 'Unknown error';
      }
    }
  }
}
