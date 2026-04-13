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
  getCharactersFromDatabase: Record<string, never>;
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
  'Serka',
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
const CHARACTER_IMPORT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const CLASS_ALIASES: Record<string, string> = {
  arcana: 'Arcanist',
  'arcana (arcanist)': 'Arcanist',
  scouter: 'Machinist',
  'lancaira': 'Glaivier',
  'lance master': 'Glaivier',
  lancemaster: 'Glaivier',
  'battle master': 'Wardancer',
  battlemaster: 'Wardancer',
  infighter: 'Scrapper',
  'soul master': 'Soulfist',
  'holy knight': 'Paladin',
  warlord: 'Gunlancer',
  'devil hunter': 'Deadeye',
  hawkeye: 'Sharpshooter',
  bard: 'Bard',
  summoner: 'Summoner',
  witch: 'Sorceress',
  artillerist: 'Artillerist',
  striker: 'Striker',
  wardancer: 'Wardancer',
  scrapper: 'Scrapper',
  soulfist: 'Soulfist',
  glaivier: 'Glaivier',
  machinist: 'Machinist',
  gunslinger: 'Gunslinger',
  artist: 'Artist',
  aeromancer: 'Aeromancer',
  wildsoul: 'Wildsoul',
  breaker: 'Breaker',
  souleater: 'Souleater',
  reaper: 'Reaper',
  shadowhunter: 'Shadowhunter',
  deathblade: 'Deathblade',
  berserker: 'Berserker',
  destroyer: 'Destroyer',
  gunlancer: 'Gunlancer',
  paladin: 'Paladin',
  slayer: 'Slayer',
  valkyrie: 'Valkyrie',
  'guardian knight': 'Guardian Knight',
  guardianknight: 'Guardian Knight',
};

const CLASS_CANONICAL = new Set(Object.values(CLASS_ALIASES));

function normalizeClass(rawClass: unknown): string | null {
  const key = String(rawClass || '').toLowerCase().trim();
  const mapped = CLASS_ALIASES[key];
  if (mapped && CLASS_CANONICAL.has(mapped)) return mapped;

  for (const canonical of CLASS_CANONICAL) {
    if (canonical.toLowerCase() === key) return canonical;
  }

  return null;
}

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

async function handleGetCharactersFromDatabase() {
  self.postMessage({ type: 'progress', message: 'Scanning encounters from the last 30 days…' });

  const maxFightRows = await queryObjects(
    `SELECT MAX(fight_start) AS max_fight_start
     FROM encounter_preview
     WHERE fight_start IS NOT NULL`
  );
  const latestFightStart = Number(maxFightRows[0]?.max_fight_start ?? 0);

  if (!Number.isFinite(latestFightStart) || latestFightStart <= 0) {
    self.postMessage({ type: 'progress', message: 'No encounter history found in database.' });
    return [];
  }

  const windowStart = latestFightStart - CHARACTER_IMPORT_WINDOW_MS;

  const countRows = await queryObjects(
    `SELECT COUNT(DISTINCT local_player) AS cnt
     FROM encounter_preview
     WHERE local_player IS NOT NULL
       AND local_player != ''
       AND fight_start >= ?
       AND fight_start <= ?`,
    [windowStart, latestFightStart],
  );
  const playerCount = Number(countRows[0]?.cnt ?? 0);

  self.postMessage({
    type: 'progress',
    message: `Found ${playerCount} players, loading character details…`,
  });

  const sql = `
    WITH recent_players AS (
      SELECT DISTINCT local_player
      FROM encounter_preview
      WHERE local_player IS NOT NULL
        AND local_player != ''
        AND fight_start >= ?
        AND fight_start <= ?
    ),
    best_entity AS (
      SELECT
        e.name, e.class, e.gear_score, e.combat_power,
        ROW_NUMBER() OVER (PARTITION BY e.name ORDER BY e.combat_power DESC) AS rn
      FROM entity e
      INNER JOIN recent_players rp ON e.name = rp.local_player
      WHERE e.class IS NOT NULL
        AND e.gear_score IS NOT NULL
        AND e.combat_power IS NOT NULL
    )
    SELECT name, class, gear_score, combat_power
    FROM best_entity
    WHERE rn = 1
    ORDER BY combat_power DESC`;

  const rows = await queryObjects(sql, [windowStart, latestFightStart]);
  const characters: Array<{ name: unknown; class: string; ilvl: number; combatPower: number }> = [];

  for (const row of rows) {
    const normalizedClass = normalizeClass(row.class);
    if (!normalizedClass) continue;

    characters.push({
      name: row.name,
      class: normalizedClass,
      ilvl: Number(row.gear_score) || 0,
      combatPower: Number(row.combat_power) || 0,
    });

    if (characters.length % 25 === 0) {
      self.postMessage({ type: 'progress', message: `Loading characters: ${characters.length}…` });
    }
  }

  self.postMessage({ type: 'progress', message: `Loaded ${characters.length} characters` });
  return characters;
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
  getCharactersFromDatabase: handleGetCharactersFromDatabase,
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
