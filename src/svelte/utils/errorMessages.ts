import { ERROR_CODES, type ErrorSeverity, type KnownErrorCode } from './errorCodes';

const ERROR_MESSAGES: Partial<Record<KnownErrorCode, string>> = {
  [ERROR_CODES.UNKNOWN.UNEXPECTED]: 'An unexpected error occurred.',
  [ERROR_CODES.UNKNOWN.RUNTIME]: 'A runtime error occurred.',
  [ERROR_CODES.UNKNOWN.UNHANDLED_REJECTION]: 'An unexpected async error occurred.',

  [ERROR_CODES.VALIDATION.REQUIRED]: 'Please fill in required fields.',
  [ERROR_CODES.VALIDATION.INVALID_FORMAT]: 'Some values have an invalid format.',
  [ERROR_CODES.VALIDATION.OUT_OF_RANGE]: 'Some values are out of allowed range.',

  [ERROR_CODES.STATE.INVALID_STATE]: 'The app state is inconsistent. Please refresh.',
  [ERROR_CODES.STATE.NOT_READY]: 'The app is still loading. Try again in a moment.',
  [ERROR_CODES.STATE.LOAD_FAILED]: 'Failed to load required app state.',

  [ERROR_CODES.NETWORK.REQUEST_FAILED]: 'Network request failed. Check your connection.',
  [ERROR_CODES.NETWORK.TIMEOUT]: 'Request timed out. Please try again.',
  [ERROR_CODES.NETWORK.UNAUTHORIZED]: 'Session expired. Please sign in again.',

  [ERROR_CODES.DB.READ_FAILED]: 'Failed to read data from storage.',
  [ERROR_CODES.DB.WRITE_FAILED]: 'Failed to save data to storage.',

  [ERROR_CODES.SYNC.LOAD_FAILED]: 'Failed to load synchronized data.',
  [ERROR_CODES.SYNC.SAVE_FAILED]: 'Failed to save synchronized data.',
  [ERROR_CODES.SYNC.CONFLICT]: 'Data conflict detected. Please refresh and retry.',

  [ERROR_CODES.UI.ACTION_FAILED]: 'Action could not be completed.',
  [ERROR_CODES.UI.COPY_FAILED]: 'Could not copy to clipboard.',

  [ERROR_CODES.APP.BOOTSTRAP_FAILED]: 'Failed to initialize application shell.',

  [ERROR_CODES.ROSTER_SWITCHER.REFRESH_FAILED]: 'Failed to refresh roster switcher data.',
  [ERROR_CODES.ROSTER_SWITCHER.ACTION_FAILED]: 'Failed to execute roster action.',
  [ERROR_CODES.ROSTER_SWITCHER.TOGGLE_VISIBLE_FAILED]: 'Failed to update visible rosters.',

  [ERROR_CODES.WEEKLY.LOAD_ALL_FAILED]: 'Failed to load weekly data.',
  [ERROR_CODES.WEEKLY.LOAD_VISIBLE_ROSTERS_FAILED]: 'Failed to load visible rosters.',
  [ERROR_CODES.WEEKLY.API_READY_TIMEOUT]: 'Timed out while waiting for app initialization.',
  [ERROR_CODES.WEEKLY.API_READY_FAILED]: 'App initialization failed.',
  [ERROR_CODES.WEEKLY.SETTINGS_REFRESH_FAILED]: 'Failed to refresh settings snapshot.',
  [ERROR_CODES.WEEKLY.EMPTY_CARDS]: 'Weekly cards could not be computed.',
  [ERROR_CODES.WEEKLY.LOAD_FROM_DB_FAILED]: 'Failed to load weekly data from database.',
  [ERROR_CODES.WEEKLY.DEBUG_COPY_FAILED]: 'Failed to copy weekly debug snapshot.',

  [ERROR_CODES.FRIENDS.INIT_FAILED]: 'Failed to initialize Friends.',
  [ERROR_CODES.FRIENDS.ACTIVE_ROSTER_REFRESH_FAILED]: 'Failed to refresh Friends after roster change.',
  [ERROR_CODES.FRIENDS.REFRESH_FAILED]: 'Failed to refresh friends data.',
  [ERROR_CODES.FRIENDS.UPLOAD_FAILED]: 'Failed to upload weekly data for friends.',
  [ERROR_CODES.FRIENDS.AUTO_UPLOAD_FAILED]: 'Auto upload failed.',
  [ERROR_CODES.FRIENDS.PIN_SYNC_FAILED]: 'Failed to sync updated PIN.',
  [ERROR_CODES.FRIENDS.ADD_FRIEND_FAILED]: 'Could not add friend with provided code/PIN.',
  [ERROR_CODES.FRIENDS.COPY_CODE_FAILED]: 'Could not copy roster code.',
  [ERROR_CODES.FRIENDS.SAVE_CONFIG_FAILED]: 'Failed to save Friends configuration.',
};

const ERROR_SEVERITY: Partial<Record<KnownErrorCode, ErrorSeverity>> = {
  [ERROR_CODES.VALIDATION.REQUIRED]: 'warning',
  [ERROR_CODES.VALIDATION.INVALID_FORMAT]: 'warning',
  [ERROR_CODES.VALIDATION.OUT_OF_RANGE]: 'warning',
  [ERROR_CODES.UI.COPY_FAILED]: 'warning',
  [ERROR_CODES.WEEKLY.API_READY_TIMEOUT]: 'warning',
  [ERROR_CODES.WEEKLY.EMPTY_CARDS]: 'warning',
  [ERROR_CODES.WEEKLY.SETTINGS_REFRESH_FAILED]: 'warning',
  [ERROR_CODES.FRIENDS.COPY_CODE_FAILED]: 'warning',
  [ERROR_CODES.FRIENDS.AUTO_UPLOAD_FAILED]: 'warning',
};

export function resolveErrorMessage(code: string, fallbackMessage: string): string {
  return ERROR_MESSAGES[code as KnownErrorCode] || fallbackMessage;
}

export function resolveErrorSeverity(code: string, fallbackSeverity: ErrorSeverity = 'error'): ErrorSeverity {
  return ERROR_SEVERITY[code as KnownErrorCode] || fallbackSeverity;
}
