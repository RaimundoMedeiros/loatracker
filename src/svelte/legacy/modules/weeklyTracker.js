/**
 * WeeklyTracker - Handles weekly raid tracking
 * Responsibilities:
 * - Track raid completions
 * - Manage raid difficulties (Solo/Normal/Hard)
 * - Hide/Show individual raid cells
 * - Load raids from database
 * - Calculate weekly reset period
 * - Save/Load character raid data (multi-roster aware)
 */
import { getLogger } from '../utils/logger.js';
import { RAID_CONFIG, BOSSES, BOSS_MAP } from '../config/constants.js';

const logger = getLogger();

export class WeeklyTracker {
    constructor(stateManager) {
        this.state = stateManager;
        this.RAID_CONFIG = RAID_CONFIG;
        this.bosses = BOSSES;
        this.bossMap = BOSS_MAP;
    }

    getHiddenRaidIds() {
        const settings = this.state.get('settings') || {};
        const activeId = this.state.getActiveRosterId?.();
        const byRoster = settings.hiddenColumnsByRoster || {};

        let hidden = [];
        if (activeId && Array.isArray(byRoster[activeId])) {
            hidden = byRoster[activeId];
        } else if (Array.isArray(settings.hiddenColumns)) {
            hidden = settings.hiddenColumns;
        } else if (Array.isArray(settings.hiddenBossColumns)) {
            hidden = settings.hiddenBossColumns;
        }

        const raidIds = new Set(RAID_CONFIG.map(r => r.id));
        return hidden.filter(id => raidIds.has(id));
    }

    /**
     * Get active roster ID from state
     */
    get activeRosterId() {
        return this.state.getActiveRosterId();
    }

    /**
     * Get character data from state
     */
    get characterData() {
        const data = this.state.get('characterData');
        return data && typeof data === 'object' ? data : {};
    }

    /**
     * Set character data in state
     */
    set characterData(value) {
        this.state.setState({ characterData: value });
    }

    async loadData() {
        try {
            const rosterId = this.activeRosterId;
            
            if (!rosterId) {
                logger.warn('No active roster, loading empty characterData');
                this.characterData = {};
                return;
            }
            
            const loaded = await window.api.loadCharacterData(rosterId);

            // Prune orphaned characters only when roster is available
            const roster = this.state.get('roster') || {};
            const validNames = Object.keys(roster);

            // If roster not loaded yet, keep data as-is to avoid wiping
            if (validNames.length === 0) {
                this.characterData = loaded || {};
                return;
            }

            const validSet = new Set(validNames);
            const pruned = {};
            Object.entries(loaded || {}).forEach(([name, data]) => {
                if (validSet.has(name)) {
                    pruned[name] = data;
                }
            });

            // Persist cleanup only if something was removed
            const removed = Object.keys(loaded || {}).length !== Object.keys(pruned).length;
            this.characterData = pruned;
            if (removed) {
                await this.saveData();
            }
        } catch (e) {
            logger.error('Error loading characterData:', { error: e.message });
            this.characterData = {};
        }
    }

    async saveData() {
        const rosterId = this.activeRosterId;
        
        if (!rosterId) {
            logger.error('Cannot save characterData: No active roster ID');
            throw new Error('No active roster selected');
        }
        
        logger.debug('Saving data:', { rosterId, characterData: this.characterData });
        await window.api.saveCharacterData(rosterId, this.characterData);
    }

    async getCurrentResetPeriod() {
        try {
            const period = await window.api.getWeeklyResetPeriod();

            if (!period || typeof period.start !== 'number' || typeof period.end !== 'number') {
                throw new Error('Invalid weekly reset period received from backend');
            }

            return { start: new Date(period.start), end: new Date(period.end) };
        } catch (err) {
            logger.error('Failed to fetch weekly reset period from backend', { error: err?.message, stack: err?.stack });
            throw err instanceof Error ? err : new Error('Failed to fetch weekly reset period');
        }
    }

    mapDifficulty(diff) {
        if (diff === 'Normal') return 'Normal';
        if (diff === 'Hard') return 'Hard';
        return 'Solo';
    }

