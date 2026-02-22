import { RAID_CONFIG, WEEKLY_RESET } from '../config/constants.js';

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_FRIENDS_PROXY_URL = 'https://friendsweekly.ychainstyle.workers.dev';

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getWeekStartUtc(now = new Date()) {
  const result = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    WEEKLY_RESET.HOUR_UTC,
    0,
    0,
    0
  ));

  const dayDiff = (result.getUTCDay() - WEEKLY_RESET.DAY_OF_WEEK + 7) % 7;
  result.setUTCDate(result.getUTCDate() - dayDiff);

  if (now.getTime() < result.getTime()) {
    result.setUTCDate(result.getUTCDate() - 7);
  }

  return result;
}

function getWeekKey(now = new Date()) {
  const start = getWeekStartUtc(now);
  const year = start.getUTCFullYear();
  const month = String(start.getUTCMonth() + 1).padStart(2, '0');
  const day = String(start.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class FriendsRosterService {
  constructor(weeklyTracker, rosterManager, stateManager) {
    this.weeklyTracker = weeklyTracker;
    this.rosterManager = rosterManager;
    this.state = stateManager;

    this.proxyUrl = (import.meta.env.VITE_FRIENDS_PROXY_URL || DEFAULT_FRIENDS_PROXY_URL).replace(/\/$/, '');
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    this.supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    this.uploadRpc = import.meta.env.VITE_SUPABASE_FRIENDS_UPLOAD_RPC || 'upsert_friends_weekly_payload';
    this.fetchRpc = import.meta.env.VITE_SUPABASE_FRIENDS_FETCH_RPC || 'get_friends_weekly';
  }

  isConfigured() {
    return Boolean(this.proxyUrl || (this.supabaseUrl && this.supabaseAnonKey));
  }

  getCurrentWeekKey() {
    return getWeekKey();
  }

  getSelfRosterCode() {
    return this.state.getActiveRosterId?.() || '';
  }

  getSelfRosterName() {
    const activeRosterId = this.state.getActiveRosterId?.();
    const rosters = this.state.multiRosterManager?.getRosters?.() || [];
    const active = rosters.find((roster) => roster.id === activeRosterId);
    return active?.name || 'Main Roster';
  }

  getVisibleRaidIndices() {
    const hiddenRaidIds = this.getHiddenRaidIdSet();
    return RAID_CONFIG
      .map((raid, index) => (hiddenRaidIds.has(raid.id) ? -1 : index))
      .filter((index) => index >= 0);
  }

  getHiddenRaidIdSet() {
    const hiddenRaidIds = new Set(
      (this.weeklyTracker.getHiddenRaidIds?.() || []).map((value) => String(value || '').trim().toLowerCase())
    );

    const aliasToRaidId = {
      aegir: 'aegir',
      brel: 'brel',
      mordum: 'mordum',
      armoche: 'armoche',
      kazeros: 'kazeros',
    };

    const settings = this.state.get('settings') || {};
    const activeId = this.state.getActiveRosterId?.();
    const byRoster = settings.hiddenColumnsByRoster || {};

    const rawHidden = activeId && Array.isArray(byRoster[activeId])
      ? byRoster[activeId]
      : (Array.isArray(settings.hiddenColumns)
        ? settings.hiddenColumns
        : (Array.isArray(settings.hiddenBossColumns) ? settings.hiddenBossColumns : []));

    rawHidden.forEach((value) => {
      const normalized = String(value || '').trim().toLowerCase();
      if (!normalized) return;

      const directRaid = RAID_CONFIG.find((raid) => raid.id === normalized);
      if (directRaid) {
        hiddenRaidIds.add(directRaid.id);
        return;
      }

      const aliasEntry = Object.entries(aliasToRaidId).find(([alias]) => normalized === alias || normalized.includes(alias));
      if (aliasEntry) {
        hiddenRaidIds.add(aliasEntry[1]);
      }
    });

    return hiddenRaidIds;
  }

  getVisibleRaidMask() {
    return this.getVisibleRaidIndices().reduce((mask, index) => mask | (1 << index), 0);
  }

  buildSelfSnapshot() {
    const roster = this.rosterManager.roster || {};
    const order = Array.isArray(this.rosterManager.rosterOrder) ? this.rosterManager.rosterOrder : [];
    const characterData = this.weeklyTracker.characterData || {};
    const bosses = this.weeklyTracker.getBosses();
    const visibleRaidIndices = this.getVisibleRaidIndices();
    const visibleRaidIndexSet = new Set(visibleRaidIndices);

    const names = order.length > 0
      ? order
      : Object.keys(roster).filter((name) => name !== 'dailyData');

    const characters = names
      .filter((name) => roster[name] && name !== 'dailyData')
      .map((name, orderIndex) => {
        const charRaids = characterData[name] || {};
        const charInfo = roster[name] || {};
        let raidMask = 0;
        let hiddenMask = 0;
        let visibleMask = 0;

        bosses.forEach((boss, index) => {
          const raidId = RAID_CONFIG[index]?.id;
          const bossData = charRaids[boss];
          const isVisibleInColumns = visibleRaidIndexSet.has(index);
          const isEligible = this.weeklyTracker.isCharacterEligible?.(charInfo?.ilvl, raidId) ?? true;

          if (isVisibleInColumns && isEligible && !bossData?.hidden) {
            visibleMask |= (1 << index);
          }

          if (bossData?.hidden && isVisibleInColumns) {
            hiddenMask |= (1 << index);
          }

          if (bossData?.cleared && !bossData?.hidden && isVisibleInColumns && isEligible) {
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
      raidIds: RAID_CONFIG.map((raid) => raid.id),
      visibleRaidIndices,
      characters,
    };
  }

  async hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(pin || '').trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return toHex(hashBuffer);
  }

  buildSyncFingerprint(snapshot, pinHash) {
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

  async uploadSelfWeekly(pin) {
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
      ? await this._requestProxy('/proxy/friends/upload', requestPayload)
      : await this._requestSupabaseRpc(this.uploadRpc, requestPayload);

    if (!response.ok) {
      const details = await this._extractErrorMessage(response);
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

  async fetchFriendWeekly({ rosterCode, pin }) {
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
      ? await this._requestProxy('/proxy/friends/get', requestPayload)
      : await this._requestSupabaseRpc(this.fetchRpc, requestPayload);

    if (!response.ok) {
      const details = await this._extractErrorMessage(response);
      throw new Error(`Friends fetch failed (${response.status}): ${details}`);
    }

    const responseBody = await response.json();
    const rows = Array.isArray(responseBody)
      ? responseBody
      : (Array.isArray(responseBody?.rows) ? responseBody.rows : []);

    const characters = rows
      .map((row, index) => ({
        name: row.char_name,
        sortIndex: Number.isInteger(row.sort_index) ? row.sort_index : index,
        raidMask: (Number(row.raid_mask) || 0) & visibleRaidMask,
        visibleMask: ((row.visible_mask === null || row.visible_mask === undefined)
          ? visibleRaidMask
          : (Number(row.visible_mask) || 0)) & visibleRaidMask,
      }))
      .sort((a, b) => {
        if (a.sortIndex !== b.sortIndex) {
          return a.sortIndex - b.sortIndex;
        }
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

    return {
      weekKey,
      rosterCode: safeRosterCode,
      rosterName: rows?.[0]?.roster_name || safeRosterCode,
      raidIds: RAID_CONFIG.map((raid) => raid.id),
      characters,
      updatedAt: rows?.[0]?.updated_at || null,
    };
  }

  async _requestProxy(path, payload) {
    const url = `${this.proxyUrl}${path}`;
    return this._request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  async _requestSupabaseRpc(rpcName, payload) {
    const url = `${this.supabaseUrl}/rest/v1/rpc/${rpcName}`;
    return this._request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.supabaseAnonKey,
        Authorization: `Bearer ${this.supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
    });
  }

  async _request(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: options.headers || {},
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async _extractErrorMessage(response) {
    try {
      const payload = await response.clone().json();
      if (payload && typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
      return JSON.stringify(payload);
    } catch {
      return await response.text();
    }
  }
}
