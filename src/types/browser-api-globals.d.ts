import type { AppApi } from './app-api';

declare global {
  interface DataTransferItem {
    getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
  }

  interface Window {
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: Array<{
        description?: string;
        accept?: Record<string, string[]>;
      }>;
      excludeAcceptAllOption?: boolean;
    }) => Promise<any[]>;
    api: AppApi;
    __API_READY__: Promise<void>;
  }
}

export {};
