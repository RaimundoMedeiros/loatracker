/**
 * UIHelper - UI feedback and loading states
 * Responsibilities:
 * - Show/hide loading overlays
 * - Display notifications and toasts
 * - Manage button loading states
 * - Provide visual feedback
 */

import { errorHandler } from './errorHandler.js';
import { DOM_IDS, CSS_CLASSES, TIMINGS, TOAST_TYPES, MESSAGES } from '../config/constants.js';

export class UIHelper {
    constructor() {
        this.loadingOverlay = document.getElementById(DOM_IDS.CONTAINERS.LOADING_OVERLAY);
        this.loadingText = null;
        if (this.loadingOverlay) {
            this.loadingText = this.loadingOverlay.querySelector(`.${CSS_CLASSES.LOADING_TEXT}`);
        }
        
        // Make instance globally available for error handler
        window.UIHelper = this;
    }

    /**
     * Show loading overlay
     */
    showLoading(message = MESSAGES.INFO.LOADING) {
        if (this.loadingOverlay) {
            if (this.loadingText) {
                this.loadingText.textContent = message;
            }
            this.loadingOverlay.classList.add('active');
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove('active');
        }
    }

    /**
     * Show button loading state
     */
    setButtonLoading(button, loading = true) {
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = `⏳ ${MESSAGES.INFO.LOADING}`;
            button.style.opacity = '0.6';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || button.textContent;
            button.style.opacity = '1';
        }
    }

    /**
     * Show a simple success checkmark
     */
    showSuccess() {
        // Remove existing checkmark if any
        const existing = document.querySelector('.success-check');
        if (existing) existing.remove();

        const check = document.createElement('div');
        check.className = 'success-check';
        check.innerHTML = '✓';
        document.body.appendChild(check);

        // Auto remove after animation
        setTimeout(() => check.remove(), TIMINGS.TOAST_SHORT);
    }

    /**
     * Show toast notification
     */
    showToast(message, type = TOAST_TYPES.INFO, duration = TIMINGS.TOAST_DEFAULT, onClick = null) {
        // Remove any existing toasts
        const existingToasts = document.querySelectorAll(`.${CSS_CLASSES.TOAST}`);
        existingToasts.forEach(t => t.remove());

        // Get or create toast container in body (not inside tabs)
        let container = document.querySelector(`.${CSS_CLASSES.TOAST_CONTAINER}`);
        if (!container) {
            container = document.createElement('div');
            container.className = CSS_CLASSES.TOAST_CONTAINER;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `${CSS_CLASSES.TOAST} ${type}`;
        toast.textContent = message;
        
        // If clickable, add styles and event listener
        if (onClick) {
            toast.style.cursor = 'pointer';
            toast.style.userSelect = 'none';
            toast.addEventListener('click', () => {
                onClick();
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), TIMINGS.ANIMATION_SHORT);
            });
            toast.title = 'Click to open';
        }
        
        container.appendChild(toast);

        // Announce to screen readers
        this.announceToScreenReader(message);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), TIMINGS.ANIMATION_SHORT);
        }, duration);
    }

    /**
     * Announce message to screen readers via ARIA live region
     * @param {string} message - Message to announce
     */
    announceToScreenReader(message) {
        const liveRegion = document.getElementById('notifications');
        if (liveRegion) {
            // Clear and set new message
            liveRegion.textContent = '';
            setTimeout(() => {
                liveRegion.textContent = message;
                // Clear after announcement
                setTimeout(() => {
                    liveRegion.textContent = '';
                }, 1000);
            }, 100);
        }
    }

    /**
     * Get toast color by type
     */
    getToastColor(type) {
        const colors = {
            [TOAST_TYPES.SUCCESS]: '#4CAF50',
            [TOAST_TYPES.ERROR]: '#f44336',
            [TOAST_TYPES.WARNING]: '#ff9800',
            [TOAST_TYPES.INFO]: '#2196F3'
        };
        return colors[type] || colors[TOAST_TYPES.INFO];
    }

    /**
     * Add pulse animation to element
     */
    pulse(element) {
        element.style.animation = 'pulse 0.5s ease';
        setTimeout(() => {
            element.style.animation = '';
        }, TIMINGS.ANIMATION_MEDIUM);
    }

    /**
     * Shake element (for errors)
     */
    shake(element) {
        element.style.animation = 'shake 0.5s ease';
        setTimeout(() => {
            element.style.animation = '';
        }, TIMINGS.ANIMATION_MEDIUM);
    }

    /**
     * Highlight element temporarily
     */
    highlight(element, duration = 1000) {
        const originalBg = element.style.backgroundColor;
        element.style.transition = 'background-color 0.3s ease';
        element.style.backgroundColor = '#d4af3733';
        
        setTimeout(() => {
            element.style.backgroundColor = originalBg;
        }, duration);
    }

    /**
     * Show inline loading in element
     */
    showInlineLoading(element) {
        const originalContent = element.innerHTML;
        element.dataset.originalContent = originalContent;
        element.innerHTML = '<div class="skeleton skeleton-text"></div>';
    }

    /**
     * Hide inline loading
     */
    hideInlineLoading(element) {
        if (element.dataset.originalContent) {
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
        }
    }
}

// Add CSS animations to style
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }

    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);
