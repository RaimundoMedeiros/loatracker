/**
 * Application Constants
 * 
 * Centralized configuration for magic numbers, IDs, and fixed data.
 * This file eliminates magic numbers scattered throughout the codebase.
 * 
 * Usage:
 * ```javascript
 * import { RAID_CONFIG, VALIDATION } from '../../config/constants.js';
 * ```
 * 
 * Guidelines:
 * - Keep constants organized by category
 * - Use SCREAMING_SNAKE_CASE for constant names
 * - Add comments for non-obvious values
 * - Update this file when adding new magic numbers
 */

// ===========================
// RAID CONFIGURATION
// ===========================
export const RAID_CONFIG = [
    { id: 'aegir', label: 'Act 1 Aegir', nm: 1660, hm: 1680, gold: { nm: 16800, hm: 21000 }, chest: { nm: 2530, hm: 5970 } },
    { id: 'brel', label: 'Act 2 Brel', nm: 1670, hm: 1690, gold: { nm: 19250, hm: 23800 }, chest: { nm: 5540, hm: 7500 } },
    { id: 'mordum', label: 'Act 3 Mordum', nm: 1680, hm: 1700, gold: { nm: 28000, hm: 38000 }, chest: { nm: 9800, hm: 12600 } },
    { id: 'armoche', label: 'Act 4 Armoche', nm: 1700, hm: 1720, gold: { nm: 33000, hm: 42000 }, chest: { nm: 10560, hm: 13440 } },
    { id: 'kazeros', label: 'Final Act Kazeros', nm: 1710, hm: 1730, gold: { nm: 40000, hm: 52000 }, chest: { nm: 12800, hm: 16640 } },
    { id: 'serka', label: 'Shadow Raid Serca', nm: 1710, hm: 1730, nmr: 1740, gold: { nm: 35000, hm: 44000, nmr: 54000 }, chest: { nm: 11200, hm: 14080, nmr: 17280 } }
];

export const BOSSES = ['Aegir', 'Brel', 'Mordum', 'Armoche', 'Kazeros', 'Serca'];

export const BOSS_MAP = {
    'Aegir, the Oppressor': 'Aegir',
    'Phantom Manifester Brelshaza': 'Brel',
    'Mordum, the Abyssal Punisher': 'Mordum',
    'Flash of Punishment': 'Mordum',
    'Armoche, Sentinel of the Abyss': 'Armoche',
    'Archdemon Kazeros': 'Kazeros',
    'Death Incarnate Kazeros': 'Kazeros',
    'Serka': 'Serca',
    'Corvus Tul Rak': 'Serca',
    'Serca': 'Serca'
};

// ===========================
// VALIDATION RULES
// ===========================
export const VALIDATION = {
    CHARACTER_NAME_MAX_LENGTH: 16,
    ITEM_LEVEL_MAX: 9999.99,
    ITEM_LEVEL_MIN: 0,
    ITEM_LEVEL_DECIMAL_PLACES: 2
};

// ===========================
// LOGGER CONFIGURATION
// ===========================
export const LOGGER = {
    MAX_LOG_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
    MAX_LOG_FILES: 5,
    MAX_RECENT_LINES: 100
};

