<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { AppApi } from '../../../types/app-api';
  import { rosterChangeVersion } from '../../stores/rosterSync';
  import { orderedEntries, loadRosterState } from '../roster/rosterDomain';
  import {
    loadColumns,
    saveColumns,
    loadValues,
    saveValues,
    orderedColumns,
    reorderColumns,
    getCellValue,
    setCellValue,
    copyLayoutToClipboard,
    loadLayoutClipboard,
    type CustomColumnsState,
    type CustomTabValues,
    type CustomColumn,
    type ColumnType,
  } from './customTabDomain';
  import CustomColumnModal from './CustomColumnModal.svelte';

  const api: AppApi = window.api;

  let activeRosterId = '';
  let characterNames: string[] = [];
  let columnsState: CustomColumnsState = { columns: [], columnOrder: [] };
  let values: CustomTabValues = { perCharacter: {}, global: {} };
  let loading = false;
  let configureOpen = false;
  let draggingColId: string | null = null;
  let clipboardColumns: CustomColumnsState | null = null;
  let unsubscribeRosterChanges: (() => void) | null = null;

  $: sorted = orderedColumns(columnsState);
  $: perCharacterCols = sorted.filter((col) => col.scope === 'per-character');
  $: globalCols = sorted.filter((col) => col.scope === 'global');
  $: hasGlobalCols = globalCols.length > 0;
  $: hasColumns = sorted.length > 0;

  onMount(async () => {
    await window.__API_READY__;
    clipboardColumns = loadLayoutClipboard();
    await loadRosterCharacters();

    let isInitialSync = true;
    unsubscribeRosterChanges = rosterChangeVersion.subscribe(() => {
      if (isInitialSync) { isInitialSync = false; return; }
      void loadRosterCharacters(true); // force empty seed so api.getActiveRoster() resolves the new active roster
    });
  });

  onDestroy(() => {
    unsubscribeRosterChanges?.();
    unsubscribeRosterChanges = null;
  });

  async function loadRosterCharacters(forceResolve = false) {
    loading = true;
    try {
      const seed = forceResolve ? '' : activeRosterId;
      const state = await loadRosterState(api, seed);
      activeRosterId = state.activeRosterId;
      const entries = orderedEntries(state.roster, state.order);
      characterNames = entries
        .filter((entry) => entry.data.visible !== false)
        .map((entry) => entry.name);
      columnsState = loadColumns(activeRosterId);
      values = loadValues(activeRosterId);
    } finally {
      loading = false;
    }
  }

  function getCell(col: CustomColumn, characterName: string): unknown {
    return getCellValue(values, col, characterName);
  }

  function setCell(col: CustomColumn, characterName: string, value: unknown) {
    values = setCellValue(values, col, characterName, value);
    saveValues(activeRosterId, values);
  }

  function onCheckboxChange(col: CustomColumn, characterName: string, event: Event) {
    setCell(col, characterName, (event.target as HTMLInputElement).checked);
  }

  function onTextInput(col: CustomColumn, characterName: string, event: Event) {
    setCell(col, characterName, (event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  function incrementCounter(col: CustomColumn, characterName: string) {
    setCell(col, characterName, (Number(getCell(col, characterName)) || 0) + 1);
  }

  function decrementCounter(col: CustomColumn, characterName: string) {
    setCell(col, characterName, Math.max(0, (Number(getCell(col, characterName)) || 0) - 1));
  }

  function onCounterInput(col: CustomColumn, characterName: string, event: Event) {
    const num = parseInt((event.target as HTMLInputElement).value, 10);
    setCell(col, characterName, Number.isFinite(num) ? Math.max(0, num) : 0);
  }

  function onColumnsUpdate(event: CustomEvent<CustomColumnsState>) {
    columnsState = event.detail;
    saveColumns(activeRosterId, columnsState);
  }

  function onHeaderDragStart(e: DragEvent, id: string) {
    draggingColId = id;
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function onHeaderDragEnd() { draggingColId = null; }
  function onHeaderDragOver(e: DragEvent) { e.preventDefault(); }

  function onHeaderDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    const draggedId = draggingColId || e.dataTransfer?.getData('text/plain') || '';
    if (!draggedId || draggedId === targetId) return;
    columnsState = { ...columnsState, columnOrder: reorderColumns(columnsState.columnOrder, draggedId, targetId) };
    saveColumns(activeRosterId, columnsState);
    draggingColId = null;
  }

  function copyLayout() {
    copyLayoutToClipboard(columnsState);
    clipboardColumns = { columns: [...columnsState.columns], columnOrder: [...columnsState.columnOrder] };
  }

  function pasteLayout() {
    if (!clipboardColumns) return;
    columnsState = { columns: [...clipboardColumns.columns], columnOrder: [...clipboardColumns.columnOrder] };
    saveColumns(activeRosterId, columnsState);
  }

  const TYPE_COLORS: Record<ColumnType, string> = {
    checkbox: '#4CAF50',
    text:     '#2196F3',
    textarea: '#ff9800',
    counter:  '#9c27b0',
  };

  const TYPE_ICONS: Record<ColumnType, string> = {
    checkbox: '✓',
    text:     'T',
    textarea: '≡',
    counter:  '#',
  };
</script>

<section class="tab-content active ct-page" id="custom-tab">

  <!-- Page header -->
  <div class="ct-header">
    <div class="ct-heading">
      <h1 class="ct-title">Custom Tab</h1>
      <p class="ct-subtitle">Your personal workflow — define columns, track what matters to you.</p>
    </div>
    <div class="ct-toolbar">
      {#if hasColumns}
        <button
          type="button"
          class="ct-tool-btn"
          title="Copy this roster's column layout to clipboard"
          on:click={copyLayout}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="9" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="2" y="2" width="9" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5"/></svg>
          Copy
        </button>
      {/if}
      {#if clipboardColumns && clipboardColumns.columns.length > 0}
        <button
          type="button"
          class="ct-tool-btn ct-tool-btn--paste"
          title="Paste copied layout ({clipboardColumns.columns.length} columns) to this roster"
          on:click={pasteLayout}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M6 1.5a.5.5 0 01.5-.5h3a.5.5 0 010 1H9v1h2.5A1.5 1.5 0 0113 4.5v9A1.5 1.5 0 0111.5 15h-7A1.5 1.5 0 013 13.5v-9A1.5 1.5 0 014.5 3H7V2H6.5A.5.5 0 016 1.5zM4.5 4A.5.5 0 004 4.5v9a.5.5 0 00.5.5h7a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5H9v.5a.5.5 0 01-.5.5h-1A.5.5 0 017 4.5V4H4.5z"/></svg>
          Paste
          <span class="ct-paste-count">{clipboardColumns.columns.length}</span>
        </button>
      {/if}
      <button
        type="button"
        class="sort-roster-btn ct-configure-btn"
        aria-label="Configure columns"
        on:click={() => (configureOpen = true)}
      >
        <span aria-hidden="true">⚙</span>
        Configure
        {#if hasColumns}
          <span class="ct-col-count">{sorted.length}</span>
        {/if}
      </button>
    </div>
  </div>

  <!-- Loading -->
  {#if loading}
    <div class="ct-status-row">
      <span class="ct-loading-spinner" aria-hidden="true"></span>
      <span>Loading roster…</span>
    </div>

  <!-- Empty columns state -->
  {:else if !hasColumns}
    <div class="ct-empty-state">
      <div class="ct-empty-icon" aria-hidden="true"><img src="/assets/icons/items/mokokoreading.webp" alt="" class="ct-empty-mokoko" /></div>
      <h2 class="ct-empty-title">No columns yet</h2>
      <p class="ct-empty-desc">
        Add columns to start tracking your own data per character.<br />
        Supports checkboxes, text fields, notes, and numeric counters.
      </p>
      <button
        type="button"
        class="sort-roster-btn ct-empty-cta"
        on:click={() => (configureOpen = true)}
      >
        <span aria-hidden="true">⚙</span> Configure Columns
      </button>
    </div>

  <!-- No visible characters -->
  {:else if characterNames.length === 0}
    <div class="ct-empty-state">
      <div class="ct-empty-icon" aria-hidden="true"><img src="/assets/icons/items/mokokoreading.webp" alt="" class="ct-empty-mokoko" /></div>
      <h2 class="ct-empty-title">No visible characters</h2>
      <p class="ct-empty-desc">Add characters in <strong>Roster Management</strong> and make sure they are set to visible.</p>
    </div>

  <!-- Main table -->
  {:else}
    <div class="ct-table-wrapper">
      <table class="ct-table" aria-label="Custom tracker table">
        <thead>
          <tr>
            <th class="ct-th ct-th--char" scope="col">Character</th>
            {#each perCharacterCols as col (col.id)}
              <th
                class="ct-th"
                class:ct-th--dragging={draggingColId === col.id}
                scope="col"
                title="{col.title} ({col.type}) — drag to reorder"
                draggable="true"
                on:dragstart={(e) => onHeaderDragStart(e, col.id)}
                on:dragend={onHeaderDragEnd}
                on:dragover={onHeaderDragOver}
                on:drop={(e) => onHeaderDrop(e, col.id)}
              >
                <div class="ct-th-inner">
                  <span
                    class="ct-type-dot"
                    style="background: {col.color ?? TYPE_COLORS[col.type]};"
                    title={col.type}
                    aria-hidden="true"
                  >{TYPE_ICONS[col.type]}</span>
                  <span class="ct-th-label">{col.title}</span>
                </div>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each characterNames as name (name)}
            <tr class="ct-row">
              <td class="ct-td ct-td--char">{name}</td>
              {#each perCharacterCols as col (col.id)}
                <td class="ct-td ct-td--cell" class:ct-td--checkbox={col.type === 'checkbox'} data-label={col.title}>
                  {#if col.type === 'checkbox'}
                    <input
                      type="checkbox"
                      class="ct-checkbox"
                      checked={Boolean(getCellValue(values, col, name))}
                      aria-label="{col.title} for {name}"
                      on:change={(e) => onCheckboxChange(col, name, e)}
                    />
                  {:else if col.type === 'textarea'}
                    <textarea
                      class="ct-textarea"
                      value={String(getCellValue(values, col, name) ?? '')}
                      aria-label="{col.title} for {name}"
                      rows="2"
                      on:input={(e) => onTextInput(col, name, e)}
                    ></textarea>
                  {:else if col.type === 'counter'}
                    <div class="ct-counter" role="group" aria-label="{col.title} for {name}">
                      <button type="button" class="ct-counter-btn" aria-label="Decrease" on:click={() => decrementCounter(col, name)}>−</button>
                      <input
                        type="number"
                        class="ct-counter-input"
                        min="0"
                        value={Number(getCellValue(values, col, name)) || 0}
                        aria-label="{col.title} value for {name}"
                        on:input={(e) => onCounterInput(col, name, e)}
                      />
                      <button type="button" class="ct-counter-btn" aria-label="Increase" on:click={() => incrementCounter(col, name)}>+</button>
                    </div>
                  {:else}
                    <input
                      type="text"
                      class="ct-text-input"
                      value={String(getCellValue(values, col, name) ?? '')}
                      aria-label="{col.title} for {name}"
                      on:input={(e) => onTextInput(col, name, e)}
                    />
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Global columns section -->
    {#if hasGlobalCols}
      <div class="ct-global-section">
        <div class="ct-global-header">
          <span class="ct-global-icon" aria-hidden="true">🌐</span>
          <span class="ct-global-title">Roster-Wide</span>
          <span class="ct-global-hint">These columns apply to the whole roster, not per character</span>
        </div>
        <div class="ct-global-grid">
          {#each globalCols as col (col.id)}
            <div class="ct-global-card">
              <div class="ct-global-card-header">
                <span
                  class="ct-type-dot"
                  style="background: {col.color ?? TYPE_COLORS[col.type]};"
                  aria-hidden="true"
                >{TYPE_ICONS[col.type]}</span>
                <span class="ct-global-card-title">{col.title}</span>
              </div>
              <div class="ct-global-card-body">
                {#if col.type === 'checkbox'}
                  <input
                    type="checkbox"
                    class="ct-checkbox"
                    checked={Boolean(getCellValue(values, col, ''))}
                    aria-label="{col.title} (global)"
                    on:change={(e) => onCheckboxChange(col, '', e)}
                  />
                {:else if col.type === 'textarea'}
                  <textarea
                    class="ct-textarea ct-textarea--global"
                    value={String(getCellValue(values, col, '') ?? '')}
                    aria-label="{col.title} (global)"
                    rows="3"
                    on:input={(e) => onTextInput(col, '', e)}
                  ></textarea>
                {:else if col.type === 'counter'}
                  <div class="ct-counter" role="group" aria-label="{col.title} (global)">
                    <button type="button" class="ct-counter-btn" aria-label="Decrease" on:click={() => decrementCounter(col, '')}>−</button>
                    <input
                      type="number"
                      class="ct-counter-input"
                      min="0"
                      value={Number(getCellValue(values, col, '')) || 0}
                      on:input={(e) => onCounterInput(col, '', e)}
                    />
                    <button type="button" class="ct-counter-btn" aria-label="Increase" on:click={() => incrementCounter(col, '')}>+</button>
                  </div>
                {:else}
                  <input
                    type="text"
                    class="ct-text-input ct-text-input--global"
                    value={String(getCellValue(values, col, '') ?? '')}
                    aria-label="{col.title} (global)"
                    on:input={(e) => onTextInput(col, '', e)}
                  />
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</section>

{#if configureOpen}
  <CustomColumnModal
    state={columnsState}
    on:close={() => (configureOpen = false)}
    on:update={onColumnsUpdate}
  />
{/if}

<style>
  /* ── Page shell ── */
  .ct-page {
    padding: var(--spacing-xl);
    overflow-y: auto;
    min-height: 200px;
  }

  /* ── Header ── */
  .ct-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
    flex-wrap: wrap;
  }

  .ct-title {
    margin: 0 0 4px;
    font-size: var(--font-xl);
    font-weight: 700;
    color: var(--color-primary);
    text-align: left;
    letter-spacing: 0.01em;
  }

  .ct-subtitle {
    margin: 0;
    font-size: var(--font-sm);
    color: var(--color-text-secondary);
  }

  .ct-toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-shrink: 0;
  }

  .ct-configure-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-sm);
    font-weight: 600;
  }

  /* Secondary tool buttons (Copy / Paste) */
  .ct-tool-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    background: var(--color-surface);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-xs);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
    line-height: 1;
  }

  .ct-tool-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
    border-color: var(--color-border-light);
  }

  .ct-tool-btn--paste {
    color: var(--color-primary);
    border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
  }

  .ct-tool-btn--paste:hover {
    background: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border));
    color: var(--color-primary);
  }

  .ct-paste-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: color-mix(in srgb, var(--color-primary) 22%, transparent);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
  }

  .ct-col-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: color-mix(in srgb, var(--color-primary) 28%, var(--color-surface-hover));
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: var(--font-xs);
    font-weight: 700;
    line-height: 1;
    border: 1px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
  }

  /* ── Loading ── */
  .ct-status-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 0;
    color: var(--color-text-secondary);
    font-size: var(--font-sm);
  }

  .ct-loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: var(--radius-full);
    animation: ct-spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  @keyframes ct-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Empty states ── */
  .ct-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 56px 24px;
    gap: 12px;
  }

  .ct-empty-icon {
    line-height: 1;
    margin-bottom: 4px;
  }

  .ct-empty-mokoko {
    width: 96px;
    height: 96px;
    object-fit: contain;
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
    opacity: 0.88;
  }

  .ct-empty-title {
    margin: 0;
    font-size: var(--font-xl);
    font-weight: 700;
    color: var(--color-text);
  }

  .ct-empty-desc {
    margin: 0;
    font-size: var(--font-md);
    color: var(--color-text-secondary);
    line-height: 1.55;
    max-width: 400px;
  }

  .ct-empty-desc strong {
    color: var(--color-primary);
    font-weight: 600;
  }

  .ct-empty-cta {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px !important;
    font-size: var(--font-md) !important;
  }

  /* ── Table ── */
  .ct-table-wrapper {
    overflow-x: auto;
    border-radius: var(--radius-md);
    border: 1px solid color-mix(in srgb, var(--color-border-light) 56%, var(--color-border));
    box-shadow: var(--shadow-sm);
  }

  .ct-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-sm);
    color: var(--color-text);
    background: var(--color-surface);
  }

  /* Header row */
  .ct-th {
    padding: 10px 12px;
    background: linear-gradient(135deg, var(--color-surface-hover), color-mix(in srgb, var(--color-border) 60%, var(--color-surface-hover)));
    border-bottom: 2px solid color-mix(in srgb, var(--color-primary) 38%, var(--color-border));
    border-right: 1px solid var(--color-border);
    text-align: center;
    font-size: var(--font-xs);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .ct-th:last-child {
    border-right: none;
  }

  .ct-th--char {
    min-width: 120px;
    color: var(--color-primary);
    position: sticky;
    left: 0;
    z-index: 3;
    background: linear-gradient(135deg, var(--color-surface-hover), color-mix(in srgb, var(--color-border) 60%, var(--color-surface-hover)));
  }

  .ct-th[draggable] > * {
    pointer-events: none;
  }

  .ct-th[draggable] {
    cursor: grab;
  }

  .ct-th[draggable]:active {
    cursor: grabbing;
  }

  .ct-th--dragging {
    opacity: 0.35;
  }

  .ct-th-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }

  .ct-type-dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 800;
    color: var(--color-bg-dark);
    flex-shrink: 0;
    line-height: 1;
    opacity: 0.9;
  }

  .ct-th-label {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 130px;
  }

  /* Body rows */
  .ct-row {
    border-bottom: 1px solid var(--color-border);
    transition: background var(--transition-fast);
  }

  .ct-row:last-child {
    border-bottom: none;
  }

  .ct-row:hover {
    background: color-mix(in srgb, var(--color-surface-hover) 50%, transparent);
  }

  .ct-td {
    padding: 8px 12px;
    border-right: 1px solid var(--color-border);
    vertical-align: middle;
  }

  .ct-td:last-child {
    border-right: none;
  }

  .ct-td--char {
    font-weight: 600;
    color: var(--color-primary);
    white-space: nowrap;
    font-size: var(--font-sm);
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--color-surface);
  }

  .ct-row:hover .ct-td--char {
    background: color-mix(in srgb, var(--color-surface-hover) 50%, var(--color-surface));
  }

  .ct-td--cell {
    min-width: 90px;
    text-align: center;
  }

  .ct-td--checkbox {
    text-align: center;
    min-width: 56px;
    max-width: 72px;
  }

  /* Inputs */
  .ct-checkbox {
    appearance: none;
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background-color: #3B3B3B;
    border: 1.5px solid #858585;
    border-radius: 3px;
    cursor: pointer;
    position: relative;
    transition: background-color var(--transition-fast), border-color var(--transition-fast);
    display: block;
    margin: 0 auto;
  }

  .ct-checkbox:checked {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .ct-checkbox:checked::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 5px;
    height: 9px;
    border: 2px solid var(--color-bg-dark);
    border-top: none;
    border-left: none;
    transform: rotate(45deg);
  }

  .ct-checkbox:hover {
    border-color: var(--color-primary);
  }

  .ct-text-input {
    width: 100%;
    box-sizing: border-box;
    padding: 5px 8px;
    background: var(--color-bg-dark);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--font-sm);
    font-family: inherit;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    min-width: 80px;
  }

  .ct-text-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 22%, transparent);
  }

  .ct-textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 5px 8px;
    background: var(--color-bg-dark);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--font-sm);
    font-family: inherit;
    resize: vertical;
    min-width: 130px;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    line-height: 1.4;
  }

  .ct-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 22%, transparent);
  }

  .ct-counter {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .ct-counter-btn {
    width: 26px;
    height: 26px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface-hover);
    color: var(--color-text);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    flex-shrink: 0;
    font-family: inherit;
    transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
  }

  .ct-counter-btn:hover {
    background: color-mix(in srgb, var(--color-primary) 22%, var(--color-surface-hover));
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .ct-counter-input {
    width: 46px;
    text-align: center;
    padding: 4px 4px;
    background: var(--color-bg-dark);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--font-sm);
    font-family: inherit;
  }

  .ct-counter-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  /* ── Global section ── */
  .ct-global-section {
    margin-top: var(--spacing-xl);
    border: 1px solid color-mix(in srgb, var(--color-border-light) 56%, var(--color-border));
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  .ct-global-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: linear-gradient(135deg, var(--color-surface-hover), color-mix(in srgb, var(--color-border) 60%, var(--color-surface-hover)));
    border-bottom: 2px solid color-mix(in srgb, var(--color-primary) 38%, var(--color-border));
  }

  .ct-global-icon {
    font-size: 0.95rem;
  }

  .ct-global-title {
    font-size: var(--font-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-primary);
  }

  .ct-global-hint {
    font-size: var(--font-xs);
    color: var(--color-text-muted);
    margin-left: auto;
  }

  .ct-global-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    padding: 14px;
    background: var(--color-surface);
  }

  .ct-global-card {
    background: color-mix(in srgb, var(--color-surface-hover) 56%, var(--color-surface));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color var(--transition-fast);
  }

  .ct-global-card:hover {
    border-color: var(--color-border-light);
  }

  .ct-global-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ct-global-card-title {
    font-size: var(--font-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ct-global-card-body {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
  }

  .ct-text-input--global,
  .ct-textarea--global {
    width: 100%;
  }

  /* ── Responsive: card layout on narrow screens ── */
  @media (max-width: 640px) {
    .ct-page { padding: var(--spacing-md); }

    .ct-table-wrapper { border-radius: var(--radius-sm); }

    .ct-table thead { display: none; }

    .ct-table tbody .ct-row {
      display: block;
      border-bottom: 2px solid var(--color-border);
      padding: 2px 0;
    }

    .ct-table tbody .ct-row:last-child { border-bottom: none; }

    .ct-td--char {
      display: block;
      position: static;
      background: linear-gradient(135deg, var(--color-surface-hover), color-mix(in srgb, var(--color-border) 60%, var(--color-surface-hover)));
      border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 38%, var(--color-border));
      border-right: none;
      padding: 8px 12px;
      font-size: var(--font-sm);
    }

    .ct-td--cell {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-right: none;
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
      min-width: unset;
      padding: 7px 12px;
      gap: 12px;
    }

    .ct-td--cell:last-child { border-bottom: none; }

    .ct-td--cell::before {
      content: attr(data-label);
      font-size: var(--font-xs);
      font-weight: 600;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
      max-width: 42%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ct-td--checkbox {
      max-width: unset;
      text-align: left;
      min-width: unset;
    }

    .ct-td--checkbox .ct-checkbox { margin: 0; }

    .ct-text-input, .ct-textarea, .ct-counter { flex: 1; min-width: 0; }

    .ct-global-hint { display: none; }

    .ct-global-grid { gap: 8px; padding: 10px; }

    .ct-global-card { min-width: unset; width: 100%; }
  }
</style>
