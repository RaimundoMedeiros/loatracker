import { defineConfig } from 'vite';
import { resolve } from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  root: resolve(__dirname),
  base: './',
  publicDir: resolve(__dirname, 'public'),
  assetsInclude: ['**/*.wasm'],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['wa-sqlite'],
  },
  server: {
    proxy: {
      '/proxy/mathi': {
        target: 'https://uwowo.ychainstyle.workers.dev',
        changeOrigin: true,
        secure: true,
        headers: {
          Origin: 'https://raimundomedeiros.github.io',
          Referer: 'https://raimundomedeiros.github.io/weeklytracker/',
        },
      },
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});