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
      '/api': { target: 'http://localhost:5174', changeOrigin: true },
      '/static': { target: 'http://localhost:5174', changeOrigin: true },
      '/ws': { target: 'ws://localhost:5174', ws: true, changeOrigin: true },
    },
  },
});