    async loadRaidsFromDatabase(roster, dbPath, options = {}) {
        const { allRaids = null } = options;
        if (!dbPath || dbPath.trim() === '') {
            throw new Error('Database path not configured');
        }

        const exists = await window.api.checkDatabaseExists(dbPath);
        if (!exists) {
            throw new Error('Database file not found');
        }


        logger.debug('Loading raids...');
        const raidsSource = Array.isArray(allRaids) ? allRaids : await window.api.getRaids();
        logger.debug(`Fetched ${raidsSource.length} raids from database`);
        
        const { start: resetStart, end: resetEnd } = await this.getCurrentResetPeriod();
        logger.debug('Reset period:', { start: resetStart.toISOString(), end: resetEnd.toISOString() });
        
        const raids = raidsSource.filter(raid => {
            const fightDate = new Date(raid.fight_start);
            return fightDate >= resetStart && 
                   fightDate < resetEnd && 
                   roster[raid.local_player] && 
                   !roster[raid.local_player].hidden;
        });
        logger.debug('Filtered raids', { count: raids.length });
        
        // Preserve hidden states
        const hiddenStates = this._preserveHiddenStates();
        
        raids.forEach(raid => {
            logger.debug('Processing raid', { 
                boss: raid.current_boss, 
                cleared: raid.cleared, 
                difficulty: raid.difficulty,
                player: raid.local_player
            });

            const boss = this.bossMap[raid.current_boss];
            if (!boss) {
                // Skip encounters we don't track in the weekly grid
                return;
            }

            if (!this.characterData[raid.local_player]) {
                this.characterData[raid.local_player] = {};
            }
            if (raid.cleared) {
                logger.debug('Processing raid:', { boss: raid.current_boss, processedAs: boss, player: raid.local_player });
                const existing = this.characterData[raid.local_player][boss] || {};
                this.characterData[raid.local_player][boss] = {
                    cleared: true,
                    difficulty: this.mapDifficulty(raid.difficulty),
                    hidden: existing.hidden || false,
                    chestOpened: existing.chestOpened || false,
                    timestamp: raid.fight_start
                };
            }
        });
        logger.debug('Processed character data', { 
            characterCount: Object.keys(this.characterData).length 
        });
        
        // Restore hidden states
        this._restoreHiddenStates(hiddenStates);
        
        await this.saveData();
    }

    _preserveHiddenStates() {
        const hiddenStates = {};
        for (const char in this.characterData) {
            for (const boss in this.characterData[char]) {
                if (this.characterData[char][boss].hidden) {
                    if (!hiddenStates[char]) hiddenStates[char] = {};
                    hiddenStates[char][boss] = true;
                }
            }
        }
        return hiddenStates;
    }

    _restoreHiddenStates(hiddenStates) {
        for (const char in hiddenStates) {
            for (const boss in hiddenStates[char]) {
                if (!this.characterData[char]) this.characterData[char] = {};
                if (!this.characterData[char][boss]) {
                    this.characterData[char][boss] = { 
                        cleared: false, 
                        difficulty: 'Solo', 
                        hidden: true
                    };
                } else {
                    this.characterData[char][boss].hidden = true;
                }
            }
        }
    }

    async weeklyReset() {
        const hiddenStates = this._preserveHiddenStates();
        this.characterData = {};
        this._restoreHiddenStates(hiddenStates);
        await this.saveData();
    }

    toggleRaidCleared(character, boss) {
        if (!this.characterData[character]) {
            this.characterData[character] = {};
        }
        if (!this.characterData[character][boss]) {
            this.characterData[character][boss] = { 
                cleared: false, 
                difficulty: 'Solo',
                hidden: false
            };
        }
        
        const isCleared = !this.characterData[character][boss].cleared;
        this.characterData[character][boss].cleared = isCleared;
        
        if (isCleared && this.characterData[character][boss].difficulty === 'none') {
            this.characterData[character][boss].difficulty = 'Solo';
        }
        
        return isCleared;
    }

    cycleDifficulty(character, boss) {
        if (!this.characterData[character] || !this.characterData[character][boss]) {
            return 'Normal';
        }
        
        const difficulties = ['Solo', 'Normal', 'Hard'];
        let current = difficulties.indexOf(this.characterData[character][boss].difficulty);
        current = (current + 1) % difficulties.length;
        const newDiff = difficulties[current];
        
        this.characterData[character][boss].difficulty = newDiff;
        return newDiff;
    }

