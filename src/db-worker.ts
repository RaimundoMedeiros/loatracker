import SQLiteAsyncFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
import * as SQLite from 'wa-sqlite';
import * as VFS from 'wa-sqlite/src/VFS.js';
import wasmUrl from 'wa-sqlite/dist/wa-sqlite-async.wasm?url';

type SqliteRowRecord = Record<string, unknown>;
type ResetPeriod = { start: number; end: number };

type WorkerRequest = {
  type: string;
  id: number;
  payload?: Record<string, unknown>;
};

type HandlerPayloads = {
  init: { file?: File };
  close: Record<string, never>;
  getRaids: Record<string, never>;
  getDailyGuardianRaids: { characterName?: string };
  getDailyFieldBoss: { rosterNames?: string[] };
  getDailyChaosGate: { rosterNames?: string[] };
  getWeeklyThaemine: { rosterNames?: string[] };

};

type HandlerMap = {
  [K in keyof HandlerPayloads]: (payload: HandlerPayloads[K]) => Promise<unknown>;
};

const TRACKED_WEEKLY_BOSSES = [
  'Aegir, the Oppressor',
  'Phantom Manifester Brelshaza',
  'Mordum, the Abyssal Punisher',
  'Flash of Punishment',
  'Armoche, Sentinel of the Abyss',
  'Archdemon Kazeros',
  'Death Incarnate Kazeros',
  'Corvus Tul Rak',
];

const GUARDIAN_BOSSES = ['Argeos', 'Skolakia', 'Drextalas', 'Krathios', "Krathios's Tail"];
const FIELD_BOSS_NAMES = ['Sevek Atun', 'Field Boss: Sevek Atun'];
const CHAOS_GATE_NAMES = [
  'Soft Bean Legion Honey-Filled Tricolor Sweetcake',
  'Darkness Legion Kiril',
  'Phantom Legion Chess King',
  'Mayhem Legion Stella'
];
const THAEMINE_BOSS_NAME = 'Thaemine, Conqueror of Stars';

function getWeeklyResetPeriod(now = new Date()): ResetPeriod {
  const end = new Date(now);
  const daysUntilWednesday = (3 - end.getUTCDay() + 7) % 7;
  if (daysUntilWednesday === 0 && end.getUTCHours() >= 8) {
    end.setUTCDate(end.getUTCDate() + 7);
  } else {
    end.setUTCDate(end.getUTCDate() + daysUntilWednesday);
  }

  end.setUTCHours(8, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start: start.getTime(), end: end.getTime() };
}

