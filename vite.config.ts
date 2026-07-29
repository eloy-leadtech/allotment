import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` is read from VITE_BASE so GitHub Pages can serve the game from a
// subdirectory (e.g. /allotment/). Defaults to '/' for local dev.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('./engine', import.meta.url)),
      '@game': fileURLToPath(new URL('./game', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
      '@ui': fileURLToPath(new URL('./ui', import.meta.url)),
      '@app': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
});
