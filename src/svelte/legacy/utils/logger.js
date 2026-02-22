/**
 * Logger - Client-side logging utility (with IPC bridge to main process)
 */

class Logger {
    constructor() {
        this.isDevelopment = true;
        this.hasIpcBridge = typeof window !== 'undefined' && window.api;
    }

    /**
     * Format log message
     */
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}]`;
        
        if (context && Object.keys(context).length > 0) {
            return [prefix, message, context];
        }
        return [prefix, message];
    }

    /**
     * Send log to main process via IPC
     */
    async sendToMainProcess(level, message, context) {
        if (!this.hasIpcBridge) return;
        
        try {
            switch(level) {
                case 'DEBUG':
                    await window.api.logDebug(message, context);
                    break;
                case 'INFO':
                    await window.api.logInfo(message, context);
                    break;
                case 'WARN':
                    await window.api.logWarn(message, context);
                    break;
                case 'ERROR':
                    await window.api.logError(message, context);
                    break;
            }
        } catch (error) {
            console.error('[Logger] Failed to send log to main process:', error);
        }
    }

    /**
     * Log debug message
     */
    debug(message, context = {}) {
        if (this.isDevelopment) {
            console.log(...this.formatMessage('DEBUG', message, context));
        }
        // Send to main process to write to file
        this.sendToMainProcess('DEBUG', message, context);
    }

    /**
     * Log info message
     */
    info(message, context = {}) {
        console.info(...this.formatMessage('INFO', message, context));
        // Send to main process
        this.sendToMainProcess('INFO', message, context);
    }

    /**
     * Log warning message
     */
    warn(message, context = {}) {
        console.warn(...this.formatMessage('WARN', message, context));
        // Send to main process
        this.sendToMainProcess('WARN', message, context);
    }

    /**
     * Log error message
     */
    error(message, context = {}) {
        console.error(...this.formatMessage('ERROR', message, context));
        // Send to main process
        this.sendToMainProcess('ERROR', message, context);
    }

    /**
     * Log exception with stack trace
     */
    exception(error, context = {}) {
        const errorInfo = {
            ...context,
            name: error.name,
            message: error.message,
            stack: error.stack
        };
        console.error(...this.formatMessage('EXCEPTION', error.message, errorInfo));

        // Send to main process
        if (this.hasIpcBridge) {
            window.api.logException(error, context);
        }
    }

    /**
     * Get recent logs from main process
     */
    async getRecentLogs(maxLines = 100, logType = 'app') {
        if (!this.hasIpcBridge) {
            return [];
        }
        
        try {
            return await window.api.getRecentLogs(maxLines, logType);
        } catch (error) {
            console.error('[Logger] Failed to get recent logs:', error);
            return [];
        }
    }
}

// Create singleton instance
let loggerInstance = null;

export function getLogger() {
    if (!loggerInstance) {
        loggerInstance = new Logger();
    }
    return loggerInstance;
}

export { Logger };
