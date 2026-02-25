<script lang="ts">
  import type { FriendRow } from '../viewModels';

  export let visible = false;
  export let maskedSelfCode = '-';
  export let selfHeatmapColor = '#64b5f6';
  export let selfCodeVisible = false;
  export let copyFeedbackActive = false;
  export let copyLabel = 'Copy';
  export let selfPin = '';
  export let selfPinInputType: 'text' | 'password' = 'password';
  export let selfPinVisible = false;

  // Compute locally so the input type is always in sync with selfPinVisible,
  // regardless of prop update timing from the parent.
  $: localPinInputType = selfPinVisible ? 'text' : 'password';
  export let disableUpload = true;
  export let loading = false;
  export let configured = false;
  export let uploadTitle = '';
  export let uploading = false;
  export let addRosterCode = '';
  export let addPin = '';
  export let addAlias = '';
  export let refreshing = false;
  export let rows: FriendRow[] = [];
  export let editingAliasFriendId = '';
  export let aliasDraft = '';
  export let formatDateTime: (value: unknown) => string;

  export let onClose: () => void;
  export let onSelfColorInput: (event: Event) => void;
  export let onToggleSelfCodeVisibility: () => void;
  export let onCopySelfCode: () => void;
  export let onSelfPinInput: (nextValue: string) => void;
  export let onSelfPinChange: () => void;
  export let onToggleSelfPinVisibility: () => void;
  export let onUpload: () => void;
  export let onAddRosterCodeInput: (nextValue: string) => void;
  export let onAddPinInput: (nextValue: string) => void;
  export let onAddAliasInput: (nextValue: string) => void;
  export let onAddFriend: () => void;
  export let onStartEditingAlias: (friendId: string) => void;
  export let onAliasDraftInput: (nextValue: string) => void;
  export let onSaveEditingAlias: (friendId: string) => void;
  export let onCancelEditingAlias: () => void;
  export let onFriendColorInput: (friendId: string, event: Event) => void;
  export let onRemoveFriend: (friendId: string) => void;

  function handleModalOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      onClose();
    }
  }

  function handleAliasInputKeydown(friendId: string, event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSaveEditingAlias(friendId);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancelEditingAlias();
    }
  }
</script>

