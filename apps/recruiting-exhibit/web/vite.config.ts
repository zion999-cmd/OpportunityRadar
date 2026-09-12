// Vite config for the POC-SURFACE-01 magazine Surface.
//
// The web source lives in this directory; the production
// bundle is emitted into the sibling static/ directory that
// the exhibit HTTP server (../server.ts) already serves.
// Keeping the build root inside web/ means the hand-written
// build config does not touch the rest of the repository.
//
// Dev mode (`npm run recruiting-exhibit:dev`) serves the UI
// on 5173 and proxies /api to the exhibit server on 4173,
// which must be started separately (`npm run
// recruiting-exhibit` builds first, so the normal flow does
// not need dev mode at all).

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const webRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: webRoot,
  build: {
    outDir: resolve(webRoot, '..', 'static'),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4173',
    },
  },
});
