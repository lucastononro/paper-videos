import express, { type Request, type Response } from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { slugDir } from '../paths.js';

const execFileAsync = promisify(execFile);

export const thumbRouter = express.Router();

const THUMB_W = 480;
const THUMB_H = 270;
const inFlight = new Map<string, Promise<string | null>>();

thumbRouter.get('/:slug/thumb.png', async (req: Request, res: Response) => {
  const slug = req.params['slug']!;
  const dir = slugDir(slug);
  if (!fs.existsSync(dir)) {
    res.status(404).end();
    return;
  }
  try {
    const cachePath = await ensureThumb(slug);
    if (!cachePath) {
      // Fallback to a generated SVG placeholder.
      res.type('svg').send(placeholderSvg(slug));
      return;
    }
    res.sendFile(cachePath);
  } catch (err) {
    res.type('svg').send(placeholderSvg(slug, (err as Error).message));
  }
});

async function ensureThumb(slug: string): Promise<string | null> {
  // Coalesce concurrent requests for the same slug.
  const cached = inFlight.get(slug);
  if (cached) return cached;
  const promise = (async (): Promise<string | null> => {
    const dir = slugDir(slug);
    const cacheDir = path.join(dir, '.cache');
    const cachePath = path.join(cacheDir, 'thumb.png');

    const outputMp4 = path.join(dir, 'output.mp4');
    const fallbackPng = path.join(dir, 'pages', 'page-001.png');

    // Determine the source and its mtime.
    let source: string | null = null;
    if (fs.existsSync(outputMp4)) source = outputMp4;
    else if (fs.existsSync(fallbackPng)) source = fallbackPng;
    if (!source) return null;

    const sourceMtime = fs.statSync(source).mtimeMs;
    if (
      fs.existsSync(cachePath) &&
      fs.statSync(cachePath).mtimeMs >= sourceMtime
    ) {
      return cachePath;
    }

    fs.mkdirSync(cacheDir, { recursive: true });

    if (source.endsWith('.mp4')) {
      // Extract a frame at 2s, then scale to THUMB_W x THUMB_H.
      await execFileAsync('ffmpeg', [
        '-y',
        '-loglevel', 'error',
        '-ss', '00:00:02',
        '-i', source,
        '-frames:v', '1',
        '-vf', `scale=${THUMB_W}:${THUMB_H}:force_original_aspect_ratio=decrease,pad=${THUMB_W}:${THUMB_H}:(ow-iw)/2:(oh-ih)/2:color=#0e1117`,
        cachePath,
      ]);
    } else {
      // Resize the page PNG.
      await execFileAsync('ffmpeg', [
        '-y',
        '-loglevel', 'error',
        '-i', source,
        '-vf', `scale=${THUMB_W}:${THUMB_H}:force_original_aspect_ratio=decrease,pad=${THUMB_W}:${THUMB_H}:(ow-iw)/2:(oh-ih)/2:color=#0e1117`,
        cachePath,
      ]);
    }
    return fs.existsSync(cachePath) ? cachePath : null;
  })().finally(() => inFlight.delete(slug));
  inFlight.set(slug, promise);
  return promise;
}

function placeholderSvg(slug: string, hint?: string): string {
  const text = slug.replace(/[<>&]/g, '');
  const sub = hint ? hint.slice(0, 60).replace(/[<>&]/g, '') : 'no preview yet';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${THUMB_W} ${THUMB_H}" width="${THUMB_W}" height="${THUMB_H}">
    <rect width="100%" height="100%" fill="#0e1117"/>
    <text x="50%" y="46%" fill="#e6edf3" font-family="Inter, system-ui, sans-serif" font-size="22" text-anchor="middle">${text}</text>
    <text x="50%" y="62%" fill="#8b949e" font-family="Inter, system-ui, sans-serif" font-size="13" text-anchor="middle">${sub}</text>
  </svg>`;
}
