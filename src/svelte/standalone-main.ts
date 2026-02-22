import './legacy/styles/index.css';
import '../browserApi.ts';
import { bootstrapSvelteShell } from './main';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch((err) => {
    console.warn('Service worker registration failed', err);
  });
}

bootstrapSvelteShell();
