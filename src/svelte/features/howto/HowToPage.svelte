<script lang="ts">
  function requestModalClose() {
    window.dispatchEvent(new CustomEvent('wtl-close-modal'));
  }
</script>

<section id="howto-tab">
  <h2 id="howto-title">How To Use</h2>
  <p class="howto-subtitle">Quick guide for Setup, Weekly Tracker, and Roster Management.</p>

  <section class="howto-section" aria-labelledby="howto-setup-title-svelte">
    <h3 id="howto-setup-title-svelte">Setup</h3>
    <ul>
      <li>Drag and drop <strong>encounters.db</strong> into the Database section.</li>
      <li>When the browser asks for file permission, allow it. This permission is essential for the app to work correctly.</li>
      <li>Check <strong>Permission state</strong>: ideally it should show <strong>granted</strong>.</li>
      <li>Use <strong>How to find encounters.db?</strong> to watch the video showing the exact file location in LOA Logs.</li>
      <li><strong>Auto-update Raids</strong> runs the same flow as the Weekly Tracker <strong>Load Raids</strong> button whenever the app regains focus.</li>
      <li>In web mode, this automation is still being tested and can have limitations compared to the installed app.</li>
    </ul>
  </section>

  <section class="howto-section" aria-labelledby="howto-weekly-title-svelte">
    <h3 id="howto-weekly-title-svelte">Weekly Tracker</h3>
    <div class="howto-image-slot" aria-label="Weekly Tracker roster controls">
      <img src="assets/guide/howto/weekly-roster-controls.png" alt="Weekly Tracker roster controls: selector, visibility, add, rename and delete roster" class="howto-guide-image" loading="lazy" />
    </div>
    <ul>
      <li>At the top of Main Roster, you can switch rosters, show multiple rosters at once (eye), add, rename, and delete rosters.</li>
      <li>The <strong>Field Boss</strong> and <strong>Chaos Gate</strong> buttons may not always be fully accurate because LOA Logs does not always save that data correctly in the database.</li>
    </ul>

    <div class="howto-image-slot" aria-label="Weekly Tracker action buttons">
      <img src="assets/guide/howto/weekly-actions.png" alt="Weekly Tracker action buttons: gear, load raids and reset raids" class="howto-guide-image" loading="lazy" />
    </div>
    <ul>
      <li>The <strong>gear</strong> opens column selection for what you want to display in the tracker.</li>
      <li><strong>Load Raids</strong> fetches raid information from the database.</li>
      <li>You can automate this using the <strong>Auto-update</strong> timer in Settings.</li>
      <li><strong>Reset Raids</strong> clears raid tracker data.</li>
    </ul>

    <div class="howto-image-slot" aria-label="Raid cell controls">
      <img src="assets/guide/howto/raid-cell-controls.png" alt="Raid cell controls: chest, eye, difficulty toggle and check mark" class="howto-guide-image" loading="lazy" />
    </div>
    <ul>
      <li>The <strong>chest</strong> means you collected the chest; when checked, chest value is deducted from character gold.</li>
      <li>The <strong>eye</strong> hides the raid cell if the character did that content but should not count gold/reward.</li>
      <li>The <strong>difficulty toggle</strong> switches the difficulty used for that raid.</li>
      <li>On the <strong>check mark</strong>, if it was set by Load Raids/Auto-update, hover to see a tooltip with clear date/time.</li>
      <li>Character rows in Weekly Tracker are draggable (reorderable).</li>
    </ul>
  </section>

  <section class="howto-section" aria-labelledby="howto-roster-title-svelte">
    <h3 id="howto-roster-title-svelte">Roster Management</h3>
    <div class="howto-image-slot" aria-label="Roster management buttons">
      <img src="assets/guide/howto/roster-buttons.png" alt="Roster Management buttons: Sort, Refresh, Manual and Bible" class="howto-guide-image howto-guide-image--full" loading="lazy" />
    </div>
    <ul>
      <li><strong>Sort</strong> lets you organize your roster by CP, iLvl, or manually.</li>
      <li>The <strong>Manual</strong> button lets you add a character manually.</li>
      <li>The <strong>Bible</strong> button lets you fetch a character from the Bible API whenever you want.</li>
      <li><strong>Refresh</strong> updates roster iLvl/CP using Bible data.</li>
    </ul>

    <div class="howto-image-slot" aria-label="Roster card actions">
      <img src="assets/guide/howto/roster-card-actions.png" alt="Character card actions: Hide in Weekly, Edit and Delete" class="howto-guide-image" loading="lazy" />
    </div>
    <ul>
      <li><strong>Edit</strong> lets you manually edit name, class, iLvl, and Combat Power.</li>
      <li><strong>Hide in Weekly</strong> makes the character invisible in Weekly Tracker.</li>
      <li><strong>Delete</strong> removes the character.</li>
    </ul>
  </section>

  <div class="howto-actions">
    <button type="button" on:click={requestModalClose}>Got it</button>
  </div>
</section>