// ===========================
// DOM ELEMENT IDS
// ===========================
export const DOM_IDS = {
    // Modals
    MODALS: {
        CONFIRM: 'confirm-modal',
        SETTINGS: 'settings-modal',
        NOTIFICATION: 'notification-modal',
        COLUMN_SETTINGS: 'column-settings-modal'
    },
    
    // Buttons
    BUTTONS: {
        CONFIRM_YES: 'confirm-yes',
        CONFIRM_NO: 'confirm-no',
        NOTIFICATION_OK: 'notification-ok',
        SETTINGS_BTN: 'settings-btn',
        SETTINGS_CLOSE: 'settings-close',
        CANCEL_SETTINGS: 'cancel-settings',
        ADD_CHARACTER: 'add-char',
        LOAD_API: 'load-api',
        WEEKLY_RESET: 'weekly-reset',
        WEEKLY_COLUMNS: 'weekly-columns-btn',
        BROWSE_DB: 'browse-db',
        SAVE_SETTINGS: 'save-settings',
        COLUMN_SETTINGS_CLOSE: 'column-settings-close',
        COLUMN_SETTINGS_SAVE: 'column-settings-save',
        COLUMN_SETTINGS_CANCEL: 'column-settings-cancel',
        VISIBLE_ROSTERS: 'visible-rosters-btn'
    },
    
    // Tabs
    TABS: {
        WEEKLY: 'weekly-tab',
        ROSTER: 'roster-tab'
    },
    
    // Forms
    FORMS: {
        CHARACTER_NAME: 'char-name',
        CHARACTER_CLASS: 'char-class',
        CHARACTER_ILVL: 'char-ilvl',
        DB_PATH: 'db-path'
    },
    
    // Containers
    CONTAINERS: {
        CHARACTERS_BODY: 'characters-body',
        ROSTER_LIST: 'roster-list',
        LOADING_OVERLAY: 'loading-overlay',
        RESET_TIMER: 'reset-timer',
        WEEKLY_HEADER_ROW: 'weekly-header-row',
        WEEKLY_ROSTER_SELECTOR: 'weekly-roster-selector',
        COLUMN_SETTINGS_LIST: 'column-settings-list',
        NOTIFICATION_MESSAGE: 'notification-message',
        CALC_CHARACTER_TABS: 'calc-character-tabs',
        ROUTES_RESULT: 'routes-result',
        NEXT_STEP_RESOURCES: 'next-step-resources-grid'
    },
    
    // Settings
    SETTINGS: {
        DETECTED_TIMEZONE: 'detected-timezone',
        TIMEZONE_SELECT: 'timezone-select',
        DATE_FORMAT_SELECT: 'date-format-select',
        TIME_FORMAT_SELECT: 'time-format-select',
        AUTO_RAID_INTERVAL: 'auto-raid-interval',
        AUTO_RAID_ON_FOCUS: 'auto-raid-on-focus'
    }
};

// ===========================
// UI CONFIGURATION
// ===========================
export const UI = {
    TOAST_DURATION_MS: 3000,
    ANIMATION_DURATION_MS: 300,
    DEBOUNCE_DELAY_MS: 300
};

// ===========================
// WEEKLY RESET CONFIGURATION
// ===========================
export const WEEKLY_RESET = {
    DAY_OF_WEEK: 3, // Wednesday (0 = Sunday)
    HOUR_UTC: 8     // 8:00 AM UTC
};

// ===========================
// DAILY RESET CONFIGURATION
// ===========================
export const DAILY_RESET = {
    HOUR_UTC: 10    // 10:00 AM UTC
};

export const GUARDIAN_BOSSES = ['Argeos', 'Skolakia', 'Drextalas', 'Krathios'];
export const FIELD_BOSS_NAME = 'Sevek Atun';
export const CHAOS_GATE_NAMES = ['Soft Bean Legion Honey-Filled Tricolor Sweetcake', 'Darkness Legion Kiril'];

// ===========================
// CHARACTER CLASSES
// ===========================
export const CHARACTER_CLASSES = [
    'Berserker', 'Destroyer', 'Gunlancer', 'Paladin', 'Slayer', 'Valkyrie',
    'Guardian Knight',
    'Arcanist', 'Bard', 'Sorceress', 'Summoner',
    'Breaker', 'Glaivier', 'Scrapper', 'Soulfist', 'Striker', 'Wardancer',
    'Artillerist', 'Deadeye', 'Gunslinger', 'Machinist', 'Sharpshooter',
    'Deathblade', 'Reaper', 'Shadowhunter', 'Souleater',
    'Aeromancer', 'Artist', 'Wildsoul'
];

// ===========================
// DIFFICULTY LEVELS
// ===========================
export const DIFFICULTY = {
    SOLO: 'Solo',
    NORMAL: 'Normal',
    HARD: 'Hard',
    NIGHTMARE: 'Nightmare'
};

// ===========================
// FILE PATHS (Relative to app root)
// ===========================
export const PATHS = {
    CONFIG_DIR: 'config/data',
    SCHEMAS_DIR: 'config/schemas',
    USER_DATA_FILE: 'config/data/userData.json',
    USER_DATA_SCHEMA: 'config/schemas/userData.schema.json',
    ASSETS_ICONS: './assets/icons'
};

