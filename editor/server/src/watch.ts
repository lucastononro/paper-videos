import path from 'node:path';
import chokidar from 'chokidar';
import { VIDEOS_DIR } from './paths.js';
import { broadcastReload } from './ws.js';

/**
 * Watch each `videos/<slug>/{manifest.json, narration/*, manim/*, qa-report.json}`
 * for changes and emit a debounced `preview:reload` over WS so any open editor
 * view re-fetches data + remounts the player.
 *
 * Chokidar 4.x removed native glob support, so we watch `VIDEOS_DIR` recursively
 * and filter event paths manually. `awaitWriteFinish` prevents partial mp4
 * writes during a render from triggering a flood of reloads.
 */
export function startWatcher(): void {
  const watcher = chokidar.watch(VIDEOS_DIR, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    // Skip dotfiles (`.cache/`, `.DS_Store`, etc.) and the renderer's
    // intermediate `public/` mirror directory (we already track its sources).
    ignored: (p: string) => /[/\\]\.[^/\\]/.test(p) || /[/\\]public[/\\]/.test(p),
  });

  const pending = new Map<string, NodeJS.Timeout>();

  const trigger = (filepath: string) => {
    const slug = slugFromPath(filepath);
    if (!slug) return;
    if (!isInteresting(filepath)) return;
    const existing = pending.get(slug);
    if (existing) clearTimeout(existing);
    pending.set(
      slug,
      setTimeout(() => {
        pending.delete(slug);
        broadcastReload(slug);
      }, 600),
    );
  };

  for (const evt of ['add', 'change', 'unlink'] as const) {
    watcher.on(evt, trigger);
  }
  watcher.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[watcher] error', err);
  });
}

function slugFromPath(filepath: string): string | null {
  const rel = path.relative(VIDEOS_DIR, filepath);
  if (rel.startsWith('..')) return null;
  const first = rel.split(path.sep)[0];
  return first ?? null;
}

function isInteresting(filepath: string): boolean {
  const rel = path.relative(VIDEOS_DIR, filepath);
  // rel is like "<slug>/manifest.json" or "<slug>/narration/beat-005.mp3".
  const parts = rel.split(path.sep);
  if (parts.length < 2) return false;
  const tail = parts.slice(1).join('/');
  if (tail === 'manifest.json') return true;
  if (tail === 'qa-report.json') return true;
  if (parts[1] === 'narration') return true;
  if (parts[1] === 'manim' && tail.endsWith('.mp4')) return true;
  return false;
}
