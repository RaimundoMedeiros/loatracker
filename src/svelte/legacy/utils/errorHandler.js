/**
 * Error Handler - Centralized error handling system
 * Responsibilities:
 * - Define custom error types
 * - Handle and log errors
 * - Display user-friendly error messages
 */
import { getLogger } from './logger.js';

const logger = getLogger();

// Custom Error Classes
export class AppError extends Error {
    constructor(message, code, severity = 'error', context = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.severity = severity; // 'error', 'warning', 'info'
        this.context = context;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message, field, context = {}) {
        super(message, 'VALIDATION_ERROR', 'warning', { field, ...context });
    }
}

export class DatabaseError extends AppError {
    constructor(message, query, context = {}) {
        super(message, 'DATABASE_ERROR', 'error', { query, ...context });
    }
}

export class FileSystemError extends AppError {
    constructor(message, path, context = {}) {
        super(message, 'FILESYSTEM_ERROR', 'error', { path, ...context });
    }
}

export class NetworkError extends AppError {
    constructor(message, endpoint, context = {}) {
        super(message, 'NETWORK_ERROR', 'error', { endpoint, ...context });
    }
}

export class StateError extends AppError {
    constructor(message, context = {}) {
        super(message, 'STATE_ERROR', 'error', context);
    }
}

/**
 * Error Handler Class
 */
export class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
        this.listeners = [];
    }

    /**
     * Handle error with logging and user notification
     */
    handle(error, showToUser = true) {
        // Normalize error
        const normalizedError = this.normalizeError(error);
        
        // Log error
        this.logError(normalizedError);
        
        // Notify listeners
        this.notifyListeners(normalizedError);
        
        // Show to user if needed
        if (showToUser) {
            this.displayError(normalizedError);
        }
        
        // Log for development
        logger.error('[ErrorHandler]', { error: normalizedError });
        
        return normalizedError;
    }

    /**
     * Normalize any error to AppError
     */
    normalizeError(error) {
        if (error instanceof AppError) {
            return error;
        }
        
        // Handle standard errors
        if (error instanceof Error) {
            return new AppError(
                error.message,
                'UNKNOWN_ERROR',
                'error',
                { originalError: error.name, stack: error.stack }
            );
        }
        
        // Handle string errors
        if (typeof error === 'string') {
            return new AppError(error, 'UNKNOWN_ERROR', 'error');
        }
        
        // Handle unknown errors
        return new AppError(
            'An unknown error occurred',
            'UNKNOWN_ERROR',
            'error',
            { originalError: error }
        );
    }

    /**
     * Log error to internal log
     */
    logError(error) {
        this.errorLog.push({
            timestamp: error.timestamp || new Date().toISOString(),
            code: error.code,
            message: error.message,
            severity: error.severity,
            context: error.context,
            stack: error.stack
        });
        
        // Maintain max log size
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }
    }

    /**
     * Display error to user
     */
    displayError(error) {
        const message = this.getUserFriendlyMessage(error);
        const severity = error.severity || 'error';
        
        // Use toast notification system
        if (window.UIHelper) {
            const ui = window.UIHelper;
            if (severity === 'warning') {
                ui.showToast(message, 'warning');
            } else if (severity === 'info') {
                ui.showToast(message, 'info');
            } else {
                ui.showToast(message, 'error');
            }
        } else {
            // Fallback to alert
            alert(message);
        }
    }

    /**
     * Get user-friendly error message
     */
    getUserFriendlyMessage(error) {
        const messages = {
            'VALIDATION_ERROR': `Invalid ${error.context?.field || 'input'}: ${error.message}`,
            'DATABASE_ERROR': 'Failed to access database. Please check your database configuration.',
            'FILESYSTEM_ERROR': `File system error: ${error.message}`,
            'NETWORK_ERROR': 'Network error. Please check your connection.',
            'STATE_ERROR': 'Application state error. Please refresh the page.',
            'UNKNOWN_ERROR': error.message || 'An unexpected error occurred.'
        };
        
        return messages[error.code] || error.message || 'An error occurred.';
    }

    /**
     * Subscribe to error events
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Notify all listeners
     */
    notifyListeners(error) {
        this.listeners.forEach(callback => {
            try {
                callback(error);
            } catch (err) {
                logger.error('[ErrorHandler] Listener error:', { error: err.message, stack: err.stack });
            }
        });
    }

    /**
     * Get error log
     */
    getErrorLog() {
        return [...this.errorLog];
    }

    /**
     * Clear error log
     */
    clearErrorLog() {
        this.errorLog = [];
    }

    /**
     * Async wrapper with error handling
     */
    async wrap(fn, context = {}) {
        try {
            return await fn();
        } catch (error) {
            throw this.handle(error);
        }
    }

    /**
     * Sync wrapper with error handling
     */
    wrapSync(fn, context = {}) {
        try {
            return fn();
        } catch (error) {
            throw this.handle(error);
        }
    }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Global error handlers
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        errorHandler.handle(new AppError(
            event.message,
            'RUNTIME_ERROR',
            'error',
            {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            }
        ));
    });

    window.addEventListener('unhandledrejection', (event) => {
        errorHandler.handle(new AppError(
            event.reason?.message || 'Unhandled promise rejection',
            'PROMISE_REJECTION',
            'error',
            { reason: event.reason }
        ));
    });
}
