/**
 * ModalHelper - Centralized modal dialogs
 * Responsibilities:
 * - Show confirmation dialogs
 * - Show alert/notification dialogs
 * - Manage modal lifecycle (open/close)
 * - Handle user input
 */

import { getLogger } from './logger.js';
import { DOM_IDS } from '../config/constants.js';

const logger = getLogger();

export class ModalHelper {
    constructor() {
        // Confirmation modal elements
        this.confirmModal = document.getElementById(DOM_IDS.MODALS.CONFIRM);
        this.confirmModalOverlay = this.confirmModal?.querySelector('.modal-overlay');
        this.confirmMessage = this.confirmModal?.querySelector('.confirm-message');
        this.confirmYesBtn = document.getElementById(DOM_IDS.BUTTONS.CONFIRM_YES);
        this.confirmNoBtn = document.getElementById(DOM_IDS.BUTTONS.CONFIRM_NO);
        
        // Notification modal elements
        this.notificationModal = document.getElementById(DOM_IDS.MODALS.NOTIFICATION);
        this.notificationModalOverlay = this.notificationModal?.querySelector('.modal-overlay');
        this.notificationMessage = document.getElementById(DOM_IDS.CONTAINERS.NOTIFICATION_MESSAGE);
        this.notificationOkBtn = document.getElementById(DOM_IDS.BUTTONS.NOTIFICATION_OK);
        
        // Setup global event listeners
        this.setupGlobalListeners();
    }

    /**
     * Setup global listeners (Escape key)
     */
    setupGlobalListeners() {
        // Close modals on Escape key
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.handleCancel();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }
    
    /**
     * Handle modal cancellation (ESC or backdrop click)
     */
    handleCancel() {
        // Resolve confirm modal if open
        if (this.confirmResolve) {
            this.closeModal(this.confirmModal);
            this.confirmResolve(false);
            this.confirmResolve = null;
        }
        
        // Resolve notification modal if open
        if (this.notificationResolve) {
            this.closeModal(this.notificationModal);
            this.notificationResolve();
            this.notificationResolve = null;
        }
    }

