/**
 * StateManager - Centralized state management
 * Responsibilities:
 * - Maintain application state
 * - Notify subscribers when state changes
 * - Provide immutable state access
 * - Manage subscription lifecycle to prevent memory leaks
 */
import { getLogger } from '../utils/logger.js';
import { multiRosterManager } from './MultiRosterManager.js';

const logger = getLogger();

export class StateManager {
    constructor() {
        this.state = {
            activeRosterId: null, // Active roster ID
            roster: {},
            rosterOrder: [],
            characterData: {},
            settings: {
                dbPath: "",
                timezone: "browser",
                dateFormat: "browser",
                timeFormat: "browser",
                autoRaidUpdateMinutes: 0,
                autoRaidUpdateOnFocus: false,
                closeToTray: false,
                closeToTrayPrompted: false,
                hiddenColumns: [],
                hiddenColumnsByRoster: {},
                hiddenBossColumns: [],
                visibleWeeklyRosters: [],
                visibleWeeklyRostersByRoster: {}
            },
            ui: {
                activeTab: 'weekly',
                editingCharacter: null
            }
        };
        
        this._subscriberId = 0;
        this._subscribers = new Map();
        this._multiRosterInitialized = false;
        
        // Reference to MultiRosterManager
        this.multiRosterManager = multiRosterManager;
    }

    /**
    * Initialize integration with MultiRosterManager
    * Call after loading data from the backend
     */
    async initializeMultiRoster() {
        if (this._multiRosterInitialized) return;

        try {
            console.log('🔄 Initializing MultiRoster integration...');
            
            // Initialize MultiRosterManager
            await multiRosterManager.initialize();
            
            // Update state with active roster
            const activeRosterId = multiRosterManager.getActiveRosterId();
            this.setState({ activeRosterId });
            
            console.log('📌 Active roster set in state:', activeRosterId);
            
            // Listen for roster changes
            multiRosterManager.on('rosterSwitched', ({ currentId }) => {
                this.setState({ activeRosterId: currentId });
                logger.info('Active roster changed', { activeRosterId: currentId });
            });
            
            this._multiRosterInitialized = true;
            logger.info('MultiRoster integration initialized', { activeRosterId });
            console.log('✅ MultiRoster integration complete');
        } catch (error) {
            logger.error('Error initializing MultiRoster integration', error);
            console.error('❌ MultiRoster initialization failed:', error);
            throw error;
        }
    }

    /**
    * Return active roster ID
     * @returns {string|null}
     */
    getActiveRosterId() {
        return this.state.activeRosterId;
    }

    /**
     * Get current state (deep clone for immutability)
     * @returns {Object} Deep clone of current state
     */
    getState() {
        return structuredClone(this.state);
    }

    /**
     * Get specific state property
     */
    get(path) {
        const keys = path.split('.');
        let value = this.state;
        for (const key of keys) {
            value = value[key];
            if (value === undefined) return undefined;
        }
        return value;
    }

    /**
     * Update state and notify subscribers
     */
    setState(updates) {
        const oldState = { ...this.state };
        this.state = this._deepMerge(this.state, updates);
        this._notifySubscribers(oldState, this.state);
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback - Called with (oldState, newState)
     * @param {string} [name] - Optional name for debugging (e.g., 'WeeklyController')
     * @returns {Function} unsubscribe function - MUST be called when component is destroyed
     */
    subscribe(callback, name = 'anonymous') {
        const id = ++this._subscriberId;
        this._subscribers.set(id, { callback, name, createdAt: Date.now() });
        
        logger.debug('Subscriber added', { id, name, total: this._subscribers.size });
        
        // Return unsubscribe function
        const unsubscribe = () => {
            if (this._subscribers.has(id)) {
                this._subscribers.delete(id);
                logger.debug('Subscriber removed', { id, name, remaining: this._subscribers.size });
            }
        };
        
        return unsubscribe;
    }

    /**
     * Subscribe to specific state property changes
     * @param {string} path - Dot-notation path (e.g., 'settings.dbPath')
     * @param {Function} callback - Called with (newValue, oldValue)
     * @param {string} [name] - Optional name for debugging
     * @returns {Function} unsubscribe function
     */
    subscribeToPath(path, callback, name = 'anonymous') {
        return this.subscribe((oldState, newState) => {
            const oldValue = this._getValueByPath(oldState, path);
            const newValue = this._getValueByPath(newState, path);
            if (oldValue !== newValue) {
                callback(newValue, oldValue);
            }
        }, `${name}:${path}`);
    }

    /**
     * Unsubscribe all listeners (useful for cleanup/reset)
     */
    unsubscribeAll() {
        const count = this._subscribers.size;
        this._subscribers.clear();
        logger.debug('All subscribers removed', { count });
    }

    /**
     * Get subscriber count (for debugging)
     * @returns {number}
     */
    getSubscriberCount() {
        return this._subscribers.size;
    }

    /**
     * Get subscriber info (for debugging memory leaks)
     * @returns {Array}
     */
    getSubscriberInfo() {
        return Array.from(this._subscribers.entries()).map(([id, sub]) => ({
            id,
            name: sub.name,
            age: Date.now() - sub.createdAt
        }));
    }

    /**
     * Reset state to initial values
     */
    reset() {
        this.setState({
            activeRosterId: null,
            roster: {},
            rosterOrder: [],
            characterData: {},
            settings: {
                dbPath: "",
                timezone: "browser",
                dateFormat: "browser",
                timeFormat: "browser",
                autoRaidUpdateMinutes: 0,
                autoRaidUpdateOnFocus: false,
                closeToTray: false,
                closeToTrayPrompted: false,
                hiddenColumns: [],
                hiddenColumnsByRoster: {},
                hiddenBossColumns: []
            },
            ui: {
                activeTab: 'weekly',
                editingCharacter: null
            }
        });
    }

    /**
     * Private: Notify all subscribers
     */
    _notifySubscribers(oldState, newState) {
        this._subscribers.forEach((subscriber, id) => {
            try {
                subscriber.callback(oldState, newState);
            } catch (error) {
                logger.error('Error in state subscriber', { 
                    id, 
                    name: subscriber.name,
                    error: error.message, 
                    stack: error.stack 
                });
            }
        });
    }

    /**
     * Private: Deep merge objects
     */
    _deepMerge(target, source) {
        const output = { ...target };
        for (const key in source) {
            const sourceValue = source[key];
            const targetValue = target[key];
            
            // If source value is an array, just replace it (don't merge)
            if (Array.isArray(sourceValue)) {
                output[key] = sourceValue;
            }
            // If source value is an empty object {}, replace it (don't merge)
            else if (sourceValue instanceof Object && Object.keys(sourceValue).length === 0) {
                output[key] = sourceValue;
            }
            // If both are objects (and not arrays), deep merge
            else if (sourceValue instanceof Object && key in target && targetValue instanceof Object && !Array.isArray(targetValue)) {
                output[key] = this._deepMerge(targetValue, sourceValue);
            }
            // Otherwise, just replace
            else {
                output[key] = sourceValue;
            }
        }
        return output;
    }

    /**
     * Private: Get value by dot-notation path
     */
    _getValueByPath(obj, path) {
        const keys = path.split('.');
        let value = obj;
        for (const key of keys) {
            value = value[key];
            if (value === undefined) return undefined;
        }
        return value;
    }

    /**
     * Batch updates - useful for multiple state changes at once
     */
    batchUpdate(updateFn) {
        const updates = updateFn(this.getState());
        this.setState(updates);
    }

    /**
     * Debug: Log current state
     */
    logState() {
        logger.debug('Current State:', this.state);
    }
}
