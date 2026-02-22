/**
 * MultiRosterManager - Manages multiple rosters
 *
 * Responsibilities:
 * - Manage list of available rosters
 * - Track which roster is active
 * - Provide API for roster CRUD
 * - Emit roster change events
 * - Sync state across tabs
 */
class MultiRosterManager {
    constructor() {
        this.rosters = [];
        this.activeRosterId = null;
        this.listeners = new Map();
        this.initialized = false;
    }

    /**
     * Initialize by loading rosters and the active roster from backend
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('🔄 Initializing MultiRosterManager...');
            
            // Load roster list
            this.rosters = await window.api.getRosterList();
            console.log('📋 Rosters loaded:', this.rosters);
            
            // Load active roster
            this.activeRosterId = await window.api.getActiveRoster();
            console.log('✅ Active roster:', this.activeRosterId);

            // If first launch with no rosters, create a default one to avoid null active roster
            if (!this.rosters || this.rosters.length === 0 || !this.activeRosterId) {
                console.warn('⚠️ No rosters found. Creating default roster...');
                const defaultName = 'Main Roster';
                try {
                    const newId = await this.createRoster(defaultName);
                    this.activeRosterId = newId;
                    console.log(`✅ Default roster created: ${defaultName} (${newId})`);
                } catch (createError) {
                    console.error('❌ Failed to create default roster:', createError);
                    throw createError;
                }
            }
            
            this.initialized = true;
            console.log(`✅ MultiRosterManager initialized: ${this.rosters.length} rosters, active: ${this.activeRosterId}`);
        } catch (error) {
            console.error('❌ Error initializing MultiRosterManager:', error);
            throw error;
        }
    }

    /**
    * Return list of all rosters
    * @returns {Array} Array of objects {id, name, characterCount, createdAt}
     */
    getRosters() {
        return [...this.rosters];
    }

    /**
    * Return active roster ID
    * @returns {string|null} Active roster ID or null
     */
    getActiveRosterId() {
        return this.activeRosterId;
    }

    /**
    * Return data for the active roster
    * @returns {Object|null} Active roster object or null
     */
    getActiveRoster() {
        if (!this.activeRosterId) return null;
        return this.rosters.find(r => r.id === this.activeRosterId) || null;
    }

    /**
    * Return roster data by ID
    * @param {string} rosterId - roster ID
    * @returns {Object|null} Roster object or null
     */
    getRosterById(rosterId) {
        return this.rosters.find(r => r.id === rosterId) || null;
    }

    /**
    * Create a new roster
    * @param {string} name - roster name
    * @returns {Promise<string>} Created roster ID
     */
    async createRoster(name) {
        if (!name || name.trim() === '') {
            throw new Error('Roster name cannot be empty');
        }

        try {
            const rosterId = await window.api.createRoster(name.trim());
            
            // Reload roster list
            await this.refresh();
            
            // Emit creation event
            this.emit('rosterCreated', { rosterId, name });
            
            // If first roster, emit change event
            if (this.rosters.length === 1) {
                this.emit('rosterSwitched', { 
                    previousId: null, 
                    currentId: rosterId 
                });
            }
            
            return rosterId;
        } catch (error) {
            console.error('Error creating roster:', error);
            throw error;
        }
    }

    /**
    * Delete a roster
    * @param {string} rosterId - roster ID to delete
    * @returns {Promise<boolean>} true on success
     */
    async deleteRoster(rosterId) {
        if (!rosterId) {
            throw new Error('Roster ID is required');
        }

        const roster = this.getRosterById(rosterId);
        if (!roster) {
            throw new Error('Roster not found');
        }

        try {
            const wasActive = this.activeRosterId === rosterId;
            
            await window.api.deleteRoster(rosterId);
            
            // Reload roster list
            await this.refresh();
            
            // Emit deletion event
            this.emit('rosterDeleted', { rosterId, name: roster.name });
            
            // If it was the active roster, emit change event
            if (wasActive && this.activeRosterId !== rosterId) {
                this.emit('rosterSwitched', { 
                    previousId: rosterId, 
                    currentId: this.activeRosterId 
                });
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting roster:', error);
            throw error;
        }
    }

    /**
    * Rename a roster
    * @param {string} rosterId - roster ID
    * @param {string} newName - new roster name
    * @returns {Promise<boolean>} true on success
     */
    async renameRoster(rosterId, newName) {
        if (!rosterId) {
            throw new Error('Roster ID is required');
        }

        if (!newName || newName.trim() === '') {
            throw new Error('New name cannot be empty');
        }

        const roster = this.getRosterById(rosterId);
        if (!roster) {
            throw new Error('Roster not found');
        }

        try {
            const oldName = roster.name;
            
            await window.api.renameRoster(rosterId, newName.trim());
            
            // Reload roster list
            await this.refresh();
            
            // Emit rename event
            this.emit('rosterRenamed', { rosterId, oldName, newName: newName.trim() });
            
            return true;
        } catch (error) {
            console.error('Error renaming roster:', error);
            throw error;
        }
    }

    /**
    * Switch the active roster
    * @param {string} rosterId - roster ID to activate
    * @returns {Promise<boolean>} true on success
     */
    async switchActiveRoster(rosterId) {
        if (!rosterId) {
            throw new Error('Roster ID is required');
        }

        if (rosterId === this.activeRosterId) {
            return true; // Already active
        }

        const roster = this.getRosterById(rosterId);
        if (!roster) {
            throw new Error('Roster not found');
        }

        try {
            const previousId = this.activeRosterId;
            
            await window.api.switchActiveRoster(rosterId);
            
            this.activeRosterId = rosterId;
            
            // Emit change event
            this.emit('rosterSwitched', { 
                previousId, 
                currentId: rosterId 
            });
            
            console.log(`Switched to roster: ${roster.name} (${rosterId})`);
            
            return true;
        } catch (error) {
            console.error('Error switching roster:', error);
            throw error;
        }
    }

    /**
    * Reload roster list and active roster from backend
     */
    async refresh() {
        try {
            this.rosters = await window.api.getRosterList();
            this.activeRosterId = await window.api.getActiveRoster();
            
            // Emit refresh event
            this.emit('rostersRefreshed', { 
                rosters: this.rosters,
                activeRosterId: this.activeRosterId
            });
        } catch (error) {
            console.error('Error refreshing rosters:', error);
            throw error;
        }
    }

    /**
    * Register an event listener
    * @param {string} event - Event name (rosterCreated, rosterDeleted, rosterRenamed, rosterSwitched, rostersRefreshed)
    * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
    * Remove an event listener
    * @param {string} event - Event name
    * @param {Function} callback - Callback to remove
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
    * Emit an event to all listeners
    * @param {string} event - Event name
    * @param {Object} data - Event data
     */
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in ${event} listener:`, error);
            }
        });
    }

    /**
    * Check if at least one roster exists
    * @returns {boolean} true if rosters exist
     */
    hasRosters() {
        return this.rosters.length > 0;
    }

    /**
    * Check if there is an active roster
    * @returns {boolean} true if an active roster exists
     */
    hasActiveRoster() {
        return this.activeRosterId !== null;
    }
}

// Export singleton instance
export const multiRosterManager = new MultiRosterManager();
