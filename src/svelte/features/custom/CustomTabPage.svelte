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
    resetValues,
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
  let confirmReset = false;
  // ── COLUMN RESIZE (disabled — re-enable in future build) ──────────────────
  let resizingCol: { id: string; startX: number; startW: number; minW: number } | null = null; // kept for future re-enable
  // let isResizing = false;
  // let _resizeColEl: HTMLElement | null = null;
  // let _resizeCharColEl: HTMLElement | null = null;
  // let _resizeTableEl: HTMLTableElement | null = null;
  // let _resizeRaf: number | null = null;
  // let _resizePendingW = 0;
  let wrapperW = 0; // bound to .ct-table-wrapper clientWidth
  let unsubscribeRosterChanges: (() => void) | null = null;

  $: sorted = orderedColumns(columnsState);
  $: perCharacterCols = sorted.filter((col) => col.scope === 'per-character');
  $: globalCols = sorted.filter((col) => col.scope === 'global');
  $: hasGlobalCols = globalCols.length > 0;
  $: hasColumns = sorted.length > 0;
  $: hasColWidths = false; // disabled while resize is off
  // $: hasColWidths = Object.keys(columnsState.colWidths ?? {}).length > 0;

  $: colsSum = hasColWidths
    ? perCharacterCols.reduce((s, c) => s + (columnsState.colWidths?.[c.id] ?? 100), 0)
    : 0;

  // Character column fills remaining space; min 120px so it's always readable
  $: charColW = Math.max(120, (wrapperW || 0) - colsSum);

  $: tableStyle = hasColWidths
    ? `table-layout: fixed; width: ${Math.max(wrapperW || 0, 120 + colsSum)}px`
    : '';

  onMount(async () => {
    await window.__API_READY__;
    clipboardColumns = loadLayoutClipboard();
    await loadRosterCharacters();

    let isInitialSync = true;
    unsubscribeRosterChanges = rosterChangeVersion.subscribe(() => {
      if (isInitialSync) { isInitialSync = false; return; }
      void loadRosterCharacters(true);
    });

    // window.addEventListener('mousemove', onResizeMove);
    // window.addEventListener('mouseup', onResizeEnd);
  });

  onDestroy(() => {
    unsubscribeRosterChanges?.();
    unsubscribeRosterChanges = null;
    // window.removeEventListener('mousemove', onResizeMove);
    // window.removeEventListener('mouseup', onResizeEnd);
  });

  async function loadRosterCharacters(forceResolve = false) {
    loading = true;
    confirmReset = false;
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
    if (resizingCol) { e.preventDefault(); return; }
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'button') { e.preventDefault(); return; }
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

  function resetContent() {
    values = resetValues(activeRosterId);
    confirmReset = false;
  }

  function onResizeStart(e: MouseEvent, colId: string) {
    e.preventDefault();
    e.stopPropagation();

    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement;
    const row = th.closest('tr') as HTMLTableRowElement;
    const allThs = Array.from(row.querySelectorAll<HTMLTableCellElement>('th'));

    // Snapshot ALL column widths from DOM to avoid layout jump when entering fixed mode.
    const snapshot: Record<string, number> = {};
    perCharacterCols.forEach((col, i) => {
      const thEl = allThs[i + 1]; // skip char th at index 0
      if (thEl) snapshot[col.id] = Math.round(thEl.getBoundingClientRect().width);
    });
    const startW = snapshot[colId] ?? Math.round(th.getBoundingClientRect().width);

    // ONE Svelte update to enter fixed layout with all columns at their current visual width.
    columnsState = { ...columnsState, colWidths: { ...(columnsState.colWidths ?? {}), ...snapshot } };

    // Grab DOM refs for direct manipulation during drag — no further Svelte re-renders until mouseup.
    _resizeTableEl = th.closest('table') as HTMLTableElement;
    const colIndex = perCharacterCols.findIndex(c => c.id === colId);
    const colEls = _resizeTableEl?.querySelectorAll<HTMLElement>('colgroup col');
    _resizeColEl = colEls ? colEls[colIndex + 1] : null; // +1 to skip char col
    _resizeCharColEl = colEls ? colEls[0] : null; // char col is always index 0

    const col = columnsState.columns.find(c => c.id === colId);
    const minW = col ? (TYPE_MIN_WIDTHS[col.type] ?? 60) : 60;

    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    resizingCol = { id: colId, startX: e.clientX, startW, minW };
  }

  const TYPE_MIN_WIDTHS: Record<ColumnType, number> = {
    checkbox: 36,
    counter:  88,
    text:     72,
    textarea: 100,
  };

  function onResizeMove(e: MouseEvent) {
    if (!resizingCol || !_resizeColEl) return;
    _resizePendingW = Math.max(resizingCol.minW, resizingCol.startW + (e.clientX - resizingCol.startX));
    if (_resizeRaf === null) {
      _resizeRaf = requestAnimationFrame(() => {
        if (_resizeColEl) _resizeColEl.style.width = `${_resizePendingW}px`;
        if (_resizeCharColEl && resizingCol) {
          const delta = _resizePendingW - resizingCol.startW;
          const newCharW = Math.max(120, charColW - delta);
          _resizeCharColEl.style.width = `${newCharW}px`;
          if (_resizeTableEl) {
            _resizeTableEl.style.width = `${Math.max(wrapperW, 120 + colsSum + delta)}px`;
          }
        }
        _resizeRaf = null;
      });
    }
  }

  function onResizeEnd() {
    if (!resizingCol || !_resizeTableEl) return;
    if (_resizeRaf !== null) { cancelAnimationFrame(_resizeRaf); _resizeRaf = null; }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Read final widths from DOM and commit all at once — single Svelte update.
    const colEls = _resizeTableEl.querySelectorAll<HTMLElement>('colgroup col');
    const newWidths: Record<string, number> = { ...(columnsState.colWidths ?? {}) };
    perCharacterCols.forEach((col, i) => {
      const w = parseFloat(colEls[i + 1]?.style.width ?? '');
      if (w > 0) newWidths[col.id] = w;
    });
    columnsState = { ...columnsState, colWidths: newWidths };
    saveColumns(activeRosterId, columnsState);

    _resizeColEl = null;
    _resizeTableEl = null;
    resizingCol = null;
    isResizing = false;
  }

  function onResizeDblClick(e: MouseEvent, colId: string) {
    e.stopPropagation();
    const { [colId]: _, ...rest } = columnsState.colWidths ?? {};
    columnsState = { ...columnsState, colWidths: Object.keys(rest).length ? rest : undefined };
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
    <!-- Data actions bar: contextual to table content, not page config -->
    <div class="ct-data-actions">
      {#if confirmReset}
        <div class="ct-reset-confirm" role="alertdialog" aria-label="Confirm clear content">
          <span class="ct-reset-confirm-text">⚠ Clear all data?</span>
          <button type="button" class="ct-tool-btn ct-tool-btn--confirm" on:click={resetContent}>Clear</button>
          <button type="button" class="ct-tool-btn" on:click={() => (confirmReset = false)}>Cancel</button>
        </div>
      {:else}
        <button
          type="button"
          class="ct-reset-btn"
          title="Clear all entered values for this roster"
          aria-label="Clear all entered values for this roster"
          on:click={() => (confirmReset = true)}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="1,4 15,4"/>
            <path d="M5 4V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V4M13 4l-.9 9.1A1.5 1.5 0 0110.6 14.5H5.4A1.5 1.5 0 013.9 13.1L3 4"/>
            <line x1="6.5" y1="7" x2="6.5" y2="11.5"/>
            <line x1="9.5" y1="7" x2="9.5" y2="11.5"/>
          </svg>
        </button>
      {/if}
    </div>

    <div class="ct-table-wrapper" bind:clientWidth={wrapperW}>
      <table
        class="ct-table"
        style={tableStyle}
        aria-label="Custom tracker table"
      >
        <colgroup>
          <col style={hasColWidths ? `width: ${charColW}px` : ''} />
          {#each perCharacterCols as col (col.id)}
            <col style={columnsState.colWidths?.[col.id] ? `width: ${columnsState.colWidths[col.id]}px` : ''} />
          {/each}
        </colgroup>
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
                <!-- resize handle disabled — re-enable in future build
                <div
                  class="ct-resize-handle"
                  draggable="false"
                  title="Drag to resize · Double-click to reset"
                  on:mousedown={(e) => onResizeStart(e, col.id)}
                  on:dblclick={(e) => onResizeDblClick(e, col.id)}
                ></div>
                -->
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
            <div
              class="ct-global-card"
              class:ct-global-card--dragging={draggingColId === col.id}
              draggable="true"
              on:dragstart={(e) => onHeaderDragStart(e, col.id)}
              on:dragend={onHeaderDragEnd}
              on:dragover={onHeaderDragOver}
              on:drop={(e) => onHeaderDrop(e, col.id)}
            >
              <div class="ct-global-card-header" style="pointer-events: none;">
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
    min-height: 200px;
  }

  /* ── Header ── */
  .ct-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--spacing-lg);
    margin-bottom: 0;
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
    position: relative;
    border-radius: var(--radius-md);
    border: 1px solid color-mix(in srgb, var(--color-border-light) 45%, var(--color-border));
    box-shadow:
      var(--shadow-sm),
      0 0 0 1px color-mix(in srgb, var(--color-primary) 6%, transparent),
      inset 0 1px 0 color-mix(in srgb, var(--color-primary) 10%, transparent);
    overflow: auto;
  }

  /* Subtle gold gradient accent along the top edge */
  .ct-table-wrapper::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    background: linear-gradient(90deg,
      transparent 0%,
      color-mix(in srgb, var(--color-primary) 55%, transparent) 30%,
      color-mix(in srgb, var(--color-primary) 75%, transparent) 50%,
      color-mix(in srgb, var(--color-primary) 55%, transparent) 70%,
      transparent 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  .ct-table {
    border-collapse: collapse;
    width: 100%;
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
    min-width: 240px;
    text-align: left;
    padding-left: 18px;
    color: var(--color-primary);
    letter-spacing: 0.06em;
    border-right: 2px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
    position: sticky;
    left: 0;
    z-index: 3;
    background: linear-gradient(135deg, var(--color-surface-hover), color-mix(in srgb, var(--color-border) 60%, var(--color-surface-hover)));
  }

  .ct-th[draggable] > .ct-th-inner {
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

  .ct-th--resizing {
    background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface-hover)) !important;
  }

  /* Column resize handle */
  .ct-resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 3;
    user-select: none;
  }

  .ct-resize-handle::after {
    content: '';
    position: absolute;
    right: 1px;
    top: 15%;
    width: 2px;
    height: 70%;
    background: transparent;
    border-radius: 1px;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);
  }

  .ct-resize-handle:hover::after,
  .ct-resize-handle--active::after {
    background: color-mix(in srgb, var(--color-primary) 75%, transparent);
    box-shadow: 0 0 4px color-mix(in srgb, var(--color-primary) 35%, transparent);
  }

  .ct-th-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    pointer-events: none; /* let drag events reach the <th> */
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
    pointer-events: none;
  }

  .ct-th-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    pointer-events: none;
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
    text-align: left;
    padding-left: 18px;
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--color-surface);
    border-right: 2px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
  }

  .ct-row:hover .ct-td--char {
    background: color-mix(in srgb, var(--color-surface-hover) 50%, var(--color-surface));
  }

  .ct-td--cell {
    text-align: center;
    overflow: hidden;
  }

  .ct-td--checkbox {
    text-align: center;
    padding: 6px 4px;
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
    display: inline-flex;
    align-items: center;
    gap: 0;
    background: var(--color-bg-dark);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .ct-counter-btn {
    width: 22px;
    height: 26px;
    border: none;
    border-radius: 0;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    flex-shrink: 0;
    font-family: inherit;
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .ct-counter-btn:hover {
    background: color-mix(in srgb, var(--color-primary) 18%, transparent);
    color: var(--color-primary);
  }

  .ct-counter-input {
    width: 34px;
    text-align: center;
    padding: 2px 0;
    background: transparent;
    border: none;
    border-left: 1px solid var(--color-border);
    border-right: 1px solid var(--color-border);
    color: var(--color-text);
    font-size: var(--font-sm);
    font-weight: 600;
    font-family: inherit;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .ct-counter-input::-webkit-inner-spin-button,
  .ct-counter-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .ct-counter-input:focus {
    outline: none;
    background: color-mix(in srgb, var(--color-primary) 6%, transparent);
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
    transition: border-color var(--transition-fast), opacity var(--transition-fast), box-shadow var(--transition-fast);
    cursor: grab;
  }

  .ct-global-card:hover {
    border-color: var(--color-border-light);
  }

  .ct-global-card--dragging {
    opacity: 0.4;
    cursor: grabbing;
  }

  .ct-global-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    pointer-events: none;
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

  /* ── Data actions bar (above table, right-aligned) ── */
  .ct-data-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    height: 36px;
    margin-bottom: var(--spacing-sm);
  }

  /* ── Reset button ── */
  .ct-reset-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0;
    transition: color var(--transition-fast), background var(--transition-fast),
                border-color var(--transition-fast), transform var(--transition-fast);
    flex-shrink: 0;
  }

  .ct-reset-btn:hover {
    color: var(--color-text-secondary);
    background: var(--color-surface-hover);
    border-color: var(--color-border);
    transform: scale(1.08);
  }

  .ct-reset-btn:active {
    transform: scale(0.94);
  }

  .ct-reset-confirm {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 6px 3px 10px;
    background: color-mix(in srgb, var(--color-surface-hover) 70%, var(--color-surface));
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-sm);
    animation: ct-confirm-in 0.14s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes ct-confirm-in {
    from { opacity: 0; transform: scale(0.93) translateX(5px); }
    to   { opacity: 1; transform: scale(1)    translateX(0); }
  }

  .ct-reset-confirm-text {
    font-size: var(--font-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    white-space: nowrap;
    letter-spacing: 0.01em;
  }

  .ct-tool-btn--confirm {
    color: var(--color-primary);
    border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
    background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
    font-weight: 700;
  }

  .ct-tool-btn--confirm:hover {
    background: color-mix(in srgb, var(--color-primary) 20%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-primary) 65%, var(--color-border));
    color: var(--color-primary);
  }
</style>
