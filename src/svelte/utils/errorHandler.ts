import type { AppApi } from '../../types/app-api';
import { TOAST_TYPES } from '../legacy/config/constants.js';
import { ERROR_CODES, type ErrorSeverity, type KnownErrorCode } from './errorCodes';
import { resolveErrorMessage, resolveErrorSeverity } from './errorMessages';

export type { ErrorSeverity };

export type SvelteErrorRecord = {
  code: string;
  message: string;
  severity: ErrorSeverity;
  timestamp: string;
  stack?: string;
  cause?: unknown;
  context?: Record<string, unknown>;
};

export type ReportErrorOptions = {
  code?: KnownErrorCode | string;
  severity?: ErrorSeverity;
  context?: Record<string, unknown>;
  showToast?: boolean;
};

const MAX_SVELTE_ERROR_LOG = 80;
const inMemoryErrors: SvelteErrorRecord[] = [];
let initialized = false;

function getApi(): AppApi | null {
  return (window as Window & { api?: AppApi }).api || null;
}

function getUiHelper() {
  return (window as Window & { UIHelper?: { showToast?: (message: string, type?: string) => void } }).UIHelper;
}

function serializeCause(cause: unknown): unknown {
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
    };
  }

  if (typeof cause === 'string' || typeof cause === 'number' || typeof cause === 'boolean' || cause === null || cause === undefined) {
    return cause;
  }

  if (Array.isArray(cause)) {
    return cause.map((item) => serializeCause(item));
  }

  if (typeof cause === 'object') {
    const entries = Object.entries(cause as Record<string, unknown>);
    return entries.reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[key] = serializeCause(value);
      return acc;
    }, {});
  }

  return String(cause);
}

function normalizeError(error: unknown, options: ReportErrorOptions = {}): SvelteErrorRecord {
  const asError = error instanceof Error ? error : null;
  const code = options.code || ERROR_CODES.UNKNOWN.UNEXPECTED;
  const fallbackMessage = asError?.message || String(error || 'Unknown Svelte error');
  const message = resolveErrorMessage(code, fallbackMessage);
  const severity = resolveErrorSeverity(code, options.severity || 'error');
  const cause = asError && 'cause' in asError
    ? serializeCause((asError as Error & { cause?: unknown }).cause)
    : undefined;

  return {
    code,
    message,
    severity,
    timestamp: new Date().toISOString(),
    stack: asError?.stack,
    cause,
    context: options.context,
  };
}

async function persistError(record: SvelteErrorRecord) {
  inMemoryErrors.push(record);
  if (inMemoryErrors.length > MAX_SVELTE_ERROR_LOG) {
    inMemoryErrors.shift();
  }

  const api = getApi();
  if (!api) return;

  try {
    await api.logError?.('[SvelteErrorHandler]', record);
  } catch {
    console.error('[SvelteErrorHandler] Failed to persist in app logger', record);
  }
}

function maybeShowToast(record: SvelteErrorRecord, showToast = false) {
  if (!showToast) return;

  const uiHelper = getUiHelper();
  const toastType = record.severity === 'warning'
    ? TOAST_TYPES.WARNING
    : record.severity === 'info'
      ? TOAST_TYPES.INFO
      : TOAST_TYPES.ERROR;

  if (uiHelper?.showToast) {
    uiHelper.showToast(record.message, toastType);
    return;
  }

  console.warn('[SvelteErrorHandler] UIHelper unavailable for toast:', record.message);
}

export async function reportError(error: unknown, options: ReportErrorOptions = {}) {
  const record = normalizeError(error, options);
  console.error('[SvelteErrorHandler]', record);
  await persistError(record);
  maybeShowToast(record, Boolean(options.showToast));
  return record;
}

export function getRecentSvelteErrors() {
  return [...inMemoryErrors];
}

export function initSvelteErrorHandler() {
  if (initialized) return;
  initialized = true;

  (
    window as Window & {
      __WTL_getSvelteErrors?: () => SvelteErrorRecord[];
      __WTL_reportSvelteError?: (error: unknown, options?: ReportErrorOptions) => Promise<SvelteErrorRecord>;
    }
  ).__WTL_getSvelteErrors = () => getRecentSvelteErrors();
  (
    window as Window & {
      __WTL_getSvelteErrors?: () => SvelteErrorRecord[];
      __WTL_reportSvelteError?: (error: unknown, options?: ReportErrorOptions) => Promise<SvelteErrorRecord>;
    }
  ).__WTL_reportSvelteError = (error: unknown, options: ReportErrorOptions = {}) => reportError(error, options);

  window.addEventListener('error', (event) => {
    void reportError(event.error || event.message, {
      code: ERROR_CODES.UNKNOWN.RUNTIME,
      severity: 'error',
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      showToast: false,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    void reportError(event.reason, {
      code: ERROR_CODES.UNKNOWN.UNHANDLED_REJECTION,
      severity: 'error',
      context: {
        reason: event.reason,
      },
      showToast: false,
    });
  });
}
