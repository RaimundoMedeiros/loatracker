/**
 * RosterManager - Handles character roster management
 * Responsibilities:
 * - Add/Edit/Remove characters
 * - Show/Hide characters in weekly view
 * - Roster ordering (drag & drop)
 * - Load/Save roster data (multi-roster aware)
 */

import { errorHandler, ValidationError, FileSystemError } from '../utils/errorHandler.js';
import { validate } from '../utils/validator.js';
import { getLogger } from '../utils/logger.js';
import { CLASS_ICONS } from '../config/constants.js';

const logger = getLogger();

export class RosterManager {
    constructor(stateManager) {
        this.state = stateManager;
        this.editingName = null;
        this.classIcons = CLASS_ICONS;
        this._rosterMetaKeys = new Set(['dailyData']);
    }

    /**
     * Get active roster ID from state
     */
    get activeRosterId() {
        return this.state.getActiveRosterId();
    }

    /**
     * Get roster from state
     */
    get roster() {
        const roster = this.state.get('roster');
        return roster && typeof roster === 'object' ? roster : {};
    }

    /**
     * Get roster order from state
     */
    get rosterOrder() {
        const order = this.state.get('rosterOrder');
        return Array.isArray(order) ? order : [];
    }

    /**
     * Set roster in state
     */
    set roster(value) {
        this.state.setState({ roster: value });
    }

    /**
     * Set roster order in state
     */
    set rosterOrder(value) {
        this.state.setState({ rosterOrder: value });
    }

    /**
     * Load roster from storage
     * Loads data for the active roster ID
     */
    async loadRoster() {
        try {
            const rosterId = this.activeRosterId;
            
            console.log('🔄 RosterManager loading roster for ID:', rosterId);
            
            if (!rosterId) {
                logger.warn('No active roster, loading empty roster');
                console.log('⚠️ No active roster ID - loading empty roster');
                this.state.setState({ roster: {}, rosterOrder: [] });
                return;
            }
            
            const rosterData = await window.api.loadRoster(rosterId);
            console.log('📦 Loaded roster data:', rosterData);
            
            const loadedRoster = rosterData.roster || {};
            const loadedOrder = rosterData.order || [];
            
            // Migration: If roster has characters but order is empty, populate order
            if (this._needsMigration(loadedRoster, loadedOrder)) {
                await this._migrateRosterOrder(loadedRoster);
                return;
            }
            
            // Cleanup orphaned data
            const { cleanedRoster, validOrder, hasChanges } = this._cleanOrphanedData(loadedRoster, loadedOrder);
            
            // Update state with cleaned data
            this.state.setState({ 
                roster: cleanedRoster, 
                rosterOrder: validOrder 
            });
            
            // Save if we cleaned up orphans
            if (hasChanges) {
                logger.debug('Cleaned roster. Saving...');
                await this.saveRoster();
            }
            
            logger.info('Roster loaded', { 
                rosterId,
                characterCount: Object.keys(cleanedRoster).length,
                orderCount: validOrder.length
            });
            console.log(`✅ Roster loaded successfully: ${Object.keys(cleanedRoster).length} characters`);
        } catch (error) {
            const handledError = errorHandler.handle(
                new FileSystemError('Failed to load roster data', 'roster_data.json', { originalError: error }),
                false
            );
            console.error('❌ Error loading roster:', error);
            this.state.setState({ roster: {}, rosterOrder: [] });
            throw handledError;
        }
    }

    /**
     * Check if roster needs migration (has characters but no order)
     * @private
     */
    _needsMigration(roster, order) {
        const characterKeys = this._getCharacterKeys(roster);
        return characterKeys.length > 0 && order.length === 0;
    }

    /**
     * Migrate roster by populating order from roster keys
     * @private
     */
    async _migrateRosterOrder(roster) {
        const migratedOrder = this._getCharacterKeys(roster);
        logger.info('Migrating roster order', { characters: migratedOrder });
        this.state.setState({ 
            roster: roster, 
            rosterOrder: migratedOrder 
        });
        await this.saveRoster();
    }