// ===========================
// CSS CLASS NAMES
// ===========================
export const CSS_CLASSES = {
    // Character/Roster
    CHARACTER_CARD: 'character-card',
    CHAR_NAME: 'char-name',
    CHAR_CLASS: 'char-class',
    CHAR_ILVL: 'char-ilvl',
    CHAR_INFO: 'char-info',
    
    // Weekly Tracker
    DIFFICULTY_BOX: 'difficulty-box',
    EYE_ICON: 'eye-icon',
    CHEST_ICON: 'chest-icon',
    BOSS_CELL: 'boss-cell',
    GOLD_CELL: 'gold-cell',
    GOLD_DISPLAY: 'gold-display',
    GOLD_ICON: 'gold-icon',
    GOLD_AMOUNT: 'gold-amount',
    
    // Rows and Tables
    TOTAL_ROW: 'total-row',
    TOTAL_LABEL: 'total-label',
    TOTAL_EMPTY: 'total-empty',
    
    // Drag and Drop
    DRAGGING: 'dragging',
    
    // Toast and Overlays
    TOAST: 'toast',
    TOAST_CONTAINER: 'toast-container',
    LOADING_SPINNER: 'loading-spinner',
    LOADING_TEXT: 'loading-text',
    
    // Modal
    MODAL_CONTENT: 'modal-content',
    MODAL_OVERLAY: 'modal-overlay',
    
    // Buttons and Controls
    HIDE_WEEKLY_BTN: 'hide-weekly-btn',
    EDIT_BTN: 'edit-btn',
    REMOVE_ICON: 'remove-icon',
    CARD_BUTTONS: 'card-buttons',
    
    // Sort dropdown
    SORT_DROPDOWN: 'sort-dropdown',
    VISIBLE: 'visible',
    SELECTED: 'selected',
    ACTIVE: 'active',
    
    // Tabs
    TAB_BUTTON: 'tab-button',
    TAB_CONTENT: 'tab-content'
};

// ===========================
// TOAST TYPES
// ===========================
export const TOAST_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

// ===========================
// MESSAGES
// ===========================
export const MESSAGES = {
    // Success messages
    SUCCESS: {
        RAID_DATA_LOADED: 'Raid data loaded',
        WEEKLY_DATA_RESET: 'Weekly data reset',
        CHARACTER_ADDED: 'Character added successfully',
        CHARACTER_UPDATED: 'Character updated successfully',
        CHARACTER_REMOVED: 'Character removed',
        SETTINGS_SAVED: 'Settings saved successfully',
        DATA_SAVED: 'Data saved'
    },
    
    // Error messages
    ERROR: {
        RAID_DATA_LOAD_FAILED: 'Error loading raid data',
        DATABASE_NOT_FOUND: 'Database not found. Drop encounters.db in Settings to load it',
        IMPORT_FAILED: 'Failed to import character data',
        SAVE_FAILED: 'Failed to save data',
        INVALID_INPUT: 'Invalid input',
        NETWORK_ERROR: 'Network error occurred'
    },
    
    // Warning messages
    WARNING: {
        NO_DATABASE_PATH: 'Please configure the database path in Settings to load raid data',
        NO_DATABASE_PATH_IMPORT: 'Please configure the database path in Settings to import from database',
        CHARACTER_EXISTS: 'Character already exists',
        NO_CHARACTERS: 'No characters found'
    },
    
    // Info messages
    INFO: {
        LOADING: 'Loading...',
        LOADING_RAID_DATA: 'Loading raid data...',
        IMPORTING: 'Importing characters...',
        PROCESSING: 'Processing...'
    }
};

// ===========================
// TIMINGS (milliseconds)
// ===========================
export const TIMINGS = {
    TOAST_DEFAULT: 2000,
    TOAST_SHORT: 1500,
    TOAST_LONG: 3000,
    ANIMATION_SHORT: 300,
    ANIMATION_MEDIUM: 500,
    ANIMATION_LONG: 2500,
    DEBOUNCE: 300,
    API_TIMEOUT: 15000,
    RATE_LIMIT_DELAY: 500
};

// ===========================
// DATA ATTRIBUTES
// ===========================
export const DATA_ATTRS = {
    NAME: 'data-name',
    CHARACTER: 'data-character',
    BOSS: 'data-boss',
    TAB: 'data-tab',
    SORT: 'data-sort'
};

// ===========================
// KEYBOARD KEYS
// ===========================
export const KEYS = {
    ENTER: 'Enter',
    ESCAPE: 'Escape',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown'
};

// ===========================
// HTTP STATUS CODES
// ===========================
export const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    SERVER_ERROR: 500
};

