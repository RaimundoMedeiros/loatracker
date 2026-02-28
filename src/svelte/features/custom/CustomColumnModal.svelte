<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import type { CustomColumn, CustomColumnsState, ColumnType, ColumnScope } from './customTabDomain';
  import { generateColumnId, orderedColumns, reorderColumns } from './customTabDomain';

  export let state: CustomColumnsState;

  const dispatch = createEventDispatcher<{ close: void; update: CustomColumnsState }>();

  let newTitle = '';
  let newType: ColumnType = 'checkbox';
  let newScope: ColumnScope = 'per-character';
  let addError = '';
  let draggingId: string | null = null;
  let editingId: string | null = null;
  let editingTitle = '';
  let colorPickerForId: string | null = null;
  let editInputEl: HTMLInputElement | null = null;

  $: sorted = orderedColumns(state);

  const PRESET_COLORS = [
    { hex: '#d4af37', label: 'Gold' },
    { hex: '#4CAF50', label: 'Green' },
    { hex: '#2196F3', label: 'Blue' },
    { hex: '#9c27b0', label: 'Purple' },
    { hex: '#ff9800', label: 'Orange' },
    { hex: '#e74c3c', label: 'Red' },
    { hex: '#00bcd4', label: 'Teal' },
    { hex: '#e91e63', label: 'Pink' },
    { hex: '#78909c', label: 'Slate' },
    { hex: '#8bc34a', label: 'Lime' },
  ];

  function emitUpdate(next: CustomColumnsState) {
    dispatch('update', next);
  }

  function addColumn() {
    const title = newTitle.trim();
    if (!title) { addError = 'Column title is required.'; return; }
    if (title.length > 40) { addError = 'Title must be 40 characters or less.'; return; }
    addError = '';
    const id = generateColumnId();
    const newCol: CustomColumn = { id, title, type: newType, scope: newScope };
    emitUpdate({ columns: [...state.columns, newCol], columnOrder: [...state.columnOrder, id] });
    newTitle = '';
    newType = 'checkbox';
    newScope = 'per-character';
  }

  function deleteColumn(id: string) {
    emitUpdate({
      columns: state.columns.filter((col) => col.id !== id),
      columnOrder: state.columnOrder.filter((cid) => cid !== id),
    });
  }

  async function startEdit(col: CustomColumn) {
    colorPickerForId = null;
    editingId = col.id;
    editingTitle = col.title;
    await tick();
    editInputEl?.focus();
    editInputEl?.select();
  }

  function saveEdit() {
    if (!editingId) return;
    const title = editingTitle.trim();
    if (title && title.length <= 40) {
      const col = state.columns.find((c) => c.id === editingId);
      if (col && col.title !== title) {
        emitUpdate({ ...state, columns: state.columns.map((c) => c.id === editingId ? { ...c, title } : c) });
      }
    }
    editingId = null;
  }

  function onEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') { editingId = null; }
  }

  function toggleColorPicker(id: string) {
    editingId = null;
    colorPickerForId = colorPickerForId === id ? null : id;
  }

  function setColumnColor(id: string, color: string | null) {
    emitUpdate({
      ...state,
      columns: state.columns.map((c) => {
        if (c.id !== id) return c;
        const { color: _omit, ...rest } = c;
        return color ? { ...rest, color } : rest;
      }),
    });
    colorPickerForId = null;
  }

  function onDragStart(event: DragEvent, id: string) {
    if (editingId || colorPickerForId) return;
    draggingId = id;
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnd() { draggingId = null; }
  function onDragOver(event: DragEvent) { event.preventDefault(); }

  function onDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    const draggedId = draggingId || event.dataTransfer?.getData('text/plain') || '';
    if (!draggedId || draggedId === targetId) return;
    emitUpdate({ columns: [...state.columns], columnOrder: reorderColumns(state.columnOrder, draggedId, targetId) });
    draggingId = null;
  }

  function onOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); dispatch('close'); }
  }
  function onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) dispatch('close');
  }

  const TYPE_META: Record<ColumnType, { label: string; icon: string; color: string }> = {
    checkbox: { label: 'Checkbox', icon: '✓', color: '#4CAF50' },
    text:     { label: 'Text',     icon: 'T', color: '#2196F3' },
    textarea: { label: 'Note',     icon: '≡', color: '#ff9800' },
    counter:  { label: 'Counter',  icon: '#', color: '#9c27b0' },
  };

  function getColColor(col: CustomColumn): string {
    return col.color ?? TYPE_META[col.type].color;
  }

  function getScopeLabel(scope: ColumnScope): string {
    return scope === 'global' ? '🌐 Roster-Wide' : '👤 Per Char';
  }
