import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { videoDir } from './paths.js';
import { readManifest, videoPublicDir } from './manifest.js';

/**
 * Mirror per-video assets into the slug's `public/` directory and probe Manim
 * mp4 durations + extract last-frame PNGs. After this runs, the directory is
 * ready to be served as a Remotion staticFile root — both for full mp4 renders
 * (`@remotion/bundler` reads it) and for the live editor preview (the editor
 * server static-serves it under `/static/<slug>/`).
 *
 * Idempotent. Re-copies only stale files (mtime-based).
 */
export function preparePreview(slug: string): void {
  const dir = videoDir(slug);
  const pub = videoPublicDir(slug);
  fs.mkdirSync(pub, { recursive: true });

  const subdirs = ['pages', 'narration', 'manim', 'images', 'diagrams'];
  for (const sub of subdirs) {
    const src = path.join(dir, sub);
    const dst = path.join(pub, sub);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      const s = path.join(src, f);
      const d = path.join(dst, f);
      if (!fs.statSync(s).isFile()) continue;
      if (!fs.existsSync(d) || fs.statSync(s).mtimeMs > fs.statSync(d).mtimeMs) {
        fs.copyFileSync(s, d);
      }
    }
  }

  // Sidecar JSONs the composition reads. We always write SOMETHING (even an
  // empty default) so the editor's `/static/<slug>/<sidecar>.json` fetches
  // never 404 for a freshly-scaffolded project — keeps the dev console clean
  // and lets the composition treat them as plain empty data.
  const sidecarDefaults: Record<string, unknown> = {
    'equations.json': [],
    'assets-index.json': {},
    'timeline.json': {},
  };
  for (const [f, fallback] of Object.entries(sidecarDefaults)) {
    const s = path.join(dir, f);
    const dst = path.join(pub, f);
    if (fs.existsSync(s)) {
      fs.copyFileSync(s, dst);
    } else if (!fs.existsSync(dst)) {
      fs.writeFileSync(dst, JSON.stringify(fallback, null, 2));
    }
  }

  // Persist the v2-migrated manifest so the composition consumes voice +
  // visualBlocks directly without re-migrating.
  const v2 = readManifest(slug);
  fs.writeFileSync(path.join(pub, 'manifest.json'), JSON.stringify(v2, null, 2));

  // Probe Manim mp4 durations + extract last-frame PNGs so the composition can
  // (1) play each mp4 once across a multi-beat run, and (2) hold the final
  // frame for any remaining run time. Always emit `manim-durations.json` and
  // `manim-last-frames.json` (even empty `{}`) so the editor's static fetches
  // don't 404 for projects without rendered Manim scenes.
  const durationsPath = path.join(pub, 'manim-durations.json');
  const lastFramesPath = path.join(pub, 'manim-last-frames.json');
  const manimDir = path.join(dir, 'manim');
  if (fs.existsSync(manimDir)) {
    const fps = v2.fps;
    const durations: Record<string, number> = {};
    const lastFrames: Record<string, string> = {};
    const lastFramesDir = path.join(pub, 'manim-last-frames');
    fs.mkdirSync(lastFramesDir, { recursive: true });

    for (const f of fs.readdirSync(manimDir)) {
      if (!f.endsWith('.mp4')) continue;
      const abs = path.join(manimDir, f);

      try {
        const out = execFileSync(
          'ffprobe',
          [
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            abs,
          ],
          { encoding: 'utf8' },
        ).trim();
        const seconds = Number(out);
        if (Number.isFinite(seconds) && seconds > 0) {
          durations[`manim/${f}`] = Math.max(1, Math.round(seconds * fps));
        }
      } catch {
        /* ffprobe missing — composition falls back to block-frames. */
      }

      const pngName = f.replace(/\.mp4$/, '.png');
      const pngPath = path.join(lastFramesDir, pngName);
      const stale =
        !fs.existsSync(pngPath) || fs.statSync(abs).mtimeMs > fs.statSync(pngPath).mtimeMs;
      if (stale) {
        try {
          execFileSync(
            'ffmpeg',
            [
              '-y',
              '-sseof',
              '-0.1',
              '-i',
              abs,
              '-update',
              '1',
              '-frames:v',
              '1',
              '-q:v',
              '2',
              pngPath,
            ],
            { stdio: 'ignore' },
          );
        } catch {
          /* ffmpeg missing — composition falls back to a black hold. */
        }
      }
      if (fs.existsSync(pngPath)) {
        lastFrames[`manim/${f}`] = `manim-last-frames/${pngName}`;
      }
    }

    fs.writeFileSync(durationsPath, JSON.stringify(durations, null, 2));
    fs.writeFileSync(lastFramesPath, JSON.stringify(lastFrames, null, 2));
  } else {
    // No manim/ directory — write empty JSONs so the editor's static fetches
    // don't 404 against /static/<slug>/manim-durations.json etc.
    if (!fs.existsSync(durationsPath)) fs.writeFileSync(durationsPath, '{}');
    if (!fs.existsSync(lastFramesPath)) fs.writeFileSync(lastFramesPath, '{}');
  }
}
