import type { RosterMeta, SettingsPayload } from '../../types/app-api';
import { WEEKLY_VIEW_ALL } from '../stores/rosterSync';

/** Roster ids ordered by creation time (oldest first = "main" roster first). */
export function sortRosterIds(rosters: RosterMeta[]): string[] {
  return [...rosters]
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
    .map((roster) => String(roster.id || '').trim())
    .filter(Boolean);
}

/**
 * Global set of rosters shown in Weekly/Paradise. An empty/unset
 * `visibleWeeklyRosters` means "show every roster" (never configured).
 * Always returns at least one roster when any exist.
 */
export function getGlobalVisibleRosterIds(
  settings: SettingsPayload | null | undefined,
  sortedRosterIds: string[],
): string[] {
  const configured = Array.isArray(settings?.visibleWeeklyRosters)
    ? settings!.visibleWeeklyRosters.map((id) => String(id))
    : [];

  if (configured.length === 0) {
    return [...sortedRosterIds];
  }

  const filtered = sortedRosterIds.filter((id) => configured.includes(id));
  return filtered.length > 0 ? filtered : sortedRosterIds.slice(0, 1);
}

/**
 * Resolves which rosters Weekly/Paradise should display for a given selector
 * value. WEEKLY_VIEW_ALL yields every visible roster; a specific (valid)
 * roster id yields just that roster.
 */
export function getDisplayRosterIds(
  selection: string,
  visibleRosterIds: string[],
  sortedRosterIds: string[],
): string[] {
  if (selection !== WEEKLY_VIEW_ALL && sortedRosterIds.includes(selection)) {
    return [selection];
  }
  return [...visibleRosterIds];
}
