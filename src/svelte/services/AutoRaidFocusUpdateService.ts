import type { AppApi, RosterPayload, SettingsPayload } from '../../types/app-api';
import { BOSSES, BOSS_MAP, RAID_CONFIG } from '../legacy/config/constants.js';
import { normalizeRaidKey } from '../domain/shared/raidDomain';

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

const DEFAULT_RAID_CELL: RaidCell = {
  cleared: false,
  difficulty: 'Solo',
  hidden: false,
  chestOpened: false,
  timestamp: null,
};

function isAutoRaidOnFocusEnabled(settingsNow: Record<string, unknown>) {
  const rawValue = settingsNow.autoRaidUpdateOnFocus;
  if (rawValue === true || rawValue === 'true' || rawValue === 1) {
    return true;
  }

  if (rawValue === false || rawValue === 'false' || rawValue === 0) {
    return false;
  }

  return false;
}

function normalizeDifficulty(value: unknown): Difficulty {
  const safe = String(value || '').trim();
  if (safe === 'Normal' || safe === 'Hard') return safe;
  return 'Solo';
}

function mapDifficultyFromRaid(value: unknown): Difficulty {
  const safe = String(value || '').toLowerCase();
  if (safe.includes('hard')) return 'Hard';
  if (safe.includes('normal')) return 'Normal';
  return 'Solo';
}