    /**
     * Clean orphaned characters and invalid order entries
     * @private
     * @returns {{ cleanedRoster: Object, validOrder: Array, hasChanges: boolean }}
     */
    _cleanOrphanedData(roster, order) {
        let hasChanges = false;
        
        // Remove characters that are in roster but not in order (ignore metadata like dailyData)
        const cleanedRoster = { ...roster };
        Object.keys(cleanedRoster).forEach(charName => {
            if (this._rosterMetaKeys.has(charName)) return;
            if (!order.includes(charName)) {
                logger.debug('Removing orphaned character:', charName);
                delete cleanedRoster[charName];
                hasChanges = true;
            }
        });
        
        // Remove order entries that don't exist in roster
        const validOrder = order.filter(charName => {
            const exists = cleanedRoster.hasOwnProperty(charName) && !this._rosterMetaKeys.has(charName);
            if (!exists) {
                logger.debug('Removing invalid order entry:', charName);
                hasChanges = true;
            }
            return exists;
        });
        
        return { cleanedRoster, validOrder, hasChanges };
    }

    _getCharacterKeys(roster) {
        return Object.keys(roster || {}).filter(name => !this._rosterMetaKeys.has(name));
    }

    /**
     * Save roster to storage
     * Saves data for the active roster ID
     */
    async saveRoster() {
        try {
            const rosterId = this.activeRosterId;
            
            if (!rosterId) {
                logger.error('Cannot save roster: No active roster ID');
                throw new Error('No active roster selected');
            }
            
            logger.debug('Saving roster:', { rosterId, roster: this.roster, order: this.rosterOrder });
            const result = await window.api.saveRoster(rosterId, { 
                roster: this.roster, 
                order: this.rosterOrder 
            });
            logger.debug('Save result:', result);
            return result;
        } catch (error) {
            throw errorHandler.handle(
                new FileSystemError('Failed to save roster data', 'roster_data.json', { originalError: error })
            );
        }
    }

    async addCharacter(name, charClass, ilvl, combatPower = null) {
        try {
            // Validate inputs
            validate.notEmpty(name, 'Character name');
            validate.notEmpty(charClass, 'Character class');
            validate.isNumber(parseFloat(ilvl), 'Item level');
            
            // Full validation
            const characterData = {
                name: name.trim(),
                class: charClass,
                ilvl: parseFloat(ilvl)
            };
            
            if (combatPower !== null && combatPower !== undefined && combatPower > 0) {
                characterData.combatPower = parseFloat(combatPower);
            }
            
            validate.character(characterData);

            if (this.editingName) {
                // Update existing character
                if (this.editingName !== name && this.roster[name]) {
                    throw new ValidationError('Character name already exists', 'name');
                }
                delete this.roster[this.editingName];
                const charData = { class: charClass, ilvl: parseFloat(ilvl), visible: true };
                if (combatPower !== null && combatPower !== undefined && combatPower > 0) {
                    charData.combatPower = parseFloat(combatPower);
                }
                this.roster[name] = charData;
                const index = this.rosterOrder.indexOf(this.editingName);
                if (index !== -1) this.rosterOrder[index] = name;
                this.editingName = null;
                await this.saveRoster();
                return { success: true, isEdit: true };
            } else {
                // Add new character
                if (this.roster[name]) {
                    throw new ValidationError('Character already exists', 'name');
                }
                const charData = { class: charClass, ilvl: parseFloat(ilvl), visible: true };
                if (combatPower !== null && combatPower !== undefined && combatPower > 0) {
                    charData.combatPower = parseFloat(combatPower);
                }
                this.roster[name] = charData;
                this.rosterOrder.push(name);
                await this.saveRoster();
                return { success: true, isEdit: false };
            }
        } catch (error) {
            throw errorHandler.handle(error);
        }
    }

