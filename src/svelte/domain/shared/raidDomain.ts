import type { SettingsPayload } from '../../../types/app-api';

type RaidConfigEntry = {
  id?: string;
  label?: string;
  nm?: number;
};

const RAID_ALIASES: Record<string, string> = {
  aegir: 'aegir',
  act1aegir: 'aegir',
  brel: 'brel',
  brelshaza: 'brel',
  act2brel: 'brel',
  mordum: 'mordum',
  act3mordum: 'mordum',
  armoche: 'armoche',
  act4armoche: 'armoche',
  kazeros: 'kazeros',
  finalactkazeros: 'kazeros',
  serka: 'serka',
  serca: 'serka',
  act5serka: 'serka',
  act5serca: 'serka',
};

function normalizeText(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function normalizeRaidKey(
  value: unknown,
  raidConfig: RaidConfigEntry[],
  options: { allowUnknown?: boolean } = {},
): string {
  const safeRaw = String(value || '').trim();
  if (!safeRaw) {
    return '';
  }

  const safeLower = safeRaw.toLowerCase();
  const directById = raidConfig.find((entry) => String(entry?.id || '').toLowerCase() === safeLower);
  if (directById?.id) {
    return String(directById.id).toLowerCase();
  }

  const directByLabel = raidConfig.find((entry) => String(entry?.label || '').trim().toLowerCase() === safeLower);
  if (directByLabel?.id) {
    return String(directByLabel.id).toLowerCase();
  }

  const cleaned = normalizeText(safeRaw);
  if (!cleaned) {
    return '';
  }

  if (RAID_ALIASES[cleaned]) {
    return RAID_ALIASES[cleaned];
  }

  for (const raid of raidConfig) {
    const raidId = String(raid?.id || '').toLowerCase();
    const normalizedLabel = normalizeText(raid?.label || '');
    if (!raidId) continue;
    if (cleaned === raidId || cleaned === normalizedLabel) {
      return raidId;
    }

    const rawLabel = String(raid?.label || '').toLowerCase();
    if ((rawLabel && rawLabel.includes(safeLower)) || safeLower.includes(raidId)) {
      return raidId;
    }
  }

  return options.allowUnknown ? cleaned : '';
}

export function getHiddenRaidIdsForSettings(
  settings: (SettingsPayload & Record<string, unknown>) | null | undefined,
  activeRosterId: string,
  raidConfig: RaidConfigEntry[],
): string[] {
  const safeSettings = (settings || {}) as SettingsPayload & Record<string, unknown>;
  const byRoster = (safeSettings.hiddenColumnsByRoster || {}) as Record<string, string[]>;

  const rawHidden = activeRosterId && Array.isArray(byRoster[activeRosterId])
    ? byRoster[activeRosterId]
    : (Array.isArray(safeSettings.hiddenColumns)
      ? safeSettings.hiddenColumns
      : (Array.isArray(safeSettings.hiddenBossColumns) ? safeSettings.hiddenBossColumns : []));

  const normalized = new Set<string>();
  for (const value of rawHidden) {
    const raidId = normalizeRaidKey(value, raidConfig, { allowUnknown: false });
    if (raidId) {
      normalized.add(raidId);
    }
  }

  return Array.from(normalized);
}

export function getVisibleRaidIndices(raidConfig: RaidConfigEntry[], hiddenRaidIds: Iterable<string>): number[] {
  const hidden = new Set(Array.from(hiddenRaidIds).map((value) => String(value || '').toLowerCase()));
  return raidConfig
    .map((raid, index) => (hidden.has(String(raid?.id || '').toLowerCase()) ? -1 : index))
    .filter((index) => index >= 0);
}

export function isCharacterEligibleForRaid(ilvl: number, bossId: string, raidConfig: RaidConfigEntry[]): boolean {
  const raidId = normalizeRaidKey(bossId, raidConfig, { allowUnknown: false });
  if (!raidId) {
    return false;
  }

  const raid = raidConfig.find((entry) => String(entry?.id || '').toLowerCase() === raidId);
  if (!raid) {
    return false;
  }

  return Number(ilvl || 0) >= Number(raid.nm || 0);
}
