declare module 'wa-sqlite/dist/wa-sqlite-async.mjs' {
  const factory: (options?: { wasmBinary?: ArrayBuffer }) => Promise<unknown>;
  export default factory;
}

declare module 'wa-sqlite' {
  export const SQLITE_ROW: number;
  export const SQLITE_OPEN_READONLY: number;
  export const SQLITE_OPEN_URI: number;
  export function Factory(module: unknown): any;
}

declare module 'wa-sqlite/src/VFS.js' {
  export class Base {}
  export const SQLITE_OK: number;
  export const SQLITE_CANTOPEN: number;
  export const SQLITE_OPEN_READONLY: number;
  export const SQLITE_IOERR_SHORT_READ: number;
  export const SQLITE_IOERR_READ: number;
  export const SQLITE_READONLY: number;
  export const SQLITE_NOTFOUND: number;
  export const SQLITE_IOCAP_IMMUTABLE: number;
}

declare class FileReaderSync {
  readAsArrayBuffer(blob: Blob): ArrayBuffer;
}
