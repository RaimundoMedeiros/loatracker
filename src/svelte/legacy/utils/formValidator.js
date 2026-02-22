/**
 * FormValidator - Input validation and formatting
 * Responsibilities:
 * - Validate form inputs in real-time
 * - Format input values
 * - Provide visual feedback
 */

import { VALIDATION } from '../config/constants.js';

export class FormValidator {
    constructor(uiHelper) {
        this.ui = uiHelper;
        this.inputs = new Map();
    }

    /**
     * Register input for validation
     * @param {HTMLInputElement} input - Input element
     * @param {Object} rules - Validation rules
     */
    register(input, rules) {
        if (!input) return;

        this.inputs.set(input, rules);
        this.setupValidation(input, rules);
    }

    /**
     * Setup validation listeners for input
     */
    setupValidation(input, rules) {
        // Store last valid value
        input.dataset.lastValid = input.value;

        // Input event for real-time validation
        input.addEventListener('input', (e) => {
            this.validateInput(e.target, rules);
        });
    }

    /**
     * Validate single input
     * @param {HTMLInputElement} input - Input element
     * @param {Object} rules - Validation rules
     * @param {Boolean} showError - Show error message
     */
    validateInput(input, rules, showError = false) {
        const value = input.value;

        // Character name validation
        if (rules.type === 'characterName') {
            return this.validateCharacterName(input, value, showError);
        }

        // Item level validation
        if (rules.type === 'itemLevel') {
            return this.validateItemLevel(input, value, showError);
        }

        // Class validation
        if (rules.type === 'class') {
            return this.validateClass(input, value, showError);
        }

        return true;
    }

    /**
     * Validate character name
     */
    validateCharacterName(input, value, showError) {
        // Max length check
        if (value.length > VALIDATION.CHARACTER_NAME_MAX_LENGTH) {
            input.value = value.slice(0, VALIDATION.CHARACTER_NAME_MAX_LENGTH);
            return false;
        }

        // Update last valid
        input.dataset.lastValid = input.value;
        this.clearError(input);
        return true;
    }

    /**
     * Validate item level
     */
    validateItemLevel(input, value, showError) {
        // Allow only numbers and one decimal point
        let cleaned = value.replace(/[^0-9.]/g, '');
        
        // Remove multiple decimal points (keep only first)
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            cleaned = parts[0] + '.' + parts.slice(1).join('');
        }
        
        // Limit decimal places to 2
        if (parts.length === 2 && parts[1].length > VALIDATION.ITEM_LEVEL_DECIMAL_PLACES) {
            cleaned = parts[0] + '.' + parts[1].slice(0, VALIDATION.ITEM_LEVEL_DECIMAL_PLACES);
        }

        // Parse as float
        const numValue = parseFloat(cleaned);

        // Check if valid number
        if (!isNaN(numValue)) {
            if (numValue > VALIDATION.ITEM_LEVEL_MAX) {
                input.value = input.dataset.lastValid || '';
                if (showError) {
                    this.ui.showToast(`Item level cannot exceed ${VALIDATION.ITEM_LEVEL_MAX}`, 'error');
                }
                return false;
            }

            // Update value and last valid
            input.value = cleaned;
            input.dataset.lastValid = cleaned;
            this.clearError(input);
            return true;
        }

        // Empty is valid (will be caught by required check)
        if (cleaned === '' || cleaned === '.') {
            input.value = cleaned;
            input.dataset.lastValid = input.dataset.lastValid || '';
            return cleaned === '' ? true : false;
        }

        // Invalid number
        input.value = input.dataset.lastValid || '';
        return false;
    }

    /**
     * Validate class selection
     */
    validateClass(input, value, showError) {
        if (!value || value === '') {
            return false;
        }

        this.clearError(input);
        return true;
    }

    /**
     * Validate all registered inputs
     * @returns {Boolean} - True if all valid
     */
    validateAll() {
        let allValid = true;
        let firstErrorMessage = '';

        this.inputs.forEach((rules, input) => {
            const value = input.value.trim();
            
            // Check required fields
            if (rules.required && !value) {
                allValid = false;
                input.classList.add('input-error');
                input.setAttribute('aria-invalid', 'true');
                if (!firstErrorMessage) {
                    if (rules.type === 'characterName') {
                        firstErrorMessage = 'Character name is required';
                    } else if (rules.type === 'itemLevel') {
                        firstErrorMessage = 'Item level is required';
                    } else if (rules.type === 'class') {
                        firstErrorMessage = 'Class selection is required';
                    }
                }
                return;
            }
            
            // Validate input value
            const isValid = this.validateInput(input, rules, true);
            if (!isValid) {
                allValid = false;
                input.classList.add('input-error');
                input.setAttribute('aria-invalid', 'true');
            }
        });
        
        // Show error toast for first error found
        if (!allValid && firstErrorMessage) {
            this.ui.showToast(firstErrorMessage, 'error');
        }

        return allValid;
    }

    /**
     * Clear error message
     */
    clearError(input) {
        input.classList.remove('input-error');
        input.removeAttribute('aria-invalid');
    }

    /**
     * Clear all errors
     */
    clearAllErrors() {
        this.inputs.forEach((rules, input) => {
            this.clearError(input);
        });
    }

    /**
     * Reset all inputs
     */
    reset() {
        this.inputs.forEach((rules, input) => {
            input.value = '';
            input.dataset.lastValid = '';
            this.clearError(input);
        });
    }

    /**
     * Unregister all inputs
     */
    unregisterAll() {
        this.inputs.clear();
    }
}
