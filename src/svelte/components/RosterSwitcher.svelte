<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { withAsyncError } from '../utils/errorWrappers';
  import { ERROR_CODES } from '../utils/errorCodes';
  import type { RosterMeta, SettingsPayload } from '../../types/app-api';
  import {
    WEEKLY_VIEW_ALL,
    notifyRosterChanged,
    rosterChangeVersion,
    visibleRostersChangeVersion,
    weeklyViewSelection,
  } from '../stores/rosterSync';
  import { RosterService } from '../services/RosterService';
  import { getGlobalVisibleRosterIds, sortRosterIds } from '../utils/rosterVisibility';

  let rosters: RosterMeta[] = [];
  let activeRosterId = '';
  let settings: SettingsPayload | null = null;
  let selection = WEEKLY_VIEW_ALL;
  let unsubscribeRosterChanges: (() => void) | null = null;
  let unsubscribeVisibleChanges: (() => void) | null = null;
  let unsubscribeSelection: (() => void) | null = null;

  $: sortedRosters = [...rosters].sort(
    (left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0),
  );
  $: visibleRosterIds = getGlobalVisibleRosterIds(settings, sortRosterIds(rosters));
  $: showAllOption = visibleRosterIds.length > 1;

  onMount(async () => {
    await window.__API_READY__;
    await refresh();

    let isInitialRosterSync = true;
    unsubscribeRosterChanges = rosterChangeVersion.subscribe(() => {
      if (isInitialRosterSync) {
        isInitialRosterSync = false;
        return;
      }
      void refresh();
    });

    let isInitialVisibleSync = true;
    unsubscribeVisibleChanges = visibleRostersChangeVersion.subscribe(() => {
      if (isInitialVisibleSync) {
        isInitialVisibleSync = false;
        return;
      }
      void refresh();
    });

    unsubscribeSelection = weeklyViewSelection.subscribe((value) => {
      selection = value;
    });
  });

  onDestroy(() => {
    unsubscribeRosterChanges?.();
    unsubscribeRosterChanges = null;
    unsubscribeVisibleChanges?.();
    unsubscribeVisibleChanges = null;
    unsubscribeSelection?.();
    unsubscribeSelection = null;
  });

  async function refresh() {
    await withAsyncError(async () => {
      const snapshot = await RosterService.loadRosterSwitcherState();
      rosters = snapshot.rosters;
      activeRosterId = snapshot.activeRosterId;
      settings = snapshot.settings;
      reconcileSelection();
      return true;
    }, {
      code: ERROR_CODES.ROSTER_SWITCHER.REFRESH_FAILED,
      severity: 'error',
      context: {
        phase: 'refresh',
        action: 'refresh-roster-switcher',
        rosterId: activeRosterId,
        activeRosterId,
        rosterCount: rosters.length,
      },
      showToast: true,
    });
  }

  // Force the stored selection back to a valid value when the roster list or
  // global visibility changes (e.g. the selected roster was deleted/hidden).
  function reconcileSelection() {
    const ids = sortRosterIds(rosters);
    const visible = getGlobalVisibleRosterIds(settings, ids);
    const allOption = visible.length > 1;
    const current = get(weeklyViewSelection);
    const valid = (current === WEEKLY_VIEW_ALL && allOption) || ids.includes(current);
    const next = valid
      ? current
      : (allOption ? WEEKLY_VIEW_ALL : (ids[0] || WEEKLY_VIEW_ALL));
    if (next !== current) {
      weeklyViewSelection.set(next);
    }
    selection = next;
  }

  async function applySelection(value: string) {
    weeklyViewSelection.set(value);
    selection = value;

    const ids = sortRosterIds(rosters);
    const visible = getGlobalVisibleRosterIds(settings, ids);
    const targetActive = value === WEEKLY_VIEW_ALL ? (visible[0] || '') : value;

    if (targetActive) {
      const persistedActive = await RosterService.getActiveRosterId();
      if (targetActive !== persistedActive) {
        await RosterService.switchActiveRoster(targetActive);
        activeRosterId = targetActive;
        // Only the active roster actually changed here; the view reload is
        // already driven by the weeklyViewSelection store, so this notifies
        // the *other* roster-aware views (Settings, etc.).
        notifyRosterChanged();
      }
    }
  }

  async function onSelectChange(event: Event) {
    const target = event.currentTarget as HTMLSelectElement;
    const value = String(target.value || '').trim();
    if (!value) return;
    await applySelection(value);
  }
</script>

{#if sortedRosters.length > 1}
  <div id="roster-switcher-container">
    <div class="roster-switcher">
      <select
        id="roster-select"
        class="roster-select"
        aria-label="Select rosters shown in Weekly and Paradise"
        bind:value={selection}
        on:change={onSelectChange}
      >
        {#if showAllOption}
          <option value={WEEKLY_VIEW_ALL}>All Visible Rosters</option>
        {/if}
        {#each sortedRosters as roster (roster.id)}
          <option value={roster.id}>{roster.name}</option>
        {/each}
      </select>
    </div>
  </div>
{/if}