function normalizeRaidBossId(boss: string) {
  return normalizeRaidKey(boss, RAID_CONFIG as Array<any>, { allowUnknown: false });
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

function getRaidConfigByBoss(boss: string) {
  const normalizedId = normalizeRaidBossId(boss);
  if (!normalizedId) return undefined;
  return RAID_CONFIG.find((entry: any) => String(entry.id || '') === normalizedId);
}

function disallowSoloForBoss(boss: string) {
  const raid = getRaidConfigByBoss(boss) as { id?: string } | undefined;
  const raidId = String(raid?.id || normalizeRaidBossId(boss) || '').toLowerCase();
  return raidId === 'armoche' || raidId === 'kazeros';
}

function getAllowedDifficultiesForRoster(
  rosterState: Record<string, RosterCharacter | unknown>,
  characterName: string,
  boss: string
): Difficulty[] {
  const character = getCharacterFromRoster(rosterState, characterName);
  const raid = getRaidConfigByBoss(boss);
  const soloDisabled = disallowSoloForBoss(boss);

  if (!character || !raid) {
    return soloDisabled ? ['Normal'] : ['Solo', 'Normal'];
  }

  if (character.ilvl >= Number((raid as any).hm || 9999)) {
    return soloDisabled ? ['Normal', 'Hard'] : ['Solo', 'Normal', 'Hard'];
  }

  return soloDisabled ? ['Normal'] : ['Solo', 'Normal'];
}

function getVisibleRostersForActive(settingsNow: Record<string, unknown>, activeRosterId: string) {
  const typed = (settingsNow || {}) as Partial<SettingsPayload>;
  const byRoster = (typed.visibleWeeklyRostersByRoster || {}) as Record<string, string[]>;
  const fromRoster = Array.isArray(byRoster?.[activeRosterId]) ? byRoster[activeRosterId] : [];
  const fromLegacy = Array.isArray(typed.visibleWeeklyRosters) ? typed.visibleWeeklyRosters : [];
  const selected = fromRoster.length > 0 ? fromRoster : fromLegacy;

  return selected
    .map((entry) => String(entry || '').trim())
    .filter((entry) => Boolean(entry));
}

async function loadRaidsIntoRosterFromDatabase(
  api: AppApi,
  raids: any[],
  resetStart: number,
  resetEnd: number,
  rosterId: string,
) {
  const rosterPayload = (await api.loadRoster?.(rosterId)) as RosterPayload | null;
  const rosterState = (rosterPayload?.roster || {}) as Record<string, RosterCharacter | unknown>;
  const targetCharacterData = (await api.loadCharacterData?.(rosterId)) as CharacterDataMap | null;
  const next = { ...(targetCharacterData || {}) } as CharacterDataMap;
  let updatedCells = 0;

  raids.forEach((raid: any) => {
    if (!raid?.cleared) return;

    const fightTime = new Date(raid.fight_start).getTime();
    if (resetStart && resetEnd && !(fightTime >= resetStart && fightTime < resetEnd)) {
      return;
    }

    const rawBoss = (BOSS_MAP as Record<string, string>)[String(raid.current_boss || '')];
    const boss = normalizeRaidBossId(rawBoss);
    if (!boss) return;

    const characterName = String(raid.local_player || '');
    const character = getCharacterFromRoster(rosterState, characterName);
    if (!character || character.visible === false) return;

    if (!next[characterName]) next[characterName] = {} as CharacterBossData;
    const previous = getRaidCell(next, characterName, boss);
    const allowedDifficulties = getAllowedDifficultiesForRoster(rosterState, characterName, boss);
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

  if (updatedCells > 0) {
    await api.saveCharacterData?.(rosterId, next);
  }

  return updatedCells;
}

type AutoRaidFocusUpdateContext = {
  rosterId: string;
  raids: any[];
  resetStart: number;
  resetEnd: number;
};

type AutoRaidFocusUpdateOptions = {
  targetRosterIds?: string[];
  updateRoster?: (context: AutoRaidFocusUpdateContext) => Promise<number>;
  onRosterSuccess?: (rosterId: string, updatedCells: number) => void;
  onRosterFailed?: (rosterId: string, error: unknown) => void;
};

export async function runAutoRaidFocusUpdate(
  api: AppApi,
  settingsNow: Record<string, unknown>,
  options?: AutoRaidFocusUpdateOptions,
): Promise<void> {
  if (!isAutoRaidOnFocusEnabled(settingsNow)) {
    return;
  }

  const hasDb = await api.checkDatabaseExists?.();
  if (!hasDb) {
    return;
  }

  await api.reloadCurrentDatabase?.();
  const raids = await api.getRaids?.();
  if (!Array.isArray(raids)) {
    return;
  }

  const period = await api.getWeeklyResetPeriod?.();
  const resetStart = Number(period?.start || 0);
  const resetEnd = Number(period?.end || 0);

  const activeRosterId = String((await api.getActiveRoster?.()) || '').trim();
  if (!activeRosterId) {
    return;
  }

  const requestedRosterIds = Array.isArray(options?.targetRosterIds)
    ? options?.targetRosterIds
    : null;

  const targetRosterIds = requestedRosterIds
    ? Array.from(new Set(requestedRosterIds
      .map((entry) => String(entry || '').trim())
      .filter((entry) => Boolean(entry))))
    : Array.from(new Set([
      activeRosterId,
      ...getVisibleRostersForActive(settingsNow, activeRosterId),
    ]));

  const updateRoster = options?.updateRoster
    ? options.updateRoster
    : async ({ rosterId, raids: raidsData, resetStart: start, resetEnd: end }: AutoRaidFocusUpdateContext) => {
      return loadRaidsIntoRosterFromDatabase(api, raidsData, start, end, rosterId);
    };

  for (const rosterId of targetRosterIds) {
    try {
      const updatedCells = await updateRoster({
        rosterId,
        raids,
        resetStart,
        resetEnd,
      });
      if (options?.onRosterSuccess) {
        options.onRosterSuccess(rosterId, updatedCells);
      } else {
        void api.logDebug?.('friends:auto-raid-focus-update-roster-success', {
          rosterId,
          updatedCells,
        });
      }
    } catch (error) {
      if (options?.onRosterFailed) {
        options.onRosterFailed(rosterId, error);
      } else {
        void api.logDebug?.('friends:auto-raid-focus-update-roster-failed', {
          rosterId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
