<script lang="ts">
  import type { HeatmapDetailRow, HeatmapGroup, RaidCellState } from '../viewModels';

  export let visible = false;
  export let heatmapGroups: HeatmapGroup[] = [];
  export let heatmapDetailRows: HeatmapDetailRow[] = [];
  export let visibleRaidIndices: number[] = [];
  export let friendsRaidLabels: Record<string, string> = {};
  export let getRaidConfigAt: (raidIndex: number) => { id?: string } | undefined;
  export let getRosterSummaryCounts: (characters: HeatmapGroup['characters'], raidIndex: number) => { doneCount: number; visibleCount: number };
  export let resolveRosterSummaryState: (doneCount: number, visibleCount: number) => RaidCellState;
  export let getRosterSummaryTooltip: (characters: HeatmapGroup['characters'], raidIndex: number) => string;
  export let resolveDetailedState: (character: HeatmapDetailRow['character'], raidIndex: number) => RaidCellState;
  export let onClose: () => void;

  let summaryHoveredRow = '-2';
  let summaryHoveredCol = '-2';
  let detailHoveredRow = '-2';
  let detailHoveredCol = '-2';

  function shouldHighlightRow(rowId: string, hoveredRow: string) {
    return hoveredRow !== '-2' && rowId === hoveredRow;
  }

  function shouldHighlightCol(colId: string, hoveredCol: string) {
    return hoveredCol !== '-2' && hoveredCol !== '-1' && colId === hoveredCol;
  }

  function handleModalOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      onClose();
    }
  }
</script>

<div id="friends-heatmap-modal" class="friends-heatmap-modal" style={visible ? 'display: block;' : 'display: none;'} role="dialog" aria-modal="true" aria-labelledby="friends-heatmap-title">
  <div class="modal-overlay" role="button" tabindex="0" aria-label="Close group view" on:click={onClose} on:keydown={handleModalOverlayKeydown}></div>
  <div class="modal-content friends-heatmap-modal__content">
    <button class="close-btn" aria-label="Close group view" on:click={onClose}>×</button>
    <h2 id="friends-heatmap-title">Group View</h2>
    <div class="friends-heatmap" aria-label="Group raid view">
      {#if heatmapGroups.length === 0}
        <div class="friends-heatmap-empty" role="status" aria-live="polite">
          <h3>Group View is empty</h3>
          <p>Upload your weekly data in Friends Setup, then refresh friends to compare progress.</p>
        </div>
      {:else}
        <div class="friends-heatmap-dual">
          <div class="friends-heatmap-intro">
            <div class="friends-heatmap-intro__text">
              <h3 class="friends-heatmap-intro__title">Compare roster progress at a glance</h3>
              <p class="friends-heatmap-intro__meta">
                {heatmapGroups.length} rosters • {heatmapDetailRows.length} characters • {visibleRaidIndices.length} raids
              </p>
            </div>
            <div class="friends-heatmap-legend">
              <span class="friends-heatmap-legend__item state-self-done">✓ Completed</span>
              <span class="friends-heatmap-legend__item state-self-available">● Available</span>
              <span class="friends-heatmap-legend__item state-hidden-done">✓ Hidden + completed</span>
              <span class="friends-heatmap-legend__item state-none">- Hidden</span>
              <span class="friends-heatmap-legend__item state-progress">0/x Progress</span>
            </div>
          </div>

          <h3 class="friends-heatmap-section-title">Roster Summary</h3>
          <div class="friends-heatmap-wrap friends-heatmap-wrap--primary">
            <table class="friends-heatmap-table friends-heatmap-table--summary" on:mouseleave={() => { summaryHoveredRow = '-2'; summaryHoveredCol = '-2'; }}>
              <thead>
                <tr>
                  <th>ROSTER</th>
                  {#each visibleRaidIndices as raidIndex, columnIndex (columnIndex)}
                    {@const raid = getRaidConfigAt(raidIndex)}
                    {@const colId = String(columnIndex)}
                    <th class:is-hover-col={shouldHighlightCol(colId, summaryHoveredCol)}>
                      {friendsRaidLabels[String(raid?.id || '')] || String(raid?.id || '').toUpperCase()}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each heatmapGroups as group, rowIndex (group.id)}
                  {@const rowId = String(rowIndex)}
                  <tr style={`--friends-row-color:${group.color || '#64b5f6'};`} class:friends-heatmap-group={group.isSelf} class:is-self={group.isSelf}>
                    <th
                      class={`friends-heatmap-roster${group.isSelf ? ' is-self' : ''} ${shouldHighlightRow(rowId, summaryHoveredRow) ? 'is-hover-row' : ''}`}
                      on:pointerenter={() => { summaryHoveredRow = rowId; summaryHoveredCol = '-1'; }}
                    >
                      {group.name}
                    </th>
                    {#each visibleRaidIndices as raidIndex, columnIndex (columnIndex)}
                      {@const colId = String(columnIndex)}
                      {@const counts = getRosterSummaryCounts(group.characters, raidIndex)}
                      {@const state = resolveRosterSummaryState(counts.doneCount, counts.visibleCount)}
                      <td
                        class={`friends-heatmap-cell ${state.className} ${shouldHighlightRow(rowId, summaryHoveredRow) ? 'is-hover-row' : ''} ${shouldHighlightCol(colId, summaryHoveredCol) ? 'is-hover-col' : ''}`}
                        title={getRosterSummaryTooltip(group.characters, raidIndex)}
                        on:pointerenter={() => { summaryHoveredRow = rowId; summaryHoveredCol = colId; }}
                      >
                        {state.text}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <h3 class="friends-heatmap-section-title">Characters Detail</h3>
          <div class="friends-heatmap-wrap friends-heatmap-wrap--secondary">
            <table class="friends-heatmap-table friends-heatmap-table--detail" on:mouseleave={() => { detailHoveredRow = '-2'; detailHoveredCol = '-2'; }}>
              <thead>
                <tr>
                  <th>CHAR</th>
                  {#each visibleRaidIndices as raidIndex, columnIndex (columnIndex)}
                    {@const raid = getRaidConfigAt(raidIndex)}
                    {@const colId = String(columnIndex)}
                    <th class:is-hover-col={shouldHighlightCol(colId, detailHoveredCol)}>
                      {friendsRaidLabels[String(raid?.id || '')] || String(raid?.id || '').toUpperCase()}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each heatmapDetailRows as entry, rowIndex (entry.id)}
                  {@const rowId = String(rowIndex)}
                  <tr style={`--friends-char-color:${entry.group?.color || 'var(--color-text)'};`}>
                    <th
                      class={`friends-heatmap-char-name ${shouldHighlightRow(rowId, detailHoveredRow) ? 'is-hover-row' : ''}`}
                      on:pointerenter={() => { detailHoveredRow = rowId; detailHoveredCol = '-1'; }}
                    >
                      {entry.character?.name || '—'}
                    </th>
                    {#each visibleRaidIndices as raidIndex, columnIndex (columnIndex)}
                      {@const colId = String(columnIndex)}
                      {@const state = resolveDetailedState(entry.character, raidIndex)}
                      <td
                        class={`friends-heatmap-cell ${state.className} ${shouldHighlightRow(rowId, detailHoveredRow) ? 'is-hover-row' : ''} ${shouldHighlightCol(colId, detailHoveredCol) ? 'is-hover-col' : ''}`}
                        title={state.label}
                        on:pointerenter={() => { detailHoveredRow = rowId; detailHoveredCol = colId; }}
                      >
                        {state.text}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>