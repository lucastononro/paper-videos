import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { slugDir } from '../paths.js';

export const filesRouter = express.Router();

/** Hidden files / heavy mirrors the user almost never wants to see. */
const HIDE_NAMES = new Set(['.DS_Store', '.cache']);
/** Folders we hide from the listing — they're internal. */
const HIDE_DIRS = new Set(['public']);

/**
 * `GET /api/projects/:slug/files?path=<rel>`
 * → `{ entries: Array<{name, path, isDir, size, mtime, mime}> }`
 *
 * The Assets tab walks this directory structure to render its file tree.
 * `path` is relative to videos/<slug>/ (default `''` = the slug root).
 */
filesRouter.get('/:slug/files', (req: Request, res: Response) => {
  const slug = req.params['slug']!;
  const rel = String(req.query['path'] ?? '');
  const root = slugDir(slug);
  if (!fs.existsSync(root)) {
    res.status(404).json({ error: `slug "${slug}" not found` });
    return;
  }
  const abs = path.resolve(root, rel);
  if (!isInside(root, abs)) {
    res.status(403).json({ error: 'path traversal' });
    return;
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    res.json({ entries: [] });
    return;
  }
  const entries = fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((d) => !HIDE_NAMES.has(d.name) && !(d.isDirectory() && HIDE_DIRS.has(d.name)))
    .map((d) => {
      const childAbs = path.join(abs, d.name);
      const stat = fs.statSync(childAbs);
      const childRel = path.relative(root, childAbs);
      return {
        name: d.name,
        path: childRel,
        isDir: d.isDirectory(),
        size: d.isDirectory() ? 0 : stat.size,
        mtime: stat.mtimeMs,
        mime: d.isDirectory() ? null : guessMime(d.name),
      };
    })
    .sort((a, b) =>
      a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
    );
  res.json({ entries });
});

/**
 * `GET /api/projects/:slug/file?path=<rel>` — raw file content.
 *
 * For text files we add `Content-Type: text/plain; charset=utf-8` and stream
 * the body; the client decides how to render (markdown / json / code). For
 * binary (image / pdf / audio / video), express's sendFile picks the type.
 */
filesRouter.get('/:slug/file', (req: Request, res: Response) => {
  const slug = req.params['slug']!;
  const rel = String(req.query['path'] ?? '');
  const root = slugDir(slug);
  const abs = path.resolve(root, rel);
  if (!isInside(root, abs) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    res.status(404).end();
    return;
  }
  // Cap reads to 4MB for safety (large logs, images stream anyway via sendFile).
  res.sendFile(abs, { maxAge: 0 });
});

function isInside(root: string, target: string): boolean {
  const r = path.resolve(root) + path.sep;
  const t = path.resolve(target);
  return t === path.resolve(root) || t.startsWith(r);
}

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'text/yaml';
  if (lower.endsWith('.py')) return 'text/x-python';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'text/typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'text/javascript';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.html')) return 'text/html';
  if (lower.endsWith('.txt') || lower.endsWith('.log')) return 'text/plain';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'application/octet-stream';
}
