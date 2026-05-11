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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import {
  readManifest,
  totalDurationFrames,
  videoOutputPath,
  videoPublicDir,
} from '../lib/manifest.js';
import { preparePreview } from '../lib/prepare-preview.js';

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
  console.error(
    `Manifest has no segments for slug "${slug}". Run the narrator + remotion-composer pipeline first.`,
  );
  process.exit(1);
}

// Mirror per-video assets + probe Manim durations into the slug's public/
// folder so @remotion/bundler can serve them via staticFile(). The same
// function is reused by the live editor preview server.
preparePreview(slug);

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
console.log(
  JSON.stringify({ slug, output: out, sizeBytes: stat.size, frames: expectedFrames }, null, 2),
);
