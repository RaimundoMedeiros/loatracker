<script lang="ts">
  import WizardPage from '../wizard/WizardPage.svelte';
  import SettingsHeader from './SettingsHeader.svelte';

  function navigateToRosters() {
    window.location.hash = 'settings/rosters';
  }
</script>

<SettingsHeader title="Tracker Integration" hint="Import your roster using the Bible API or add characters manually." />

<div class="tracker-wizard-wrap">
  <WizardPage onRequestClose={() => undefined} onNavigateToRoster={navigateToRosters} />
</div>

<style>
  .tracker-wizard-wrap {
    background: color-mix(in srgb, var(--color-surface-light) 92%, var(--color-surface));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
  }

  .tracker-wizard-wrap :global(.close-btn) {
    display: none;
  }

  .tracker-wizard-wrap :global(#wizard-tab .form-group) {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
  }

  .tracker-wizard-wrap :global(#wizard-tab .form-row) {
    display: flex;
    gap: var(--spacing-md);
    align-items: flex-end;
    margin-bottom: var(--spacing-md);
    flex-wrap: wrap;
  }

  .tracker-wizard-wrap :global(#wizard-tab .form-row .form-group) {
    margin-bottom: 0;
  }

  .tracker-wizard-wrap :global(#wizard-tab .wizard-mathimoe-row) {
    display: grid;
    grid-template-columns: 7fr 3fr;
    gap: var(--spacing-md);
    align-items: flex-end;
    margin-bottom: var(--spacing-md);
  }

  .tracker-wizard-wrap :global(#wizard-tab .wizard-mathimoe-row .form-group) {
    margin-bottom: 0;
  }

  .tracker-wizard-wrap :global(#wizard-tab .wizard-mathimoe-row .form-group-name),
  .tracker-wizard-wrap :global(#wizard-tab .wizard-mathimoe-row .form-group-region) {
    min-width: 0;
  }

  .tracker-wizard-wrap :global(#wizard-tab .form-group label) {
    color: var(--color-text);
    font-weight: 600;
    font-size: 0.95rem;
  }

  .tracker-wizard-wrap :global(#wizard-tab .form-group input),
  .tracker-wizard-wrap :global(#wizard-tab .form-group select) {
    width: 100%;
    padding: 12px 14px;
    background: var(--color-bg-dark);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: 1rem;
    margin: var(--spacing-sm) 0 var(--spacing-lg) 0;
    transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
  }

  .tracker-wizard-wrap :global(#wizard-tab .form-group select) {
    appearance: none;
    cursor: pointer;
  }

  @media (max-width: 640px) {
    .tracker-wizard-wrap :global(#wizard-tab .wizard-mathimoe-row) {
      grid-template-columns: 1fr;
    }
  }
</style>
