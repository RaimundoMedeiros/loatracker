import { writable } from 'svelte/store';

export const rosterChangeVersion = writable(0);
export const visibleRostersChangeVersion = writable(0);

export function notifyRosterChanged() {
  rosterChangeVersion.update((value) => value + 1);
}

export function notifyVisibleRostersChanged() {
  visibleRostersChangeVersion.update((value) => value + 1);
}