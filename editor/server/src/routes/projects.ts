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
