#!/usr/bin/env tsx
/**
 * render-remotion — bundle the Remotion package and render a video's composition to mp4.
 *
 * Usage: npm run render-remotion -- <slug>
 *
 * Reads videos/<slug>/manifest.json (which the remotion-composer subagent must have written).
 * Output: videos/<slug>/output.mp4
 */

import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { readManifest, totalDurationFrames, videoOutputPath, videoPublicDir } from '../lib/manifest.js';
import { videoDir } from '../lib/paths.js';

const program = new Command()
  .name('render-remotion')
  .argument('<slug>')
  .option('--composition <id>', 'composition id to render', 'PaperExplainer')
  .option('--codec <c>', 'h264|h265|prores|vp8|vp9', 'h264')
  .option('--concurrency <n>', 'parallel frame renders', '4');

program.parse();
const opts = program.opts<{ composition: string; codec: string; concurrency: string }>();
const [slug] = program.args as [string];

const here = path.dirname(fileURLToPath(import.meta.url));
const remotionEntry = path.resolve(here, '..', 'remotion', 'index.ts');

const manifest = readManifest(slug);
if (manifest.segments.length === 0) {
  console.error(`Manifest has no segments for slug "${slug}". Run the narrator + remotion-composer pipeline first.`);
  process.exit(1);
}

// Symlink (or mirror) per-video assets into a stable public/ folder so the
// Remotion bundler can serve them via staticFile(). We use videos/<slug>/public.
mirrorVideoAssetsToPublic(slug);

console.log(`Bundling Remotion entry: ${remotionEntry}`);
const serveUrl = await bundle({
  entryPoint: remotionEntry,
  publicDir: videoPublicDir(slug),
  webpackOverride: (config) => config,
});

console.log(`Selecting composition "${opts.composition}" ...`);
const composition = await selectComposition({
  serveUrl,
  id: opts.composition,
  inputProps: { slug },
});

const expectedFrames = totalDurationFrames(manifest);
console.log(
  `Render plan: ${expectedFrames} frames @ ${manifest.fps}fps (${(expectedFrames / manifest.fps).toFixed(1)}s) at ${manifest.resolution.width}x${manifest.resolution.height}`,
);

const out = videoOutputPath(slug);
fs.mkdirSync(path.dirname(out), { recursive: true });

await renderMedia({
  composition,
  serveUrl,
  codec: opts.codec as 'h264',
  outputLocation: out,
  inputProps: { slug },
  concurrency: Number(opts.concurrency),
  onProgress: ({ progress }) => {
    process.stdout.write(`\rrendering ${(progress * 100).toFixed(1)}%   `);
  },
});
process.stdout.write('\n');

const stat = fs.statSync(out);
console.log(JSON.stringify({ slug, output: out, sizeBytes: stat.size, frames: expectedFrames }, null, 2));

// ---------------------------------------------------------------------------

function mirrorVideoAssetsToPublic(slug: string): void {
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
      // Copy if newer or missing
      if (!fs.existsSync(d) || fs.statSync(s).mtimeMs > fs.statSync(d).mtimeMs) {
        fs.copyFileSync(s, d);
      }
    }
  }

  // Also expose equations.json + timeline.json + assets-index.json
  for (const f of ['equations.json', 'timeline.json', 'assets-index.json']) {
    const s = path.join(dir, f);
    if (!fs.existsSync(s)) continue;
    fs.copyFileSync(s, path.join(pub, f));
  }
  // For manifest.json, write the v2-migrated form into public/ so the composition
  // consumes the new voice + visualBlocks schema directly without re-migrating.
  const v2 = readManifest(slug);
  fs.writeFileSync(path.join(pub, 'manifest.json'), JSON.stringify(v2, null, 2));

  // Probe Manim mp4 durations + extract last-frame PNGs so the composition can
  // (1) play each mp4 once across a multi-beat run, and (2) hold the final
  // frame for any remaining run time. Without this, consecutive beats sharing
  // one mp4 visibly restart it on every sentence boundary.
  const manimDir = path.join(dir, 'manim');
  if (fs.existsSync(manimDir)) {
    const m = readManifest(slug);
    const fps = m.fps;
    const durations: Record<string, number> = {};
    const lastFrames: Record<string, string> = {};
    const lastFramesDir = path.join(pub, 'manim-last-frames');
    fs.mkdirSync(lastFramesDir, { recursive: true });

    for (const f of fs.readdirSync(manimDir)) {
      if (!f.endsWith('.mp4')) continue;
      const abs = path.join(manimDir, f);

      // Probe duration
      try {
        const out = execFileSync(
          'ffprobe',
          ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', abs],
          { encoding: 'utf8' },
        ).trim();
        const seconds = Number(out);
        if (Number.isFinite(seconds) && seconds > 0) {
          durations[`manim/${f}`] = Math.max(1, Math.round(seconds * fps));
        }
      } catch {
        /* ffprobe missing or file unreadable — skip; composition will fall back */
      }

      // Extract last frame as PNG (for hold-last-frame after the mp4 ends)
      const pngName = f.replace(/\.mp4$/, '.png');
      const pngPath = path.join(lastFramesDir, pngName);
      const stale = !fs.existsSync(pngPath) || fs.statSync(abs).mtimeMs > fs.statSync(pngPath).mtimeMs;
      if (stale) {
        try {
          execFileSync(
            'ffmpeg',
            [
              '-y',
              '-sseof', '-0.1',
              '-i', abs,
              '-update', '1',
              '-frames:v', '1',
              '-q:v', '2',
              pngPath,
            ],
            { stdio: 'ignore' },
          );
        } catch {
          /* ffmpeg missing — composition will fall back to a black hold */
        }
      }
      if (fs.existsSync(pngPath)) {
        lastFrames[`manim/${f}`] = `manim-last-frames/${pngName}`;
      }
    }

    fs.writeFileSync(path.join(pub, 'manim-durations.json'), JSON.stringify(durations, null, 2));
    fs.writeFileSync(path.join(pub, 'manim-last-frames.json'), JSON.stringify(lastFrames, null, 2));
  }
}
