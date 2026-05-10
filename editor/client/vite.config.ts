import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@composition': path.join(repoRoot, 'src', 'remotion'),
      '@lib': path.join(repoRoot, 'src', 'lib'),
    },
  },
  server: {
    port: 5173,
    fs: {
      // Allow Vite to serve files from the repo root (we import from src/remotion).
      allow: [repoRoot],
    },
    proxy: {
      // 127.0.0.1 (not 'localhost') — Node 20+'s DNS resolves localhost to
      // `::1` first on macOS, which would AggregateError ECONNREFUSED if the
      // server bound to v4 only. Server is pinned to 127.0.0.1 too — see
      // editor/server/src/index.ts.
      '/api': { target: 'http://127.0.0.1:5174', changeOrigin: true },
      '/static': { target: 'http://127.0.0.1:5174', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:5174', ws: true, changeOrigin: true },
    },
  },
});