<div id="friends-setup-modal" class="friends-setup-modal" style={visible ? 'display: block;' : 'display: none;'} role="dialog" aria-modal="true" aria-labelledby="friends-setup-title">
  <div class="modal-overlay" role="button" tabindex="0" aria-label="Close friends setup" on:click={onClose} on:keydown={handleModalOverlayKeydown}></div>
  <div class="modal-content friends-setup-modal__content">
    <button id="friends-setup-close-btn" class="close-btn" aria-label="Close friends setup" on:click={onClose}>×</button>
    <div class="friends-setup-titlebar">
      <h2 id="friends-setup-title">Friends Setup</h2>
      <p>Configure your profile and manage who appears in your sync list.</p>
    </div>

    <div class="friends-setup-layout">
      <section class="friends-setup-card friends-setup-card--profile" aria-labelledby="friends-profile-title">
        <div class="friends-setup-card__header">
          <h3 id="friends-profile-title">My Profile</h3>
          <span class="friends-setup-card__subtitle">Share your roster code and PIN so your friends can add you</span>
        </div>

        <div class="friends-self-code-row">
          <div class="friends-self-code friends-self-code--id-card">
            <span class="friends-self-label">Your roster code</span>
            <code id="friends-self-code">{maskedSelfCode}</code>
          </div>
          <label class="friends-self-color" for="friends-self-color-input" title="Roster color used for your card and character names in this tab">
            <span class="visually-hidden">Roster color for your card and character names in this tab</span>
            <input
              id="friends-self-color-input"
              type="color"
              value={selfHeatmapColor}
              aria-label="Roster color for your card and character names in this tab"
              on:input={onSelfColorInput}
              on:change={onSelfColorInput}
            />
          </label>
          <button
            id="friends-code-visibility-btn"
            class="friends-visibility-btn"
            type="button"
            title={selfCodeVisible ? 'Hide roster code' : 'Show roster code'}
            aria-label={selfCodeVisible ? 'Hide roster code' : 'Show roster code'}
            aria-pressed={selfCodeVisible}
            on:click={onToggleSelfCodeVisibility}
          >
            {#if selfCodeVisible}
              <svg class="friends-visibility-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><path d="M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-1.01 2.28-2.79 4.18-5.05 5.33" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><path d="M6.61 6.61C4.62 7.85 3.08 9.76 2 12c.81 1.68 1.96 3.12 3.36 4.22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            {:else}
              <svg class="friends-visibility-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
            {/if}
          </button>
          <button
            id="friends-copy-code-btn"
            class={`friends-copy-code-btn ${copyFeedbackActive ? 'is-copied' : ''}`}
            type="button"
            title={copyFeedbackActive ? 'Copied' : 'Copy to clipboard'}
            aria-label={copyFeedbackActive ? 'Copied' : 'Copy to clipboard'}
            on:click={onCopySelfCode}
          >
            <img src="assets/icons/items/copy.svg" alt="" aria-hidden="true" />
            <span class="friends-copy-code-btn__text">{copyLabel}</span>
          </button>
        </div>

        <div class="friends-controls-row">
          <label class="friends-self-pin-label" for="friends-self-pin-input">
            <span>Your PIN</span>
            <div class="friends-self-pin-input-wrap">
              <input
                id="friends-self-pin-input"
                type={localPinInputType}
                maxlength="32"
                value={selfPin}
                on:input={(event) => onSelfPinInput(String((event.currentTarget as HTMLInputElement | null)?.value || ''))}
                on:change={onSelfPinChange}
                placeholder="PIN for your uploads"
              />
              <button
                id="friends-self-pin-visibility-btn"
                class="friends-visibility-btn"
                type="button"
                title={selfPinVisible ? 'Hide PIN' : 'Show PIN'}
                aria-label={selfPinVisible ? 'Hide PIN' : 'Show PIN'}
                aria-pressed={selfPinVisible}
                on:click={onToggleSelfPinVisibility}
              >
                {#if selfPinVisible}
                  <svg class="friends-visibility-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><path d="M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-1.01 2.28-2.79 4.18-5.05 5.33" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><path d="M6.61 6.61C4.62 7.85 3.08 9.76 2 12c.81 1.68 1.96 3.12 3.36 4.22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
                {:else}
                  <svg class="friends-visibility-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
                {/if}
              </button>
            </div>
          </label>
        </div>

        <div class="friends-profile-actions">
          <button
            id="friends-upload-profile-btn"
            class="friends-profile-upload-btn"
            type="button"
            disabled={disableUpload || loading || !configured}
            title={uploadTitle}
            on:click={onUpload}
          >
            {uploading ? 'Uploading...' : 'Upload Weekly'}
          </button>
        </div>

        <div class="friends-profile-instructions" role="note" aria-label="Instructions">
          <span class="friends-profile-instructions__title">Instructions:</span>
          <p>Set your PIN, upload weekly, then share roster code + PIN with your friends.</p>
          <p>When the app regains focus, weekly changes are checked and uploaded automatically.</p>
        </div>
      </section>

      <section class="friends-setup-card friends-setup-card--friends" aria-labelledby="friends-manage-title">
        <div class="friends-setup-card__header">
          <h3 id="friends-manage-title">Manage Friends</h3>
          <span class="friends-setup-card__subtitle">Add friends to compare weekly raid progress</span>
        </div>

        <form id="friends-add-form" class="friends-add-form" autocomplete="off" on:submit|preventDefault={onAddFriend}>
          <input
            id="friends-code-input"
            value={addRosterCode}
            on:input={(event) => onAddRosterCodeInput(String((event.currentTarget as HTMLInputElement | null)?.value || ''))}
            type="text"
            placeholder="Friend roster code"
            maxlength="80"
            required
          />
          <input
            id="friends-pin-input"
            value={addPin}
            on:input={(event) => onAddPinInput(String((event.currentTarget as HTMLInputElement | null)?.value || ''))}
            type="password"
            placeholder="PIN"
            maxlength="32"
            required
          />
          <input
            id="friends-alias-input"
            value={addAlias}
            on:input={(event) => onAddAliasInput(String((event.currentTarget as HTMLInputElement | null)?.value || ''))}
            type="text"
            placeholder="Alias (optional)"
            maxlength="32"
          />
          <button id="friends-add-btn" type="submit" disabled={refreshing || loading || !configured}>Add Friend</button>
        </form>

        <div id="friends-list" class={`friends-list ${rows.length === 0 ? 'friends-list--empty' : ''}`} aria-label="Configured friends">
          {#if rows.length === 0}
            <div class="friends-empty-state" role="status" aria-live="polite">
              <div class="friends-empty-state__icon" aria-hidden="true">⚔</div>
              <p class="friends-empty-state__text">Your friends list is empty. Add someone to compare raid progress!</p>
            </div>
          {:else}
            {#each rows as row (row.id)}
              <div class="friends-list-item">
                <div class="friends-list-item__alias-wrap">
                  {#if editingAliasFriendId === row.id}
                    <input
                      class="friends-list-item__alias-input"
                      type="text"
                      maxlength="32"
                      value={aliasDraft}
                      on:input={(event) => onAliasDraftInput(String((event.currentTarget as HTMLInputElement | null)?.value || ''))}
                      aria-label={`Edit alias for ${row.title}`}
                      on:keydown={(event) => handleAliasInputKeydown(row.id, event)}
                    />
                  {:else}
                    <span class="friends-list-item__alias" style={`color:${row.heatmapColor};`}>{row.title}</span>
                  {/if}
                </div>
                <span class="friends-list-item__updated-at">{row.updatedAt ? `Updated at: ${formatDateTime(row.updatedAt)}` : 'Updated at: -'}</span>
                <span class="friends-list-item__code">{row.rosterCode}</span>
                <div class="friends-list-item__actions">
                  {#if editingAliasFriendId === row.id}
                    <button class="friends-list-item__alias-save" type="button" aria-label={`Save alias for ${row.title}`} on:click={() => onSaveEditingAlias(row.id)}>Save</button>
                    <button class="friends-list-item__alias-cancel" type="button" aria-label={`Cancel alias edit for ${row.title}`} on:click={onCancelEditingAlias}>Cancel</button>
                  {:else}
                    <button class="friends-list-item__alias-edit" type="button" aria-label={`Edit alias for ${row.title}`} on:click={() => onStartEditingAlias(row.id)}>
                      Alias
                    </button>
                  {/if}
                  <input
                    class="friends-list-item__color"
                    type="color"
                    value={row.heatmapColor}
                    aria-label={`Heatmap color for ${row.title}`}
                    on:input={(event) => onFriendColorInput(row.id, event)}
                    on:change={(event) => onFriendColorInput(row.id, event)}
                  />
                  <button class="friends-list-item__remove" type="button" aria-label={`Remove ${row.title}`} on:click={() => onRemoveFriend(row.id)}>
                    <span aria-hidden="true">🗑</span><span class="visually-hidden">Remove friend</span>
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </section>
    </div>
  </div>
</div>