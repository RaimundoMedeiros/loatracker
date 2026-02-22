import { reportError, type ReportErrorOptions, type SvelteErrorRecord } from './errorHandler';

type ErrorWrapperOptions = ReportErrorOptions & {
  rethrow?: boolean;
};

export async function withAsyncError<T>(
  fn: () => Promise<T>,
  options: ErrorWrapperOptions = {}
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const record = await reportError(error, options);
    if (options.rethrow) {
      throw record;
    }
    return null;
  }
}

export function withSyncError<T>(
  fn: () => T,
  options: ErrorWrapperOptions = {}
): T | null {
  try {
    return fn();
  } catch (error) {
    const fallbackRecord: SvelteErrorRecord = {
      code: options.code || 'UNKNOWN_UNEXPECTED',
      message: error instanceof Error ? error.message : String(error || 'Unexpected error'),
      severity: options.severity || 'error',
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
      context: options.context,
    };

    void reportError(error, options);
    if (options.rethrow) {
      throw fallbackRecord;
    }
    return null;
  }
}
