import { writable } from 'svelte/store';

export const rosterChangeVersion = writable(0);
export const visibleRostersChangeVersion = writable(0);

/**
 * Selector value for the Weekly/Paradise roster view. Either WEEKLY_VIEW_ALL
 * (show every visible roster) or a specific roster id (show only that one).
 * Owned/reconciled by RosterSwitcher; consumed by WeeklyPage and ParadisePage.
 */
export const WEEKLY_VIEW_ALL = '__all_visible_rosters__';
export const weeklyViewSelection = writable<string>(WEEKLY_VIEW_ALL);

/**
 * One-shot request to auto-open the Manage dialog on the Rosters settings
 * screen for a specific roster id. Set by flows that navigate to
 * `#settings/rosters` and want the Manage view shown immediately (e.g. after
 * adding a character manually from Tracker Integration). The consumer is
 * responsible for clearing the value after handling it.
 */
export const pendingManageRosterId = writable<string | null>(null);

export function notifyRosterChanged() {
  rosterChangeVersion.update((value) => value + 1);
}

export function notifyVisibleRostersChanged() {
  visibleRostersChangeVersion.update((value) => value + 1);
}

export function requestManageRoster(rosterId: string) {
  pendingManageRosterId.set(rosterId || null);
}

export function consumePendingManageRoster(): string | null {
  let value: string | null = null;
  pendingManageRosterId.update((current) => {
    value = current;
    return null;
  });
  return value;
}