/**
 * DateFormatter - Format dates according to user settings
 * Responsibilities:
 * - Format dates based on user's dateFormat preference (dd/mm/yyyy or mm/dd/yyyy)
 * - Format time based on user's timeFormat preference (12h or 24h)
 * - Handle timezone conversion
 * - Provide consistent date/time display across the application
 */

export class DateFormatter {
    constructor(settings = null) {
        this.settings = settings || {
            dateFormat: 'browser',
            timeFormat: 'browser',
            timezone: 'browser'
        };
        
        // Detect system timezone
        this.systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.browserLocale = navigator?.language || 'en-US';
    }

    /**
     * Get current timezone being used
     */
    getCurrentTimezone() {
        const timezone = this.settings?.timezone;
        if (!timezone || timezone === 'local' || timezone === 'browser') {
            return this.systemTimezone;
        }
        return timezone;
    }
    
    /**
     * Get timezone offset in minutes
     */
    getTimezoneOffset(date) {
        // For 'local', use system timezone offset
        if (this.settings.timezone === 'local') {
            return date.getTimezoneOffset();
        }
        
        // For specific timezones, calculate offset
        // Note: This is a simplified implementation
        // For production, consider using a library like date-fns-tz or moment-timezone
        return date.getTimezoneOffset();
    }

    /**
     * Update settings
     */
    updateSettings(settings) {
        this.settings = settings;
    }

    /**
     * Format a timestamp to full date and time string
     * @param {number|string|Date} timestamp - Timestamp to format
     * @returns {string} Formatted date and time string
     */
    format(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const dateStr = this.formatDate(date);
        const timeStr = this.formatTime(date);
        
        return `${dateStr} ${timeStr}`;
    }

    /**
     * Format only the date part
     * @param {Date} date - Date object to format
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        // Get the timezone to use
        const timezone = this.getCurrentTimezone();

        if (this.settings?.dateFormat === 'browser') {
            return new Intl.DateTimeFormat(this.browserLocale, {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(date);
        }
        
        // Use toLocaleString to get parts in the correct timezone
        const options = { 
            timeZone: timezone,
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit'
        };
        
        const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
        const day = parts.find(p => p.type === 'day').value;
        const month = parts.find(p => p.type === 'month').value;
        const year = parts.find(p => p.type === 'year').value;
        
        if (this.settings.dateFormat === 'mm/dd/yyyy') {
            return `${month}/${day}/${year}`;
        }
        
        // Default: dd/mm/yyyy
        return `${day}/${month}/${year}`;
    }

    /**
     * Format only the time part
     * @param {Date} date - Date object to format
     * @returns {string} Formatted time string
     */
    formatTime(date) {
        // Get the timezone to use
        const timezone = this.getCurrentTimezone();

        if (this.settings?.timeFormat === 'browser') {
            return new Intl.DateTimeFormat(this.browserLocale, {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).format(date);
        }
        
        // Use toLocaleString to get parts in the correct timezone
        const options = { 
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        
        const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
        const hours = parseInt(parts.find(p => p.type === 'hour').value);
        const minutes = parts.find(p => p.type === 'minute').value;
        const seconds = parts.find(p => p.type === 'second').value;
        
        if (this.settings.timeFormat === '12h') {
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            return `${displayHours}:${minutes}:${seconds} ${period}`;
        }
        
        // Default: 24h
        const displayHours = String(hours).padStart(2, '0');
        return `${displayHours}:${minutes}:${seconds}`;
    }

    /**
     * Format date only (no time)
     * @param {number|string|Date} timestamp - Timestamp to format
     * @returns {string} Formatted date string
     */
    formatDateOnly(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        return this.formatDate(date);
    }

    /**
     * Format time only (no date)
     * @param {number|string|Date} timestamp - Timestamp to format
     * @returns {string} Formatted time string
     */
    formatTimeOnly(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        return this.formatTime(date);
    }

    /**
     * Format a short date (without seconds)
     * @param {number|string|Date} timestamp - Timestamp to format
     * @returns {string} Formatted short date and time string
     */
    formatShort(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const dateStr = this.formatDate(date);

        if (this.settings?.timeFormat === 'browser') {
            const timeStr = new Intl.DateTimeFormat(this.browserLocale, {
                timeZone: this.getCurrentTimezone(),
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
            return `${dateStr} ${timeStr}`;
        }
        
        // Get the timezone to use
        const timezone = this.getCurrentTimezone();
        
        // Use toLocaleString to get parts in the correct timezone
        const options = { 
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
        const hours = parseInt(parts.find(p => p.type === 'hour').value);
        const minutes = parts.find(p => p.type === 'minute').value;
        
        if (this.settings.timeFormat === '12h') {
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            return `${dateStr} ${displayHours}:${minutes} ${period}`;
        }
        
        const displayHours = String(hours).padStart(2, '0');
        return `${dateStr} ${displayHours}:${minutes}`;
    }

    /**
     * Format relative time (e.g., "2 hours ago", "3 days ago")
     * @param {number|string|Date} timestamp - Timestamp to format
     * @returns {string} Relative time string
     */
    formatRelative(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSecs < 60) {
            return 'just now';
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else {
            return this.format(timestamp);
        }
    }
}

/**
 * Create a singleton instance for easy access
 */
let instance = null;

export function getDateFormatter(settings = null) {
    if (!instance) {
        instance = new DateFormatter(settings);
    } else if (settings) {
        instance.updateSettings(settings);
    }
    return instance;
}

/**
 * Format time until next reset (daily or weekly)
 * @param {Date} nextReset - Next reset date
 * @returns {string} Formatted time string (e.g., "5:23:14" or "1d 12:34:56")
 */
export function formatTimeUntilReset(nextReset) {
    const now = new Date();
    const timeDiff = nextReset - now;
    
    if (timeDiff <= 0) {
        return 'Active';
    }
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    if (days > 0) {
        return `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}
