import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { VIDEOS_DIR, slugDir } from '../paths.js';
import { readManifest, totalDurationFrames } from '../../../../src/lib/manifest.js';
import { inFlightSnapshot } from '../ws.js';

export const projectsRouter = express.Router();

projectsRouter.get('/', (_req: Request, res: Response) => {
  if (!fs.existsSync(VIDEOS_DIR)) {
    res.json({ projects: [] });
    return;
  }
  const inFlight = inFlightSnapshot();
  const projects = fs
    .readdirSync(VIDEOS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(VIDEOS_DIR, name, 'manifest.json')))
    .map((slug) => {
      try {
        const manifest = readManifest(slug);
        const total = totalDurationFrames(manifest);
        const outputMp4 = path.join(VIDEOS_DIR, slug, 'output.mp4');
        const hasOutputMp4 = fs.existsSync(outputMp4);
        const lastModified = (() => {
          const stats = [
            path.join(VIDEOS_DIR, slug, 'manifest.json'),
            outputMp4,
          ]
            .filter(fs.existsSync)
            .map((p) => fs.statSync(p).mtimeMs);
          return stats.length > 0 ? Math.max(...stats) : 0;
        })();
        return {
          slug,
          paperTitle: manifest.paperTitle,
          fps: manifest.fps,
          resolution: manifest.resolution,
          totalFrames: total,
          totalSeconds: total / manifest.fps,
          voiceBeats: manifest.voice.length,
          visualBlocks: manifest.visualBlocks.length,
          hasOutputMp4,
          lastModified,
          inFlight: inFlight.has(slug),
        };
      } catch (err) {
        return { slug, error: (err as Error).message, inFlight: inFlight.has(slug) };
      }
    })
    .sort((a, b) => {
      const am = 'lastModified' in a ? (a.lastModified ?? 0) : 0;
      const bm = 'lastModified' in b ? (b.lastModified ?? 0) : 0;
      return bm - am;
    });
  res.json({ projects });
});

projectsRouter.get('/:slug/manifest', (req: Request, res: Response) => {
  const slug = req.params['slug']!;
  if (!fs.existsSync(slugDir(slug))) {
    res.status(404).json({ error: `slug "${slug}" not found` });
    return;
  }
  try {
    const manifest = readManifest(slug);
    res.json({
      ...manifest,
      totalFrames: totalDurationFrames(manifest),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /api/projects/:slug — remove the entire video folder and any chat
 * history persisted under videos/<slug>/.cache. This is irreversible; the
 * client gates it behind a confirm dialog so it's never a one-misclick away.
 *
 * Validates the slug shape to make absolutely sure we don't escape VIDEOS_DIR
 * (path-traversal defence). Empty trim AND `..`/`/` are rejected.
 */
projectsRouter.delete('/:slug', (req: Request, res: Response) => {
  const slug = String(req.params['slug'] ?? '').trim();
  if (!slug || slug.includes('/') || slug.includes('..') || slug.startsWith('.')) {
    res.status(400).json({ error: 'invalid slug' });
    return;
  }
  const dir = path.join(VIDEOS_DIR, slug);
  // Resolve+normalize to verify the target stays under VIDEOS_DIR even if a
  // weird slug somehow slipped past the validation above.
  const resolved = path.resolve(dir);
  const root = path.resolve(VIDEOS_DIR);
  if (!resolved.startsWith(root + path.sep)) {
    res.status(400).json({ error: 'slug escapes videos dir' });
    return;
  }
  if (!fs.existsSync(resolved)) {
    res.status(404).json({ error: `slug "${slug}" not found` });
    return;
  }
  try {
    fs.rmSync(resolved, { recursive: true, force: true });
    res.json({ slug, deleted: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
