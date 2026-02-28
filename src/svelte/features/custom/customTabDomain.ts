export type ColumnType = 'checkbox' | 'text' | 'textarea' | 'counter';
export type ColumnScope = 'per-character' | 'global';

export type CustomColumn = {
  id: string;
  title: string;
  type: ColumnType;
  scope: ColumnScope;
  color?: string; // user-chosen hex color, overrides type default
};

export type CustomColumnsState = {
  columns: CustomColumn[];
  columnOrder: string[];
};

export type CustomTabValues = {
  /** characterName -> columnId -> value */
  perCharacter: Record<string, Record<string, unknown>>;
  /** columnId -> value (global-scope columns) */
  global: Record<string, unknown>;
};

const columnsKey = (rosterId: string) => `wtl:custom-tab:${rosterId}:columns`;
const LEGACY_COLUMNS_KEY = 'wtl:custom-tab:columns';
const CLIPBOARD_KEY = 'wtl:custom-tab:layout-clipboard';
const valuesKey = (rosterId: string) => `wtl:custom-tab:${rosterId}`;

const inMemoryColumns: Map<string, unknown> = new Map();
const inMemoryValues: Map<string, unknown> = new Map();

function readJSON<T>(key: string, fallback: T, cache: Map<string, unknown>): T {
  if (cache.has(key)) return cache.get(key) as T;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    cache.set(key, parsed);
    return parsed;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown, cache: Map<string, unknown>): void {
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable – in-memory fallback keeps working
  }
}

export function generateColumnId(): string {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `col-${Math.random().toString(36).slice(2, 10)}`;
}

function parseColumnsState(saved: Partial<CustomColumnsState>): CustomColumnsState {
  const columns = Array.isArray(saved.columns) ? (saved.columns as CustomColumn[]) : [];
  const columnOrder = Array.isArray(saved.columnOrder) ? (saved.columnOrder as string[]) : [];
  const ids = new Set(columnOrder);
  for (const col of columns) {
    if (!ids.has(col.id)) columnOrder.push(col.id);
  }
  return { columns, columnOrder };
}

export function loadColumns(rosterId: string): CustomColumnsState {
  const key = columnsKey(rosterId);
  const saved = readJSON<Partial<CustomColumnsState> | null>(key, null, inMemoryColumns);
  if (saved) return parseColumnsState(saved);

  // Migrate from legacy global key (one-time migration)
  const legacy = readJSON<Partial<CustomColumnsState> | null>(LEGACY_COLUMNS_KEY, null, inMemoryColumns);
  if (legacy && Array.isArray(legacy.columns) && legacy.columns.length > 0) {
    const migrated = parseColumnsState(legacy);
    writeJSON(key, migrated, inMemoryColumns);
    return migrated;
  }

  return { columns: [], columnOrder: [] };
}

export function saveColumns(rosterId: string, state: CustomColumnsState): void {
  writeJSON(columnsKey(rosterId), state, inMemoryColumns);
}

export function copyLayoutToClipboard(state: CustomColumnsState): void {
  writeJSON(CLIPBOARD_KEY, state, inMemoryColumns);
}

export function loadLayoutClipboard(): CustomColumnsState | null {
  const saved = readJSON<Partial<CustomColumnsState> | null>(CLIPBOARD_KEY, null, inMemoryColumns);
  if (!saved || !Array.isArray(saved.columns) || saved.columns.length === 0) return null;
  return parseColumnsState(saved);
}

export function loadValues(rosterId: string): CustomTabValues {
  const key = valuesKey(rosterId);
  const saved = readJSON<Partial<CustomTabValues> | null>(key, null, inMemoryValues);
  return {
    perCharacter: (saved?.perCharacter && typeof saved.perCharacter === 'object') ? saved.perCharacter as Record<string, Record<string, unknown>> : {},
    global: (saved?.global && typeof saved.global === 'object') ? saved.global as Record<string, unknown> : {},
  };
}

export function saveValues(rosterId: string, values: CustomTabValues): void {
  writeJSON(valuesKey(rosterId), values, inMemoryValues);
}

/** Returns columns sorted by their order array. */
export function orderedColumns(state: CustomColumnsState): CustomColumn[] {
  const byId = new Map(state.columns.map((col) => [col.id, col]));
  const ordered = state.columnOrder.map((id) => byId.get(id)).filter((col): col is CustomColumn => Boolean(col));
  // Append any columns not yet in order
  for (const col of state.columns) {
    if (!ordered.includes(col)) ordered.push(col);
  }
  return ordered;
}

export function reorderColumns(columnOrder: string[], draggedId: string, targetId: string): string[] {
  const next = [...columnOrder];
  const from = next.indexOf(draggedId);
  const to = next.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return next;
  next.splice(from, 1);
  next.splice(to, 0, draggedId);
  return next;
}

export function getCellValue(values: CustomTabValues, column: CustomColumn, characterName: string): unknown {
  if (column.scope === 'global') return values.global[column.id] ?? defaultValue(column.type);
  return values.perCharacter[characterName]?.[column.id] ?? defaultValue(column.type);
}

export function setCellValue(
  values: CustomTabValues,
  column: CustomColumn,
  characterName: string,
  value: unknown,
): CustomTabValues {
  if (column.scope === 'global') {
    return { ...values, global: { ...values.global, [column.id]: value } };
  }
  return {
    ...values,
    perCharacter: {
      ...values.perCharacter,
      [characterName]: { ...(values.perCharacter[characterName] ?? {}), [column.id]: value },
    },
  };
}

function defaultValue(type: ColumnType): unknown {
  if (type === 'checkbox') return false;
  if (type === 'counter') return 0;
  return '';
}
