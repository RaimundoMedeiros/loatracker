import App from './App.svelte';
import { mount } from 'svelte';
import { initSvelteErrorHandler, reportError } from './utils/errorHandler';
import { ERROR_CODES } from './utils/errorCodes';

function hideLegacyDom() {
  const selectors = [
    '.header',
    '#main-content',
    '#notifications',
    '#confirm-modal',
    '#settings-modal',
    '#notification-modal',
    '#loading-overlay',
    '#wizard-welcome-modal',
    '#wizard-database-modal',
    '#wizard-mathimoe-modal',
    '#wizard-preview-modal',
    '#howto-modal',
    '#db-guide-modal',
    '#column-settings-modal',
    '#friends-setup-modal',
    '#friends-heatmap-modal',
  ];

  selectors.forEach((selector) => {
    const node = document.querySelector(selector) as HTMLElement | null;
    if (node) {
      node.style.display = 'none';
    }
  });
}

export function bootstrapSvelteShell() {
  try {
    initSvelteErrorHandler();
    hideLegacyDom();

    let mountNode = document.getElementById('svelte-app-root');
    if (!mountNode) {
      mountNode = document.createElement('div');
      mountNode.id = 'svelte-app-root';
      document.body.appendChild(mountNode);
    }

    return mount(App, {
      target: mountNode,
    });
  } catch (error: unknown) {
    void reportError(error, {
      code: ERROR_CODES.APP.BOOTSTRAP_FAILED,
      severity: 'error',
      context: { phase: 'bootstrapSvelteShell' },
      showToast: true,
    });
    throw error;
  }
}
