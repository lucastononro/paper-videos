import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

// Ports are dynamically allocated by run.sh and passed as env vars.
// Defaults match the legacy hardcoded values for standalone `npm run editor:dev`.
const SERVER_PORT = Number(process.env.EDITOR_SERVER_PORT || 5174);
const CLIENT_PORT = Number(process.env.EDITOR_CLIENT_PORT || 5173);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@composition': path.join(repoRoot, 'src', 'remotion'),
      '@lib': path.join(repoRoot, 'src', 'lib'),
    },
  },
  server: {
    port: CLIENT_PORT,
    fs: {
      // Allow Vite to serve files from the repo root (we import from src/remotion).
      allow: [repoRoot],
    },
    proxy: {
      // 127.0.0.1 (not 'localhost') — Node 20+'s DNS resolves localhost to
      // `::1` first on macOS, which would AggregateError ECONNREFUSED if the
      // server bound to v4 only. Server is pinned to 127.0.0.1 too — see
      // editor/server/src/index.ts.
      '/api': { target: `http://127.0.0.1:${SERVER_PORT}`, changeOrigin: true },
      '/static': { target: `http://127.0.0.1:${SERVER_PORT}`, changeOrigin: true },
      '/ws': { target: `ws://127.0.0.1:${SERVER_PORT}`, ws: true, changeOrigin: true },
    },
  },
});