</script>

<div
  id="custom-column-settings-modal"
  class="ccm-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="ccm-title"
  tabindex="0"
  on:click={onOverlayClick}
  on:keydown={onOverlayKeydown}
>
  <div class="ccm-panel" role="document">
    <!-- Header -->
    <div class="ccm-header">
      <div class="ccm-header-left">
        <span class="ccm-header-icon" aria-hidden="true">⚙</span>
        <h3 id="ccm-title">Configure Columns</h3>
      </div>
      <button type="button" class="ccm-close" aria-label="Close column settings" on:click={() => dispatch('close')}>×</button>
    </div>

    <div class="ccm-body">
      <!-- Existing columns -->
      {#if sorted.length > 0}
        <div class="ccm-section">
          <div class="ccm-section-header">
            <span class="ccm-section-title">Columns ({sorted.length})</span>
            <span class="ccm-section-hint">Click name to rename · Click badge for color · Drag to reorder</span>
          </div>
          <ul class="ccm-list" aria-label="Configured columns">
            {#each sorted as col (col.id)}
              <li
                class="ccm-item"
                class:ccm-item--dragging={draggingId === col.id}
                class:ccm-item--expanded={colorPickerForId === col.id}
                draggable={editingId === null && colorPickerForId === null}
                on:dragstart={(e) => onDragStart(e, col.id)}
                on:dragend={onDragEnd}
                on:dragover={onDragOver}
                on:drop={(e) => onDrop(e, col.id)}
              >
                <!-- Main row -->
                <div class="ccm-item-row">
                  <span class="ccm-drag" aria-hidden="true" title="Drag to reorder">⠿</span>

                  <!-- Type badge — click for color picker -->
                  <button
                    type="button"
                    class="ccm-badge-btn"
                    title="Click to change color"
                    aria-label="Change color for {col.title}"
                    on:click={() => toggleColorPicker(col.id)}
                  >
                    <span
                      class="ccm-type-badge"
                      style="background: color-mix(in srgb, {getColColor(col)} 18%, transparent); color: {getColColor(col)}; border-color: color-mix(in srgb, {getColColor(col)} 40%, transparent);"
                    >{TYPE_META[col.type].icon}</span>
                    <span class="ccm-badge-palette" aria-hidden="true">🎨</span>
                  </button>

                  <!-- Title — click to edit -->
                  {#if editingId === col.id}
                    <input
                      bind:this={editInputEl}
                      class="ccm-item-title-input"
                      type="text"
                      maxlength="40"
                      bind:value={editingTitle}
                      on:blur={saveEdit}
                      on:keydown={onEditKeydown}
                    />
                  {:else}
                    <button
                      type="button"
                      class="ccm-item-title-btn"
                      title="Click to rename"
                      on:click={() => startEdit(col)}
                    >
                      <span class="ccm-item-title">{col.title}</span>
                      <span class="ccm-edit-hint" aria-hidden="true">✎</span>
                    </button>
                  {/if}

                  <span class="ccm-item-scope">{getScopeLabel(col.scope)}</span>
                  <button
                    type="button"
                    class="ccm-delete"
                    aria-label="Delete column {col.title}"
                    on:click={() => deleteColumn(col.id)}
                  >×</button>
                </div>

                <!-- Color picker (inline expandable) -->
                {#if colorPickerForId === col.id}
                  <div class="ccm-color-picker">
                    <button
                      type="button"
                      class="ccm-color-swatch ccm-color-swatch--auto"
                      title="Default color for {TYPE_META[col.type].label}"
                      aria-label="Reset to default color"
                      on:click={() => setColumnColor(col.id, null)}
                    >
                      <span style="color:{TYPE_META[col.type].color}">{TYPE_META[col.type].icon}</span>
                    </button>
                    {#each PRESET_COLORS as { hex, label }}
                      <button
                        type="button"
                        class="ccm-color-swatch"
                        class:ccm-color-swatch--active={col.color === hex}
                        style="background:{hex};"
                        title={label}
                        aria-label="Set color to {label}"
                        on:click={() => setColumnColor(col.id, hex)}
                      >
                        {#if col.color === hex}<span class="ccm-swatch-check">✓</span>{/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- Add new column form -->
      <div class="ccm-section">
        <div class="ccm-section-header">
          <span class="ccm-section-title">{sorted.length === 0 ? 'Add your first column' : 'Add Column'}</span>
        </div>

        <form class="ccm-form" aria-label="Add new column" on:submit|preventDefault={addColumn}>
          <div class="ccm-field">
            <label class="ccm-label" for="ccm-title-input">Title</label>
            <input
              id="ccm-title-input"
              type="text"
              class="ccm-input"
              placeholder="e.g. Event Shop, Farm Gold, Notes…"
              bind:value={newTitle}
              maxlength="40"
            />
          </div>

          <div class="ccm-field-row">
            <div class="ccm-field ccm-field--half">
              <label class="ccm-label" for="ccm-type-select">Type</label>
              <select id="ccm-type-select" class="ccm-select" bind:value={newType}>
                <option value="checkbox">✓ Checkbox</option>
                <option value="text">T Short Text</option>
                <option value="textarea">≡ Text Area (Notes)</option>
                <option value="counter"># Counter</option>
              </select>
            </div>
            <div class="ccm-field ccm-field--half">
              <label class="ccm-label" for="ccm-scope-select">Scope</label>
              <select id="ccm-scope-select" class="ccm-select" bind:value={newScope}>
                <option value="per-character">👤 Per Character</option>
                <option value="global">🌐 Global (roster)</option>
              </select>
            </div>
          </div>

          <p class="ccm-type-hint">
            {#if newType === 'checkbox'}A checkbox toggled per character. Great for tracking completions.
            {:else if newType === 'text'}A short text field (single line) per character.
            {:else if newType === 'textarea'}A multi-line notes area for longer observations.
            {:else}A numeric counter with + / − buttons.{/if}
            {#if newScope === 'global'} · <strong>Roster-Wide</strong>: one shared value for the whole roster.{/if}
          </p>

          {#if addError}
            <p class="ccm-error" role="alert">⚠ {addError}</p>
          {/if}

          <div class="ccm-form-actions">
            <button type="submit" class="ccm-add-btn">+ Add Column</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>

<style>
  .ccm-overlay {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(5, 8, 14, 0.74);
    backdrop-filter: blur(3px);
  }

  .ccm-panel {
    width: min(540px, 96vw);
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-border-light) 62%, var(--color-border));
    border-radius: var(--radius-lg);
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--color-surface-light) 92%, var(--color-surface)) 0%,
      color-mix(in srgb, var(--color-surface) 88%, var(--color-bg-darker)) 100%);
    box-shadow: var(--shadow-lg);
  }

  /* Header */
  .ccm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-border-light) 56%, var(--color-border));
    flex-shrink: 0;
    background: color-mix(in srgb, var(--color-surface-hover) 38%, transparent);
  }

  .ccm-header-left { display: flex; align-items: center; gap: 8px; }
  .ccm-header-icon { font-size: 1rem; color: var(--color-primary); }
  .ccm-header h3 {
    margin: 0; font-size: 1rem; font-weight: 700;
    color: var(--color-primary); letter-spacing: 0.01em;
  }

  .ccm-close {
    background: none; border: none; cursor: pointer;
    font-size: 1.5rem; line-height: 1; color: var(--color-text-muted);
    padding: 2px 6px; border-radius: var(--radius-sm);
    transition: color var(--transition-fast), background var(--transition-fast);
  }
  .ccm-close:hover { color: var(--color-text); background: var(--color-surface-hover); }

  /* Body */
  .ccm-body {
    padding: 14px 16px 18px;
    overflow-y: auto; flex: 1;
    display: flex; flex-direction: column; gap: 18px;
  }

  /* Sections */
  .ccm-section { display: flex; flex-direction: column; gap: 10px; }
  .ccm-section-header {
    display: flex; align-items: baseline;
    justify-content: space-between; gap: 8px;
  }
  .ccm-section-title {
    font-size: var(--font-sm); font-weight: 700;
    color: var(--color-text); letter-spacing: 0.02em; text-transform: uppercase;
  }
  .ccm-section-hint { font-size: var(--font-xs); color: var(--color-text-muted); }

  /* Column list */
  .ccm-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }

  .ccm-item {
    display: flex;
    flex-direction: column;
    padding: 0;
    background: color-mix(in srgb, var(--color-surface-hover) 56%, var(--color-surface));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    user-select: none;
    transition: border-color var(--transition-fast), background var(--transition-fast);
    overflow: hidden;
  }
  .ccm-item:hover { border-color: var(--color-border-light); }
  .ccm-item--dragging { opacity: 0.35; }
  .ccm-item--expanded { border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border)); }

  /* Item main row */
  .ccm-item-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    cursor: grab;
  }
  .ccm-item-row:active { cursor: grabbing; }

  .ccm-drag {
    color: var(--color-text-muted); font-size: 1.1rem;
    flex-shrink: 0; line-height: 1;
  }

  /* Badge button (color picker trigger) */
  .ccm-badge-btn {
    position: relative;
    background: none; border: none; padding: 0; cursor: pointer;
    flex-shrink: 0; border-radius: var(--radius-sm);
    display: inline-flex; align-items: center;
  }
  .ccm-badge-palette {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; opacity: 0;
    background: rgba(0,0,0,0.55); border-radius: var(--radius-sm);
    transition: opacity var(--transition-fast);
    pointer-events: none;
  }
  .ccm-badge-btn:hover .ccm-badge-palette { opacity: 1; }

  .ccm-type-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px;
    border-radius: var(--radius-sm); border: 1px solid;
    font-size: 11px; font-weight: 700;
    transition: filter var(--transition-fast);
  }
  .ccm-badge-btn:hover .ccm-type-badge { filter: brightness(1.25); }

  /* Title button (rename trigger) */
  .ccm-item-title-btn {
    flex: 1; min-width: 0;
    background: none; border: none; cursor: text;
    padding: 2px 4px; border-radius: var(--radius-sm);
    display: flex; align-items: center; gap: 5px;
    text-align: left;
    transition: background var(--transition-fast);
  }
  .ccm-item-title-btn:hover { background: color-mix(in srgb, var(--color-primary) 10%, transparent); }
  .ccm-item-title {
    font-size: var(--font-sm); font-weight: 500;
    color: var(--color-text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ccm-edit-hint {
    font-size: 11px; color: var(--color-text-muted);
    opacity: 0; flex-shrink: 0;
    transition: opacity var(--transition-fast);
  }
  .ccm-item-title-btn:hover .ccm-edit-hint { opacity: 1; }

  /* Inline rename input */
  .ccm-item-title-input {
    flex: 1; min-width: 0;
    padding: 3px 7px;
    background: var(--color-bg-dark);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--font-sm); font-family: inherit; font-weight: 500;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 22%, transparent);
    outline: none;
    box-sizing: border-box;
  }

  .ccm-item-scope {
    font-size: var(--font-xs); color: var(--color-text-muted);
    white-space: nowrap; flex-shrink: 0;
  }

  .ccm-delete {
    background: none; border: none; cursor: pointer;
    font-size: 1.1rem; line-height: 1; color: var(--color-text-muted);
    padding: 2px 5px; border-radius: var(--radius-sm); flex-shrink: 0;
    transition: color var(--transition-fast), background var(--transition-fast);
  }
  .ccm-delete:hover {
    color: var(--color-error);
    background: color-mix(in srgb, var(--color-error) 14%, transparent);
  }

  /* Color picker row */
  .ccm-color-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 8px 10px 10px 10px;
    border-top: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
    background: color-mix(in srgb, var(--color-bg-dark) 40%, transparent);
  }

  .ccm-color-swatch {
    width: 26px; height: 26px;
    border-radius: var(--radius-sm);
    border: 2px solid transparent;
    cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    transition: transform var(--transition-fast), border-color var(--transition-fast);
    padding: 0;
    font-size: 11px;
    font-weight: 700;
  }
  .ccm-color-swatch:hover { transform: scale(1.2); border-color: white; }
  .ccm-color-swatch--active { border-color: white; transform: scale(1.1); }
  .ccm-color-swatch--auto {
    background: color-mix(in srgb, var(--color-surface-hover) 80%, transparent);
    border-color: var(--color-border);
    font-size: 12px;
  }
  .ccm-color-swatch--auto:hover { border-color: var(--color-border-light); }
  .ccm-swatch-check { color: white; font-size: 12px; font-weight: 900; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }

  /* Add form */
  .ccm-form { display: flex; flex-direction: column; gap: 10px; }
  .ccm-field { display: flex; flex-direction: column; gap: 5px; }
  .ccm-field-row { display: flex; gap: 10px; }
  .ccm-field--half { flex: 1; }

  .ccm-label {
    font-size: var(--font-xs); font-weight: 600;
    color: var(--color-text-secondary);
    letter-spacing: 0.03em; text-transform: uppercase;
  }

  .ccm-input, .ccm-select {
    width: 100%; padding: 8px 10px;
    background: var(--color-bg-dark); border: 1px solid var(--color-border);
    border-radius: var(--radius-md); color: var(--color-text);
    font-size: var(--font-sm); font-family: inherit;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    box-sizing: border-box;
  }
  .ccm-input:focus, .ccm-select:focus {
    outline: none; border-color: var(--color-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 22%, transparent);
  }

  .ccm-type-hint {
    margin: 0; font-size: var(--font-xs); color: var(--color-text-muted);
    line-height: 1.45; padding: 6px 10px;
    background: color-mix(in srgb, var(--color-surface-hover) 50%, transparent);
    border-radius: var(--radius-sm);
    border-left: 2px solid var(--color-border-light);
  }
  .ccm-type-hint strong { color: var(--color-primary); }

  .ccm-error {
    margin: 0; font-size: var(--font-xs); color: var(--color-error);
    background: color-mix(in srgb, var(--color-error) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-error) 30%, transparent);
    border-radius: var(--radius-sm); padding: 6px 10px;
  }

  .ccm-form-actions { display: flex; justify-content: flex-end; }
  .ccm-add-btn {
    padding: 8px 20px; background: var(--color-primary);
    color: var(--color-bg-dark); border: 1px solid var(--color-primary-dark);
    border-radius: var(--radius-md); cursor: pointer;
    font-size: var(--font-sm); font-weight: 700; font-family: inherit;
    transition: background var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast);
  }
  .ccm-add-btn:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px); box-shadow: var(--shadow-sm);
  }
</style>
