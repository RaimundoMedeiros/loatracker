import { mapApiClassToDisplay, MATHI_API_CONFIG } from '../legacy/config/constants.js';

const DEFAULT_TIMEOUT_MS = Number(MATHI_API_CONFIG?.TIMEOUT_MS || 15000);

const PROXY_BASE = import.meta?.env?.DEV
  ? '/proxy/mathi'
  : ((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_MATHI_PROXY_BASE)
    || 'https://uwowo.ychainstyle.workers.dev/proxy/mathi');

export type BibleRegion = 'NA' | 'EU';

export type BibleRosterCharacter = {
  name: string;
  class: string;
  ilvl: number;
  combatPower: number | null;
};

type MathiCharacterByNameResponse = {
  roster_guid?: string;
};

type MathiRosterResponse = {
  characters?: Array<{
    name?: string;
    class?: string;
    item_level?: number;
    combat_power?: {
      score?: number;
    } | null;
  }>;
};

export class BibleApiRequestError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body}`);
    this.name = 'BibleApiRequestError';
    this.status = status;
    this.body = body;
  }
}

async function fetchJson(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${PROXY_BASE}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new BibleApiRequestError(response.status, body);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export class BibleApiService {
  static async fetchCharacterByName(region: BibleRegion, characterName: string): Promise<MathiCharacterByNameResponse> {
    try {
      return await fetchJson(`/characters/by-name/${region}/${characterName}`) as MathiCharacterByNameResponse;
    } catch (error) {
      if (error instanceof BibleApiRequestError) {
        throw error;
      }
      throw new Error(`Failed to fetch character: ${error}`);
    }
  }

  static async fetchRosterByGuid(rosterGuid: string): Promise<MathiRosterResponse> {
    try {
      return await fetchJson(`/rosters/by-guid/${rosterGuid}`) as MathiRosterResponse;
    } catch (error) {
      if (error instanceof BibleApiRequestError) {
        throw error;
      }
      throw new Error(`Failed to fetch roster: ${error}`);
    }
  }

  static async fetchFullRoster(region: BibleRegion, characterName: string): Promise<BibleRosterCharacter[]> {
    const characterData = await this.fetchCharacterByName(region, characterName);

    if (!characterData.roster_guid) {
      throw new Error('Character not found or has no roster_guid');
    }

    const rosterData = await this.fetchRosterByGuid(characterData.roster_guid);
    const characters = Array.isArray(rosterData?.characters) ? rosterData.characters : [];

    return characters.map((character) => ({
      name: String(character?.name || '').trim(),
      class: mapApiClassToDisplay(String(character?.class || '').trim()),
      ilvl: Math.round(Number(character?.item_level || 0) * 100) / 100,
      combatPower: Number(character?.combat_power?.score)
        ? Math.round(Number(character?.combat_power?.score || 0) * 100) / 100
        : null,
    }));
  }
}