function getDailyResetPeriod(now = new Date()): ResetPeriod {
  const start = new Date(now);
  if (start.getUTCHours() < 10) start.setUTCDate(start.getUTCDate() - 1);
  start.setUTCHours(10, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

let sqlite3: any = null;
let db: any = null;

class FileSnapshotVFS extends (VFS as any).Base {
  name = 'file-snapshot';
  mxPathname = 256;

  #openFiles = new Map<number, File>();
  #file: File | null = null;

  setFile(file: File) {
    this.#file = file;
  }

  xOpen(name: string, fileId: number, flags: number, pOutFlags: DataView) {
    const isAux = name?.endsWith('-wal') || name?.endsWith('-shm') || name?.endsWith('-journal');
    if (isAux) return (VFS as any).SQLITE_CANTOPEN;

    if (!this.#file) {
      return (VFS as any).SQLITE_CANTOPEN;
    }

    this.#openFiles.set(fileId, this.#file);
    pOutFlags.setInt32(0, flags | (VFS as any).SQLITE_OPEN_READONLY, true);
    return (VFS as any).SQLITE_OK;
  }

  xClose(fileId: number) {
    this.#openFiles.delete(fileId);
    return (VFS as any).SQLITE_OK;
  }

  xRead(fileId: number, pData: Uint8Array, iOffset: number) {
    const file = this.#openFiles.get(fileId);
    if (!file) {
      pData.fill(0);
      return (VFS as any).SQLITE_IOERR_SHORT_READ;
    }

    try {
      const offset = Number(iOffset);
      if (offset >= file.size) {
        pData.fill(0);
        return (VFS as any).SQLITE_IOERR_SHORT_READ;
      }

      const end = Math.min(offset + pData.byteLength, file.size);
      const reader = new FileReaderSync();
      const buf = reader.readAsArrayBuffer(file.slice(offset, end));
      const src = new Uint8Array(buf);
      pData.set(src);

      if (src.byteLength < pData.byteLength) {
        pData.fill(0, src.byteLength);
        return (VFS as any).SQLITE_IOERR_SHORT_READ;
      }

      return (VFS as any).SQLITE_OK;
    } catch (err) {
      console.error('[FileSnapshotVFS] xRead error at offset', Number(iOffset), err);
      return (VFS as any).SQLITE_IOERR_READ;
    }
  }

  xWrite() {
    return (VFS as any).SQLITE_READONLY;
  }

  xTruncate() {
    return (VFS as any).SQLITE_READONLY;
  }

  xSync() {
    return (VFS as any).SQLITE_OK;
  }

  xFileSize(fileId: number, pSize64: DataView) {
    const file = this.#openFiles.get(fileId);
    pSize64.setBigInt64(0, BigInt(file?.size ?? 0), true);
    return (VFS as any).SQLITE_OK;
  }

  xLock() {
    return (VFS as any).SQLITE_OK;
  }

  xUnlock() {
    return (VFS as any).SQLITE_OK;
  }

  xCheckReservedLock(_fileId: number, pResOut: DataView) {
    pResOut.setInt32(0, 0, true);
    return (VFS as any).SQLITE_OK;
  }

  xFileControl() {
    return (VFS as any).SQLITE_NOTFOUND;
  }

  xSectorSize() {
    return 4096;
  }

  xDeviceCharacteristics() {
    return (VFS as any).SQLITE_IOCAP_IMMUTABLE;
  }

  xAccess(name: string, _flags: number, pResOut: DataView) {
    const isAux = name?.endsWith('-wal') || name?.endsWith('-shm') || name?.endsWith('-journal');
    pResOut.setInt32(0, isAux ? 0 : 1, true);
    return (VFS as any).SQLITE_OK;
  }

  xDelete() {
    return (VFS as any).SQLITE_OK;
  }
}

let vfsInstance: FileSnapshotVFS | null = null;

async function queryObjects(sql: string, params: unknown[] = []): Promise<SqliteRowRecord[]> {
  const rows: SqliteRowRecord[] = [];

  for await (const stmt of sqlite3.statements(db, sql)) {
    if (params.length) sqlite3.bind_collection(stmt, params);

    let columns: string[] | null = null;
    while (await sqlite3.step(stmt) === (SQLite as any).SQLITE_ROW) {
      const activeColumns = (columns ?? (columns = sqlite3.column_names(stmt))) as string[];
      const raw = sqlite3.row(stmt) as unknown[];
      const obj: SqliteRowRecord = {};
      activeColumns.forEach((col: string, index: number) => {
        obj[col] = raw[index];
      });
      rows.push(obj);
    }
  }

  return rows;
}

async function initDb(file: File) {
  if (db !== null) return;

  if (!sqlite3) {
    const wasmBinary = await fetch(wasmUrl).then((response) => response.arrayBuffer());
    const module = await SQLiteAsyncFactory({ wasmBinary });
    sqlite3 = (SQLite as any).Factory(module);

    vfsInstance = new FileSnapshotVFS();
    await sqlite3.vfs_register(vfsInstance, true);
  }

  vfsInstance?.setFile(file);

  db = await sqlite3.open_v2(
    'file:snapshot.db?immutable=1',
    (SQLite as any).SQLITE_OPEN_READONLY | (SQLite as any).SQLITE_OPEN_URI,
  );
}

async function closeDb() {
  if (db === null) return;
  try {
    await sqlite3.close(db);
  } finally {
    db = null;
  }
}

async function handleGetRaids() {
  const { start, end } = getWeeklyResetPeriod();
  const placeholders = TRACKED_WEEKLY_BOSSES.map(() => '?').join(', ');
  const sql = `
    SELECT local_player, current_boss, difficulty, fight_start, cleared
    FROM encounter_preview
    WHERE cleared = 1
      AND current_boss IN (${placeholders})
      AND fight_start >= ?
      AND fight_start < ?
    ORDER BY fight_start DESC`;

  const params = [...TRACKED_WEEKLY_BOSSES, start, end];
  const rows = await queryObjects(sql, params);
  return rows.map((row) => ({
    local_player: row.local_player,
    current_boss: row.current_boss,
    difficulty: row.difficulty,
    fight_start: Number(row.fight_start),
    cleared: Boolean(row.cleared),
  }));
}

async function handleGetDailyGuardianRaids({ characterName }: HandlerPayloads['getDailyGuardianRaids']) {
  if (!characterName) return false;

  const { start, end } = getDailyResetPeriod();
  const placeholders = GUARDIAN_BOSSES.map(() => '?').join(', ');
  const sql = `
    SELECT current_boss, fight_start
    FROM encounter_preview
    WHERE local_player = ?
      AND current_boss IN (${placeholders})
      AND cleared = 1
      AND fight_start >= ?
      AND fight_start < ?
    ORDER BY fight_start DESC
    LIMIT 1`;

  const rows = await queryObjects(sql, [characterName, ...GUARDIAN_BOSSES, start, end]);
  if (!rows.length) return false;
  const row = rows[0];

  return {
    completed: true,
    boss: row.current_boss,
    timestamp: Number(row.fight_start),
  };
}

async function handleGetDailyFieldBoss({ rosterNames }: HandlerPayloads['getDailyFieldBoss']) {
  if (!Array.isArray(rosterNames) || !rosterNames.length) return false;

  const { start, end } = getDailyResetPeriod();
  const playerPh = rosterNames.map(() => '?').join(', ');
  const bossPh = FIELD_BOSS_NAMES.map(() => '?').join(', ');
  const sql = `
    SELECT current_boss, fight_start
    FROM encounter_preview
    WHERE current_boss IN (${bossPh})
      AND LOWER(local_player) IN (${playerPh})
      AND cleared IN (0, 1)
      AND fight_start >= ?
      AND fight_start < ?
    ORDER BY fight_start DESC
    LIMIT 1`;

  const lowered = rosterNames.map((name) => String(name || '').toLowerCase());
  const rows = await queryObjects(sql, [...FIELD_BOSS_NAMES, ...lowered, start, end]);
  if (!rows.length) return false;
  const row = rows[0];

  return {
    completed: true,
    boss: row.current_boss,
    timestamp: Number(row.fight_start),
  };
}

async function handleGetDailyChaosGate({ rosterNames }: HandlerPayloads['getDailyChaosGate']) {
  if (!Array.isArray(rosterNames) || !rosterNames.length) return false;

  const { start, end } = getDailyResetPeriod();
  const playerPh = rosterNames.map(() => '?').join(', ');
  const bossPh = CHAOS_GATE_NAMES.map(() => '?').join(', ');
  const sql = `
    SELECT current_boss, fight_start
    FROM encounter_preview
    WHERE current_boss IN (${bossPh})
      AND LOWER(local_player) IN (${playerPh})
      AND cleared IN (0, 1)
      AND fight_start >= ?
      AND fight_start < ?
    ORDER BY fight_start DESC
    LIMIT 1`;

  const lowered = rosterNames.map((name) => String(name || '').toLowerCase());
  const rows = await queryObjects(sql, [...CHAOS_GATE_NAMES, ...lowered, start, end]);
  if (!rows.length) return false;
  const row = rows[0];

  return {
    completed: true,
    boss: row.current_boss,
    timestamp: Number(row.fight_start),
  };
}


async function handleGetWeeklyThaemine({ rosterNames }: HandlerPayloads['getWeeklyThaemine']) {
  if (!Array.isArray(rosterNames) || !rosterNames.length) return false;

  const { start, end } = getWeeklyResetPeriod();
  const playerPh = rosterNames.map(() => '?').join(', ');
  const sql = `
    SELECT current_boss, fight_start
    FROM encounter_preview
    WHERE current_boss = ?
      AND LOWER(local_player) IN (${playerPh})
      AND cleared = 1
      AND fight_start >= ?
      AND fight_start < ?
    ORDER BY fight_start DESC
    LIMIT 1`;

  const lowered = rosterNames.map((name) => String(name || '').toLowerCase());
  const rows = await queryObjects(sql, [THAEMINE_BOSS_NAME, ...lowered, start, end]);
  if (!rows.length) return false;
  const row = rows[0];

  return {
    completed: true,
    boss: row.current_boss,
    timestamp: Number(row.fight_start),
  };
}

const HANDLERS: HandlerMap = {
  init: async ({ file }) => {
    if (!file) throw new Error('init requires a File object in payload.file');
    await initDb(file);
    return { ok: true };
  },
  close: async () => {
    await closeDb();
    return { ok: true };
  },
  getRaids: handleGetRaids,
  getDailyGuardianRaids: handleGetDailyGuardianRaids,
  getDailyFieldBoss: handleGetDailyFieldBoss,
  getDailyChaosGate: handleGetDailyChaosGate,
  getWeeklyThaemine: handleGetWeeklyThaemine,
};

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  const { type, id, payload = {} } = data;

  try {
    const handler = HANDLERS[type as keyof HandlerMap];
    if (!handler) throw new Error(`Unknown message type: ${type}`);

    const result = await handler(payload as any);
    self.postMessage({ id, result });
  } catch (err: any) {
    self.postMessage({ id, error: err?.message || String(err) });
  }
};