    /**
     * Shows a confirmation dialog with Yes/No buttons
     * @param {string} message - The message to display
     * @returns {Promise<boolean>} - Resolves to true if user clicks Yes, false if No
     */
    confirm(message) {
        return new Promise((resolve) => {
            if (!this.confirmModal) {
                logger.error('[ModalHelper] Confirm modal not found');
                resolve(false);
                return;
            }
            
            // Store resolve for backdrop/ESC handling
            this.confirmResolve = resolve;
            
            // Set message
            if (this.confirmMessage) {
                this.confirmMessage.textContent = message;
            }
            
            // Setup backdrop click handler
            const backdropHandler = (e) => {
                if (e.target === this.confirmModal) {
                    this.confirmModal.removeEventListener('click', backdropHandler);
                    this.handleCancel();
                }
            };
            this.confirmModal.addEventListener('click', backdropHandler);
            
            // Show modal
            this.openModal(this.confirmModal);
            
            // Focus on Yes button after modal opens
            setTimeout(() => {
                if (this.confirmYesBtn) {
                    this.confirmYesBtn.focus();
                }
            }, 100);
            
            // Remove old listeners (prevent duplicates)
            const newYesBtn = this.confirmYesBtn.cloneNode(true);
            const newNoBtn = this.confirmNoBtn.cloneNode(true);
            this.confirmYesBtn.replaceWith(newYesBtn);
            this.confirmNoBtn.replaceWith(newNoBtn);
            this.confirmYesBtn = newYesBtn;
            this.confirmNoBtn = newNoBtn;
            
            // Setup new listeners
            const handleYes = () => {
                this.closeModal(this.confirmModal);
                this.confirmResolve = null;
                resolve(true);
            };
            
            const handleNo = () => {
                this.closeModal(this.confirmModal);
                this.confirmResolve = null;
                resolve(false);
            };
            
            // Enter key confirms (Yes)
            const handleEnter = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleYes();
                    this.confirmModal.removeEventListener('keydown', handleEnter);
                }
            };
            this.confirmModal.addEventListener('keydown', handleEnter);
            
            this.confirmYesBtn.addEventListener('click', handleYes);
            this.confirmNoBtn.addEventListener('click', handleNo);
        });
    }

    /**
     * Shows an alert/notification dialog with OK button
     * @param {string} message - The message to display
     * @returns {Promise<void>} - Resolves when user dismisses the notification
     */
    alert(message) {
        return new Promise((resolve) => {
            if (!this.notificationModal) {
                logger.error('[ModalHelper] Notification modal not found');
                resolve();
                return;
            }
            
            // Store resolve for backdrop/ESC handling
            this.notificationResolve = resolve;
            
            // Set message
            if (this.notificationMessage) {
                this.notificationMessage.textContent = message;
            }
            
            // Setup backdrop click handler
            const backdropHandler = (e) => {
                if (e.target === this.notificationModal) {
                    this.notificationModal.removeEventListener('click', backdropHandler);
                    this.handleCancel();
                }
            };
            this.notificationModal.addEventListener('click', backdropHandler);
            
            // Show modal
            this.openModal(this.notificationModal);
            
            // Focus on OK button after modal opens
            setTimeout(() => {
                if (this.notificationOkBtn) {
                    this.notificationOkBtn.focus();
                }
            }, 100);
            
            // Remove old listener (prevent duplicates)
            const newOkBtn = this.notificationOkBtn.cloneNode(true);
            this.notificationOkBtn.replaceWith(newOkBtn);
            this.notificationOkBtn = newOkBtn;
            
            // Setup new listener
            const handleOk = () => {
                this.closeModal(this.notificationModal);
                this.notificationResolve = null;
                resolve();
            };
            
            // Enter key closes notification
            const handleEnter = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleOk();
                    this.notificationModal.removeEventListener('keydown', handleEnter);
                }
            };
            this.notificationModal.addEventListener('keydown', handleEnter);
            
            this.notificationOkBtn.addEventListener('click', handleOk);
        });
    }

    /**
     * Open modal with animation
     */
    openModal(modal) {
        if (modal) {
            modal.style.display = 'block';
            // Trigger animation
            requestAnimationFrame(() => {
                modal.classList.add('modal-open');
            });
        }
    }

    /**
     * Close modal with animation
     */
    closeModal(modal) {
        if (modal) {
            modal.classList.remove('modal-open');
            // Wait for animation before hiding
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Show custom modal with custom content
     * @param {string} title - Modal title
     * @param {string|HTMLElement} content - Modal content (HTML string or element)
     * @param {Array} buttons - Array of button configs: { text, callback, primary }
     */
    custom(title, content, buttons = []) {
        return new Promise((resolve) => {
            // Create custom modal dynamically
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            
            // Title
            const titleEl = document.createElement('h2');
            titleEl.textContent = title;
            modalContent.appendChild(titleEl);
            
            // Content
            if (typeof content === 'string') {
                const contentEl = document.createElement('div');
                contentEl.innerHTML = content;
                modalContent.appendChild(contentEl);
            } else {
                modalContent.appendChild(content);
            }
            
            // Buttons
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'modal-buttons';
            
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.textContent = btn.text;
                if (btn.primary) {
                    button.classList.add('primary');
                }
                button.addEventListener('click', () => {
                    modal.remove();
                    if (btn.callback) {
                        btn.callback();
                    }
                    resolve(btn.value || null);
                });
                buttonsContainer.appendChild(button);
            });
            
            modalContent.appendChild(buttonsContainer);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(null);
                }
            });
        });
    }

    /**
     * Add standard keyboard accessibility to any modal
     * This is the same pattern used by confirm() and alert() methods
     * @param {HTMLElement} modal - The modal element
     * @param {Function} onConfirm - Callback when Enter is pressed
     * @param {Function} onCancel - Callback when Escape is pressed
     * @returns {Function} Cleanup function to remove listeners
     */
    static addKeyboardAccessibility(modal, onConfirm, onCancel) {
        if (!modal) return () => {};

        // Enter key handler (same as confirm/alert)
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (onConfirm) onConfirm();
            }
        };

        // Escape key handler (same as confirm/alert)
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                if (onCancel) onCancel();
                document.removeEventListener('keydown', handleEscape);
            }
        };

        // Attach Enter to modal (catches all elements inside)
        modal.addEventListener('keydown', handleEnter);

        // Attach Escape globally
        document.addEventListener('keydown', handleEscape);

        // Return cleanup function
        return () => {
            modal.removeEventListener('keydown', handleEnter);
            document.removeEventListener('keydown', handleEscape);
        };
    }
}
