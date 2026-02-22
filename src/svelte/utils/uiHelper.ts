import { CSS_CLASSES, DOM_IDS, MESSAGES, TIMINGS, TOAST_TYPES } from '../legacy/config/constants.js';

type ToastClick = (() => void) | null;

export class UIHelper {
  private loadingOverlay: HTMLElement | null;
  private loadingText: HTMLElement | null;

  constructor() {
    this.loadingOverlay = document.getElementById(DOM_IDS.CONTAINERS.LOADING_OVERLAY);
    this.loadingText = this.loadingOverlay?.querySelector(`.${CSS_CLASSES.LOADING_TEXT}`) as HTMLElement | null;
    (window as Window & { UIHelper?: UIHelper }).UIHelper = this;
    ensureUiHelperAnimations();
  }

  showLoading(message = MESSAGES.INFO.LOADING): void {
    if (!this.loadingOverlay) return;
    if (this.loadingText) {
      this.loadingText.textContent = message;
    }
    this.loadingOverlay.classList.add('active');
  }

  hideLoading(): void {
    if (!this.loadingOverlay) return;
    this.loadingOverlay.classList.remove('active');
  }

  setButtonLoading(button: HTMLButtonElement, loading = true): void {
    if (loading) {
      button.disabled = true;
      button.dataset.originalText = button.textContent || '';
      button.textContent = `⏳ ${MESSAGES.INFO.LOADING}`;
      button.style.opacity = '0.6';
      return;
    }

    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
    button.style.opacity = '1';
  }

  showSuccess(): void {
    const existing = document.querySelector('.success-check');
    if (existing) existing.remove();

    const check = document.createElement('div');
    check.className = 'success-check';
    check.innerHTML = '✓';
    document.body.appendChild(check);

    setTimeout(() => check.remove(), TIMINGS.TOAST_SHORT);
  }

  showToast(message: string, type: string = TOAST_TYPES.INFO, duration = TIMINGS.TOAST_DEFAULT, onClick: ToastClick = null): void {
    const existingToasts = document.querySelectorAll(`.${CSS_CLASSES.TOAST}`);
    existingToasts.forEach((toast) => toast.remove());

    let container = document.querySelector(`.${CSS_CLASSES.TOAST_CONTAINER}`) as HTMLElement | null;
    if (!container) {
      container = document.createElement('div');
      container.className = CSS_CLASSES.TOAST_CONTAINER;
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `${CSS_CLASSES.TOAST} ${type}`;
    toast.textContent = message;

    if (onClick) {
      toast.style.cursor = 'pointer';
      toast.style.userSelect = 'none';
      toast.addEventListener('click', () => {
        onClick();
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), TIMINGS.ANIMATION_SHORT);
      });
      toast.title = 'Click to open';
    }

    container.appendChild(toast);
    this.announceToScreenReader(message);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), TIMINGS.ANIMATION_SHORT);
    }, duration);
  }

  announceToScreenReader(message: string): void {
    const liveRegion = document.getElementById('notifications');
    if (!liveRegion) return;

    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion.textContent = message;
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }, 100);
  }

  pulse(element: HTMLElement): void {
    element.style.animation = 'pulse 0.5s ease';
    setTimeout(() => {
      element.style.animation = '';
    }, TIMINGS.ANIMATION_MEDIUM);
  }

  shake(element: HTMLElement): void {
    element.style.animation = 'shake 0.5s ease';
    setTimeout(() => {
      element.style.animation = '';
    }, TIMINGS.ANIMATION_MEDIUM);
  }

  highlight(element: HTMLElement, duration = 1000): void {
    const originalBackground = element.style.backgroundColor;
    element.style.transition = 'background-color 0.3s ease';
    element.style.backgroundColor = '#d4af3733';

    setTimeout(() => {
      element.style.backgroundColor = originalBackground;
    }, duration);
  }

  showInlineLoading(element: HTMLElement): void {
    const originalContent = element.innerHTML;
    element.dataset.originalContent = originalContent;
    element.innerHTML = '<div class="skeleton skeleton-text"></div>';
  }

  hideInlineLoading(element: HTMLElement): void {
    if (!element.dataset.originalContent) return;
    element.innerHTML = element.dataset.originalContent;
    delete element.dataset.originalContent;
  }
}

function ensureUiHelperAnimations() {
  const STYLE_ID = 'wtl-uihelper-animations';
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
  `;

  document.head.appendChild(style);
}
