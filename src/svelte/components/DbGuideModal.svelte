<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();

  let useGifFallback = false;
  let videoEl: HTMLVideoElement | null = null;

  const DB_GUIDE_WEBM = 'assets/guide/find-encounters.webm';
  const DB_GUIDE_GIF = 'assets/guide/find-encounters.gif';

  $: if (!open && videoEl) {
    videoEl.pause();
    videoEl.currentTime = 0;
    useGifFallback = false;
  }

  function close() {
    dispatch('close');
  }

  function onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function onOverlayKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      close();
    }
  }

  function onVideoError() {
    useGifFallback = true;
  }

  function onVideoMount() {
    if (!videoEl) return;
    const canPlayWebm = videoEl.canPlayType('video/webm') !== '';
    if (!canPlayWebm) {
      useGifFallback = true;
    }
  }
</script>

{#if open}
  <div
    id="db-guide-modal"
    class="db-guide-modal"
    style="display: flex;"
    role="dialog"
    aria-modal="true"
    aria-labelledby="db-guide-title"
    tabindex="0"
    on:click={onOverlayClick}
    on:keydown={onOverlayKeyDown}
  >
    <div class="modal-overlay"></div>
    <div class="modal-content db-guide-content" role="document">
      <button id="db-guide-close" class="close-btn" aria-label="Close database guide" on:click={close}>×</button>
      <h2 id="db-guide-title">How to find encounters.db</h2>
      <p class="db-guide-subtitle">Quick steps in LOA Logs:</p>

      <ol class="db-guide-steps" aria-label="Steps to open the encounters.db folder in LOA Logs">
        <li>Open <strong>LOA Logs</strong>.</li>
        <li>Go to <strong>Settings</strong>.</li>
        <li>Open <strong>Database</strong>.</li>
        <li>Click <strong>Database Folder - Open</strong>.</li>
        <li>Drag <strong>encounters.db</strong> into this app.</li>
      </ol>

      <div class="db-guide-media-wrap">
        {#if !useGifFallback}
          <video
            id="db-guide-video"
            class="db-guide-video"
            bind:this={videoEl}
            playsinline
            autoplay
            muted
            loop
            controls
            preload="none"
            poster={DB_GUIDE_GIF}
            on:error={onVideoError}
            on:loadedmetadata={onVideoMount}
          >
            <source id="db-guide-webm-source" src={DB_GUIDE_WEBM} data-src={DB_GUIDE_WEBM} type="video/webm" />
            Your browser does not support video playback.
          </video>
        {:else}
          <img id="db-guide-gif-fallback" class="db-guide-gif" src={DB_GUIDE_GIF} data-src={DB_GUIDE_GIF} alt="Guide showing where to find encounters.db" />
        {/if}
      </div>

      <div class="db-guide-actions">
        <button id="db-guide-got-it" type="button" on:click={close}>Got it</button>
      </div>
    </div>
  </div>
{/if}