// ===========================
// CLASS ICON MAPPING
// ===========================
export const CLASS_ICONS = {
    'Aeromancer': 'classes/aeromancer.svg',
    'Arcanist': 'classes/arcanist.svg',
    'Artillerist': 'classes/artillerist.svg',
    'Artist': 'classes/artist.svg',
    'Bard': 'classes/bard.svg',
    'Berserker': 'classes/berserker.svg',
    'Breaker': 'classes/breaker.svg',
    'Deadeye': 'classes/deadeye.svg',
    'Deathblade': 'classes/deathblade.svg',
    'Destroyer': 'classes/destroyer.svg',
    'Glaivier': 'classes/glaivier.svg',
    'Gunlancer': 'classes/gunlancer.svg',
    'Guardian Knight': 'classes/guardianknight.svg',
    'Gunslinger': 'classes/gunslinger.svg',
    'Machinist': 'classes/machinist.svg',
    'Paladin': 'classes/paladin.svg',
    'Reaper': 'classes/reaper.svg',
    'Scrapper': 'classes/scrapper.svg',
    'Shadowhunter': 'classes/shadowhunter.svg',
    'Sharpshooter': 'classes/sharpshooter.svg',
    'Slayer': 'classes/slayer.svg',
    'Sorceress': 'classes/sorceress.svg',
    'Souleater': 'classes/souleater.svg',
    'Soulfist': 'classes/soulfist.svg',
    'Striker': 'classes/striker.svg',
    'Summoner': 'classes/summoner.svg',
    'Valkyrie': 'classes/valkyrie.svg',
    'Wardancer': 'classes/wardancer.svg',
    'Wildsoul': 'classes/wildsoul.svg'
};

// ===========================
// SORT OPTIONS
// ===========================
export const SORT_OPTIONS = {
    MANUAL: 'manual',
    ILVL: 'ilvl',
    COMBAT_POWER: 'combatPower'
};

// ===========================
// CLASS NAME MAPPING (API -> DISPLAY)
// ===========================
export const CLASS_MAPPER = {
    // Warriors
    'berserker': 'Berserker',
    'berserker_female': 'Slayer',
    'destroyer': 'Destroyer',
    'warlord': 'Gunlancer',
    'gunlancer': 'Gunlancer',
    'holyknight': 'Paladin',
    'paladin': 'Paladin',
    'dragon_knight': 'Guardian Knight',
    'dragonknight': 'Guardian Knight',
    'guardian_knight': 'Guardian Knight',
    'holyknight_female': 'Valkyrie',
    'slayer': 'Slayer',
    'valkyrie': 'Valkyrie',
    
    // Martial Artists
    'battle_master': 'Wardancer',
    'battle_master_male': 'Striker',
    'infighter': 'Scrapper',
    'infighter_male': 'Breaker',
    'lance_master': 'Glaivier',
    'force_master': 'Soulfist',
    'soul_eater': 'Souleater',
    'wardancer': 'Wardancer',
    'scrapper': 'Scrapper',
    'soulfist': 'Soulfist',
    'glaivier': 'Glaivier',
    'striker': 'Striker',
    'breaker': 'Breaker',
    'souleater': 'Souleater',
    
    // Gunners
    'devil_hunter_female': 'Gunslinger',
    'devil_hunter': 'Deadeye',
    'blaster': 'Artillerist',
    'hawk_eye': 'Sharpshooter',
    'scouter': 'Machinist',
    'gunslinger': 'Gunslinger',
    'deadeye': 'Deadeye',
    'artillerist': 'Artillerist',
    'sharpshooter': 'Sharpshooter',
    'machinist': 'Machinist',
    
    // Mages
    'elemental_master': 'Sorceress',
    'bard': 'Bard',
    'summoner': 'Summoner',
    'arcana': 'Arcanist',
    'sorceress': 'Sorceress',
    'arcanist': 'Arcanist',
    
    // Assassins
    'blade': 'Deathblade',
    'demonic': 'Shadowhunter',
    'reaper': 'Reaper',
    'deathblade': 'Deathblade',
    'shadowhunter': 'Shadowhunter',
    
    // Specialists
    'yinyangshi': 'Artist',
    'weather_artist': 'Aeromancer',
    'alchemist': 'Wildsoul',
    'artist': 'Artist',
    'aeromancer': 'Aeromancer',
    'wildsoul': 'Wildsoul'
};

export function mapApiClassToDisplay(apiClassName) {
    if (!apiClassName) return 'Unknown';
    const lowerCase = apiClassName.toLowerCase();
    return CLASS_MAPPER[lowerCase] || apiClassName;
}

// ===========================
// MATHI.MOE API CONFIGURATION
// ===========================
export const MATHI_API_CONFIG = {
    REGIONS: ['NA', 'EU'],
    DEFAULT_REGION: 'NA',
    TIMEOUT_MS: 15000
};
