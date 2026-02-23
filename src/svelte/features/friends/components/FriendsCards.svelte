<script lang="ts">
  import type { FriendGridCard, SyncBadgeState } from '../viewModels';

  export let loading = false;
  export let message = '';
  export let gridCards: FriendGridCard[] = [];
  export let visibleRaidIndices: number[] = [];
  export let friendsRaidLabels: Record<string, string> = {};
  export let computeCardRaidProgress: (characters: FriendGridCard['characters'], raidIndices: number[]) => { done: number; total: number };
  export let resolveCardSyncState: (card: FriendGridCard) => SyncBadgeState;
  export let getRaidConfigAt: (raidIndex: number) => { id?: string } | undefined;

  function resolveRaidCellState(character: FriendGridCard['characters'][number], raidIndex: number) {
    const hasVisibleMask = character.visibleMask !== null && character.visibleMask !== undefined;
    const visible = hasVisibleMask ? (((character.visibleMask || 0) & (1 << raidIndex)) !== 0) : true;
    const ignored = !visible;
    const doneRaw = ((character.raidMask || 0) & (1 << raidIndex)) !== 0;
    const hiddenDone = ignored && doneRaw;
    const done = !ignored && doneRaw;

    if (hiddenDone) {
      return {
        className: 'friends-raid-cell is-hidden-done',
        title: 'Completed (hidden from gold)',
        text: '✓',
      };
    }

    if (ignored) {
      return {
        className: 'friends-raid-cell is-ignored',
        title: 'Hidden for this character',
        text: '-',
      };
    }

    if (done) {
      return {
        className: 'friends-raid-cell is-done',
        title: 'Completed',
        text: '✓',
      };
    }

    return {
      className: 'friends-raid-cell is-pending',
      title: 'Available and not completed',
      text: '●',
    };
  }
</script>

<div class="friends-grid" aria-live="polite">
  {#if loading}
    <p class="friends-empty">Loading Friends...</p>
  {:else}
    {#if message}
      <p class="friends-empty">{message}</p>
    {/if}

    {#if gridCards.length === 0}
      <p class="friends-empty">No roster data to display.</p>
    {:else}
      {#each gridCards as card (card.id)}
        {@const progress = computeCardRaidProgress(card.characters, visibleRaidIndices)}
        {@const syncState = resolveCardSyncState(card)}
        <section class={`friends-card${card.isSelf ? ' friends-card--self' : ''}`}>
          <div class="friends-card__header">
            <h2 class="friends-card__title" style={`color:${card.heatmapColor};`}>{card.title}</h2>
            <div class="friends-card__meta">
              <span class="friends-card__summary">
                {#if progress.total > 0}
                  {progress.done}/{progress.total} raids done
                {:else}
                  No visible raids
                {/if}
              </span>
              <span class={`friends-card__sync-badge ${syncState.className}`} title={syncState.title}>
                {syncState.label}
              </span>
            </div>
          </div>

          <div class="friends-table-wrap">
            <table class="friends-table" style={`min-width: ${56 + (visibleRaidIndices.length * 58)}px;`}>
              <thead>
                <tr>
                  <th>CHAR</th>
                  {#each visibleRaidIndices as raidIndex (raidIndex)}
                    {@const raid = getRaidConfigAt(raidIndex)}
                    <th>{friendsRaidLabels[String(raid?.id || '')] || String(raid?.id || '').toUpperCase()}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#if card.characters.length === 0}
                  <tr>
                    <td class="friends-row-empty" colspan={visibleRaidIndices.length + 1}>No characters synced yet</td>
                  </tr>
                {:else}
                  {#each card.characters as character (character.name)}
                    <tr>
                      <td class="friends-char-name">{character.name}</td>
                      {#each visibleRaidIndices as raidIndex (raidIndex)}
                        {@const cellState = resolveRaidCellState(character, raidIndex)}
                        <td
                          class={cellState.className}
                          title={cellState.title}
                        >
                          {cellState.text}
                        </td>
                      {/each}
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        </section>
      {/each}
    {/if}
  {/if}
</div>