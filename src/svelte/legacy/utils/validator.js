/**
 * Validator - Centralized data validation
 * Responsibilities:
 * - Define validation schemas
 * - Validate data against schemas
 * - Return detailed validation errors
 */

import { ValidationError } from './errorHandler.js';

/**
 * Base Validator Class
 */
class Validator {
    constructor(schema) {
        this.schema = schema;
    }

    validate(data) {
        const errors = [];
        
        for (const [field, rules] of Object.entries(this.schema)) {
            const value = data[field];
            const fieldErrors = this.validateField(field, value, rules);
            errors.push(...fieldErrors);
        }
        
        if (errors.length > 0) {
            throw new ValidationError(
                errors.map(e => e.message).join('; '),
                errors[0].field,
                { errors }
            );
        }
        
        return true;
    }

    validateField(field, value, rules) {
        const errors = [];
        
        // Required check
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push({
                field,
                rule: 'required',
                message: `${field} is required`
            });
            return errors; // Stop further validation if required field is missing
        }
        
        // Skip other validations if field is optional and empty
        if (!rules.required && (value === undefined || value === null || value === '')) {
            return errors;
        }
        
        // Type check
        if (rules.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== rules.type) {
                errors.push({
                    field,
                    rule: 'type',
                    message: `${field} must be of type ${rules.type}`
                });
            }
        }
        
        // String validations
        if (rules.type === 'string') {
            if (rules.minLength && value.length < rules.minLength) {
                errors.push({
                    field,
                    rule: 'minLength',
                    message: `${field} must be at least ${rules.minLength} characters`
                });
            }
            
            if (rules.maxLength && value.length > rules.maxLength) {
                errors.push({
                    field,
                    rule: 'maxLength',
                    message: `${field} must not exceed ${rules.maxLength} characters`
                });
            }
            
            if (rules.pattern && !rules.pattern.test(value)) {
                errors.push({
                    field,
                    rule: 'pattern',
                    message: rules.patternMessage || `${field} format is invalid`
                });
            }
        }
        
        // Number validations
        if (rules.type === 'number') {
            if (rules.min !== undefined && value < rules.min) {
                errors.push({
                    field,
                    rule: 'min',
                    message: `${field} must be at least ${rules.min}`
                });
            }
            
            if (rules.max !== undefined && value > rules.max) {
                errors.push({
                    field,
                    rule: 'max',
                    message: `${field} must not exceed ${rules.max}`
                });
            }
            
            if (rules.integer && !Number.isInteger(value)) {
                errors.push({
                    field,
                    rule: 'integer',
                    message: `${field} must be an integer`
                });
            }
        }
        
        // Array validations
        if (rules.type === 'array') {
            if (rules.minItems && value.length < rules.minItems) {
                errors.push({
                    field,
                    rule: 'minItems',
                    message: `${field} must have at least ${rules.minItems} items`
                });
            }
            
            if (rules.maxItems && value.length > rules.maxItems) {
                errors.push({
                    field,
                    rule: 'maxItems',
                    message: `${field} must not exceed ${rules.maxItems} items`
                });
            }
        }
        
        // Enum validation
        if (rules.enum && !rules.enum.includes(value)) {
            errors.push({
                field,
                rule: 'enum',
                message: `${field} must be one of: ${rules.enum.join(', ')}`
            });
        }
        
        // Custom validation
        if (rules.custom) {
            const customError = rules.custom(value);
            if (customError) {
                errors.push({
                    field,
                    rule: 'custom',
                    message: customError
                });
            }
        }
        
        return errors;
    }
}

/**
 * Character Schema Validator
 */
export const characterSchema = new Validator({
    name: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 16
    },
    class: {
        required: true,
        type: 'string',
        enum: [
            // Warriors
            'Slayer', 'Valkyrie', 'Berserker', 'Destroyer', 'Gunlancer', 'Paladin', 'Guardian Knight',
            // Martial Artists
            'Glaivier', 'Scrapper', 'Soulfist', 'Wardancer', 'Breaker', 'Striker',
            // Gunners
            'Gunslinger', 'Artillerist', 'Deadeye', 'Machinist', 'Sharpshooter',
            // Mages
            'Arcanist', 'Bard', 'Sorceress', 'Summoner',
            // Assassins
            'Deathblade', 'Reaper', 'Shadowhunter', 'Souleater',
            // Specialists
            'Aeromancer', 'Artist', 'Wildsoul'
        ]
    },
    ilvl: {
        required: true,
        type: 'number',
        min: 0,
        max: 9999.99
    },
    order: {
        required: false,
        type: 'number',
        min: 0,
        integer: true
    },
    isHidden: {
        required: false,
        type: 'boolean'
    }
});

/**
 * Settings Schema Validator
 */
export const settingsSchema = new Validator({
    dbPath: {
        required: true,
        type: 'string',
        minLength: 1,
        custom: (value) => {
            if (!value.endsWith('.db')) {
                return 'Database path must end with .db extension';
            }
            return null;
        }
    },
    timezone: {
        required: false,
        type: 'string'
    },
    dateFormat: {
        required: false,
        type: 'string',
        enum: ['dd/mm/yyyy', 'mm/dd/yyyy']
    },
    timeFormat: {
        required: false,
        type: 'string',
        enum: ['24h', '12h']
    }
});

/**
 * Raid Data Schema Validator
 */
export const raidDataSchema = new Validator({
    characterName: {
        required: true,
        type: 'string',
        minLength: 1
    },
    bossName: {
        required: true,
        type: 'string',
        minLength: 1
    },
    difficulty: {
        required: true,
        type: 'string',
        enum: ['Solo', 'Normal', 'Hard']
    },
    cleared: {
        required: true,
        type: 'boolean'
    },
    timestamp: {
        required: false,
        type: 'number',
        min: 0
    }
});

/**
 * Quick validation helpers
 */
export const validate = {
    character: (data) => characterSchema.validate(data),
    settings: (data) => settingsSchema.validate(data),
    raidData: (data) => raidDataSchema.validate(data),
    
    // Quick type checks
    isString: (value, fieldName = 'field') => {
        if (typeof value !== 'string') {
            throw new ValidationError(`${fieldName} must be a string`, fieldName);
        }
        return true;
    },
    
    isNumber: (value, fieldName = 'field') => {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new ValidationError(`${fieldName} must be a number`, fieldName);
        }
        return true;
    },
    
    isBoolean: (value, fieldName = 'field') => {
        if (typeof value !== 'boolean') {
            throw new ValidationError(`${fieldName} must be a boolean`, fieldName);
        }
        return true;
    },
    
    isArray: (value, fieldName = 'field') => {
        if (!Array.isArray(value)) {
            throw new ValidationError(`${fieldName} must be an array`, fieldName);
        }
        return true;
    },
    
    notEmpty: (value, fieldName = 'field') => {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
        }
        return true;
    },
    
    inRange: (value, min, max, fieldName = 'field') => {
        if (value < min || value > max) {
            throw new ValidationError(`${fieldName} must be between ${min} and ${max}`, fieldName);
        }
        return true;
    }
};