    toggleHidden(character, boss) {
        if (!this.characterData[character]) {
            this.characterData[character] = {};
        }
        if (!this.characterData[character][boss]) {
            this.characterData[character][boss] = { 
                cleared: false, 
                difficulty: 'Solo', 
                hidden: false 
            };
        }
        
        this.characterData[character][boss].hidden = !this.characterData[character][boss].hidden;
        return this.characterData[character][boss].hidden;
    }

    getRaidData(character, boss) {
        return (this.characterData[character] && this.characterData[character][boss]) || 
               { cleared: false, difficulty: 'Solo', hidden: false, chestOpened: false };
    }

    toggleChest(character, boss) {
        if (!this.characterData[character]) {
            this.characterData[character] = {};
        }
        if (!this.characterData[character][boss]) {
            this.characterData[character][boss] = { 
                cleared: false, 
                difficulty: 'Solo', 
                hidden: false,
                chestOpened: false
            };
        }
        
        this.characterData[character][boss].chestOpened = !this.characterData[character][boss].chestOpened;
        return this.characterData[character][boss].chestOpened;
    }

    isCharacterEligible(ilvl, bossId) {
        const raid = this.RAID_CONFIG.find(r => r.id === bossId.toLowerCase());
        return raid && ilvl >= raid.nm;
    }

    getBosses() {
        return this.bosses;
    }

    getVisibleBosses() {
        const hidden = this.getHiddenRaidIds();
        return this.bosses.filter(boss => {
            const raid = this.RAID_CONFIG.find(r => r.id === boss.toLowerCase());
            return !raid || !hidden.includes(raid.id);
        });
    }

    getRaidLabel(boss) {
        const raid = this.RAID_CONFIG.find(r => r.id === boss.toLowerCase());
        return raid?.label || boss;
    }

    getRaidConfig() {
        return this.RAID_CONFIG;
    }

    getExtraGold(character) {
        const charData = this.characterData[character];
        return charData && typeof charData._extraGold === 'number' ? charData._extraGold : 0;
    }

    async setExtraGold(character, amount) {
        if (!this.characterData[character]) {
            this.characterData[character] = {};
        }

        const sanitized = Number.isFinite(amount) ? amount : 0;
        this.characterData[character]._extraGold = sanitized;
        await this.saveData();
        return sanitized;
    }

    /**
     * Calculate the gold earned by a character based on cleared raids
     * @param {string} character - Character name
     * @returns {number} Total gold earned
     */
    calculateCharacterGold(character) {
        let totalGold = 0;
        const charData = this.characterData[character];
        
        if (!charData) return 0;
        
        const hiddenRaidIds = this.getHiddenRaidIds();

        for (const boss of this.bosses) {
            const raidConfig = this.RAID_CONFIG.find(r => r.id === boss.toLowerCase());
            if (raidConfig && hiddenRaidIds.includes(raidConfig.id)) {
                continue; // Entire column hidden via settings
            }

            const bossData = charData[boss];
            if (bossData && bossData.cleared && !bossData.hidden) {
                if (raidConfig && raidConfig.gold) {
                    const difficulty = bossData.difficulty.toLowerCase();
                    let raidGold = 0;
                    let chestCost = 0;
                    
                    if (difficulty === 'hard') {
                        raidGold = raidConfig.gold.hm || 0;
                        chestCost = raidConfig.chest?.hm || 0;
                    } else if (difficulty === 'normal' || difficulty === 'solo') {
                        raidGold = raidConfig.gold.nm || 0;
                        chestCost = raidConfig.chest?.nm || 0;
                    }
                    
                    // Subtract chest cost if chest is opened
                    if (bossData.chestOpened) {
                        raidGold -= chestCost;
                    }
                    
                    totalGold += raidGold;
                }
            }
        }

        // Include manually added gold (outside raids)
        const manualGold = this.getExtraGold(character);
        
        return totalGold + manualGold;
    }

    /**
     * Calculate total gold across all visible characters
     * @param {Object} roster - The roster object with character data
     * @returns {number} Total gold earned by all characters
     */
    calculateTotalGold(roster) {
        let total = 0;
        for (const character of Object.keys(roster)) {
            if (!roster[character].hidden) {
                total += this.calculateCharacterGold(character);
            }
        }
        return total;
    }
}
