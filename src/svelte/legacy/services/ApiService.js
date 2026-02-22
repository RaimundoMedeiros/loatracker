import { mapApiClassToDisplay, MATHI_API_CONFIG } from '../config/constants.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('ApiService');
const PROXY_BASE = import.meta?.env?.DEV
    ? '/proxy/mathi'
    : ((typeof import.meta !== 'undefined' && import.meta?.env?.VITE_MATHI_PROXY_BASE)
        || 'https://uwowo.ychainstyle.workers.dev/proxy/mathi');

async function fetchJson(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MATHI_API_CONFIG.TIMEOUT_MS || 15000);
    try {
        const res = await fetch(`${PROXY_BASE}${path}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return await res.json();
    } finally {
        clearTimeout(timeout);
    }
}

export class ApiService {
    static async fetchCharacterByName(region, characterName) {
        try {
            logger.info('Fetching character from Mathi.Moe Api', { name: characterName, region });

            const result = await fetchJson(`/characters/by-name/${region}/${characterName}`);

            logger.info('Character fetched successfully', { status: '200' });

            return result;
        } catch (error) {
            logger.error('Failed to fetch character from Mathi.Moe Api', { 
                name: characterName, 
                region,
                error: error.message || error 
            });
            throw new Error(`Failed to fetch character: ${error}`);
        }
    }

    static async fetchRosterByGuid(rosterGuid) {
        try {
            logger.info('Fetching roster from Mathi.Moe Api', { guid: rosterGuid });

            const result = await fetchJson(`/rosters/by-guid/${rosterGuid}`);

            logger.info('Roster fetched successfully', { status: '200' });

            return result;
        } catch (error) {
            logger.error('Failed to fetch roster from Mathi.Moe Api', { 
                guid: rosterGuid,
                error: error.message || error 
            });
            throw new Error(`Failed to fetch roster: ${error}`);
        }
    }

    static async fetchFullRoster(region, characterName) {
        try {
            logger.info('Fetching full roster from Mathi.Moe Api', { name: characterName, region });
            
            // 1. Fetch character to get roster_guid
            const characterData = await this.fetchCharacterByName(region, characterName);
            
            if (!characterData.roster_guid) {
                throw new Error('Character not found or has no roster_guid');
            }

            // 2. Fetch full roster
            const rosterData = await this.fetchRosterByGuid(characterData.roster_guid);
            
            // 3. Map class names and format characters
            const characters = rosterData.characters.map(char => ({
                name: char.name,
                class: mapApiClassToDisplay(char.class),
                ilvl: Math.round(char.item_level * 100) / 100,
                combatPower: char.combat_power?.score ? 
                    Math.round(char.combat_power.score * 100) / 100 : null
            }));

            logger.info('Full roster fetched successfully', { count: characters.length });
            
            return characters;
        } catch (error) {
            logger.error('Failed to fetch full roster from Mathi.Moe Api', { 
                name: characterName, 
                region,
                error: error.message || error 
            });
            throw error;
        }
    }
}
