import { getLogger } from '../utils/logger.js';
import { DAILY_RESET } from '../config/constants.js';

const logger = getLogger('DailyStorage');

/**
 * DailyStorage - Manages daily activity data with auto-reset at 10:00 UTC
 */
export class DailyStorage {
    constructor(rosterManager) {
        this.rosterManager = rosterManager;
    }

    defaultActivity() {
        return {
            completed: false,
            boss: null,
            timestamp: null
        };
    }

    normalizeActivity(value) {
        if (typeof value === 'boolean') {
            return {
                ...this.defaultActivity(),
                completed: value
            };
        }

        if (value && typeof value === 'object') {
            return {
                completed: Boolean(value.completed),
                boss: value.boss ?? null,
                timestamp: value.timestamp ?? null
            };
        }

        return this.defaultActivity();
    }

    normalizeCharacterDaily(entry = {}) {
        return {
            guardianRaid: this.normalizeActivity(entry.guardianRaid),
            chaosDungeon: this.normalizeActivity(entry.chaosDungeon)
        };
    }

    normalizeRosterDaily(entry = {}) {
        return {
            fieldBoss: this.normalizeActivity(entry.fieldBoss),
            chaosGate: this.normalizeActivity(entry.chaosGate)
        };
    }
    
    /**
     * Get current daily reset period timestamps
     * @returns {{start: Date, end: Date}}
     */
    getCurrentDailyPeriod() {
        const now = new Date();
        const utcHour = now.getUTCHours();
        
        // If before 10:00 UTC today, use yesterday 10:00 UTC to today 10:00 UTC
        // If after 10:00 UTC today, use today 10:00 UTC to tomorrow 10:00 UTC
        const resetStart = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            DAILY_RESET.HOUR_UTC,
            0,
            0,
            0
        ));
        
        if (utcHour < DAILY_RESET.HOUR_UTC) {
            resetStart.setUTCDate(resetStart.getUTCDate() - 1);
        }
        
        const resetEnd = new Date(resetStart);
        resetEnd.setUTCDate(resetEnd.getUTCDate() + 1);
        
        return {
            start: resetStart,
            end: resetEnd
        };
    }
    
    /**
     * Check if current daily data is expired
     * @returns {boolean}
     */
    isExpired() {
        const roster = this.rosterManager.roster || {};
        if (!roster.dailyData || !roster.dailyData.date) {
            return true;
        }
        
        const { start, end } = this.getCurrentDailyPeriod();
        const savedDate = new Date(roster.dailyData.date);
        
        // Expired if saved date is not within current period
        return savedDate < start || savedDate >= end;
    }
    
    /**
     * Reset daily data if expired
     */
    resetIfExpired() {
        if (this.isExpired()) {
            logger.info('Daily data expired, resetting...');
            this.reset();
            return true;
        }
        return false;
    }
    
    /**
     * Reset all daily data
     */
    reset() {
        const { start } = this.getCurrentDailyPeriod();
        
        const roster = this.rosterManager.roster || {};
        roster.dailyData = {
            date: start.toISOString(),
            characters: {},
            roster: this.normalizeRosterDaily()
        };
        
        // Initialize character data
        const chars = this.rosterManager.getAllCharacters?.() || [];
        chars.forEach(char => {
            roster.dailyData.characters[char.name] = this.normalizeCharacterDaily();
        });
        
        this.rosterManager.saveRoster();
        logger.info('Daily data reset complete');
    }
    
    /**
     * Get daily data for a character
     * @param {string} characterName
    * @returns {{guardianRaid: Object, chaosDungeon: Object}}
     */
    getCharacterData(characterName) {
        const roster = this.rosterManager.roster;
        
        if (!roster.dailyData) {
            this.reset();
        }
        
        if (!roster.dailyData.characters[characterName]) {
            roster.dailyData.characters[characterName] = this.normalizeCharacterDaily();
        }

        const normalized = this.normalizeCharacterDaily(roster.dailyData.characters[characterName]);
        roster.dailyData.characters[characterName] = normalized;
        return normalized;
    }
    
    /**
     * Update daily data for a character
     * @param {string} characterName
    * @param {{guardianRaid?: Object|boolean, chaosDungeon?: Object|boolean}} data
     */
    updateCharacterData(characterName, data, options = {}) {
        const { save = true } = options;
        const roster = this.rosterManager.roster;
        
        if (!roster.dailyData) {
            this.reset();
        }
        
        if (!roster.dailyData.characters[characterName]) {
            roster.dailyData.characters[characterName] = this.normalizeCharacterDaily();
        }

        const current = this.normalizeCharacterDaily(roster.dailyData.characters[characterName]);
        const updated = { ...current };

        if (Object.prototype.hasOwnProperty.call(data, 'guardianRaid')) {
            updated.guardianRaid = this.normalizeActivity(data.guardianRaid);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'chaosDungeon')) {
            updated.chaosDungeon = this.normalizeActivity(data.chaosDungeon);
        }

        const changed = JSON.stringify(current) !== JSON.stringify(updated);
        roster.dailyData.characters[characterName] = updated;
        if (save && changed) {
            this.rosterManager.saveRoster();
        }

        return changed;
    }
    
    /**
     * Get roster-wide data (field boss, chaos gate)
    * @returns {{fieldBoss: Object, chaosGate: Object}}
     */
    getRosterData() {
        const roster = this.rosterManager.roster;
        
        if (!roster.dailyData || !roster.dailyData.roster) {
            this.reset();
        }

        const normalized = this.normalizeRosterDaily(roster.dailyData.roster);
        roster.dailyData.roster = normalized;
        return normalized;
    }
    
    /**
     * Update roster-wide data
    * @param {{fieldBoss?: Object|boolean, chaosGate?: Object|boolean}} data
     */
    updateRosterData(data, options = {}) {
        const { save = true } = options;
        const roster = this.rosterManager.roster;
        
        if (!roster.dailyData) {
            this.reset();
        }

        const current = this.normalizeRosterDaily(roster.dailyData.roster);
        const updated = { ...current };

        if (Object.prototype.hasOwnProperty.call(data, 'fieldBoss')) {
            updated.fieldBoss = this.normalizeActivity(data.fieldBoss);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'chaosGate')) {
            updated.chaosGate = this.normalizeActivity(data.chaosGate);
        }

        const changed = JSON.stringify(current) !== JSON.stringify(updated);
        roster.dailyData.roster = updated;
        if (save && changed) {
            this.rosterManager.saveRoster();
        }

        return changed;
    }
    
    /**
     * Get time until next reset
     * @returns {number} milliseconds until next reset
     */
    getTimeUntilReset() {
        const { end } = this.getCurrentDailyPeriod();
        return end.getTime() - Date.now();
    }
}