    async removeCharacter(name, confirmCallback) {
        const characterData = {
            name: name,
            ilvl: this.roster[name]?.ilvl || 'N/A'
        };
        const confirmed = await confirmCallback('Are you sure you want to delete this character?', characterData);
        if (confirmed) {
            delete this.roster[name];
            const index = this.rosterOrder.indexOf(name);
            if (index !== -1) this.rosterOrder.splice(index, 1);
            await this.saveRoster();

            // Clean characterData (weekly/raids) for this character
            const rosterId = this.activeRosterId;
            if (rosterId) {
                try {
                    // Remove characterData entry (raid/weekly progress)
                    const currentCharData = await window.api.loadCharacterData(rosterId) || {};
                    if (currentCharData && currentCharData[name]) {
                        delete currentCharData[name];
                        await window.api.saveCharacterData(rosterId, currentCharData);
                    }
                } catch (err) {
                    console.error('Error cleaning character data on delete:', err);
                }
            }
            return true;
        }
        return false;
    }

    startEdit(name) {
        if (this.roster[name]) {
            this.editingName = name;
            return {
                name: name,
                class: this.roster[name].class,
                ilvl: this.roster[name].ilvl,
                combatPower: this.roster[name].combatPower
            };
        }
        return null;
    }

    async updateCharacter(name, updates) {
        try {
            if (!this.roster[name]) {
                throw new ValidationError('Character not found', 'name');
            }
            
            // Update only provided fields
            if (updates.class !== undefined) {
                this.roster[name].class = updates.class;
            }
            if (updates.ilvl !== undefined) {
                this.roster[name].ilvl = parseFloat(updates.ilvl);
            }
            if (updates.combatPower !== undefined) {
                if (updates.combatPower === null) {
                    delete this.roster[name].combatPower;
                } else {
                    this.roster[name].combatPower = parseFloat(updates.combatPower);
                }
            }
            
            await this.saveRoster();
            return { success: true };
        } catch (error) {
            throw errorHandler.handle(error);
        }
    }

    cancelEdit() {
        this.editingName = null;
    }

    async toggleHidden(name) {
        if (this.roster[name]) {
            this.roster[name].visible = !this.roster[name].visible;
            await this.saveRoster();
            return !this.roster[name].visible;
        }
        return false;
    }

    /**
     * Sort roster by a specific field
     * @param {'manual'|'ilvl'|'combatPower'} sortType - Sort type
     */
    async sortRoster(sortType) {
        if (sortType === 'manual') return; // Manual keeps current order
        
        const characters = this.getAllCharacters();
        
        if (sortType === 'ilvl') {
            characters.sort((a, b) => (b.ilvl || 0) - (a.ilvl || 0));
        } else if (sortType === 'combatPower') {
            characters.sort((a, b) => (b.combatPower || 0) - (a.combatPower || 0));
        }
        
        this.rosterOrder = characters.map(c => c.name);
        await this.saveRoster();
    }

    reorderCharacters(draggedName, targetName) {
        if (draggedName && targetName && draggedName !== targetName) {
            const draggedIndex = this.rosterOrder.indexOf(draggedName);
            const targetIndex = this.rosterOrder.indexOf(targetName);
            this.rosterOrder.splice(draggedIndex, 1);
            this.rosterOrder.splice(targetIndex, 0, draggedName);
            return true;
        }
        return false;
    }

    getVisibleCharacters() {
        return this.rosterOrder.filter(name => 
            this.roster[name] && this.roster[name].visible !== false
        );
    }

    getAllCharacters() {
        return this.rosterOrder.map(name => ({
            name,
            ...this.roster[name]
        }));
    }

    getCharacter(name) {
        return this.roster[name];
    }

    getClassIcon(className) {
        return this.classIcons[className] || null;
    }
}
