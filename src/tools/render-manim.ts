#!/usr/bin/env tsx
/**
 * render-manim — render one Manim Community Edition scene to mp4.
 *
 * Usage:
 *   npm run render-manim -- <slug> <scene_relative_path> <ClassName> [--quality h|p|m|l|k]
 *
 * Reads:   videos/<slug>/manim/<scene_relative_path>     (a .py file)
 * Writes:  videos/<slug>/manim/<scene_basename>.mp4
 *
 * We invoke Manim via `uv run` (uses the project's pyproject.toml + lockfile).
 * Manim writes its own `media/` tree; we copy the resulting mp4 to the canonical name.
 */

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { videoDir, videoFile } from '../lib/paths.js';

const QUALITY_FLAGS: Record<string, { flag: string; subdir: string }> = {
  l: { flag: '-ql', subdir: '480p15' },
  m: { flag: '-qm', subdir: '720p30' },
  h: { flag: '-qh', subdir: '1080p60' },
  p: { flag: '-qp', subdir: '1440p60' },
  k: { flag: '-qk', subdir: '2160p60' },
};

const program = new Command()
  .name('render-manim')
  .argument('<slug>')
  .argument('<scenePath>', 'path relative to videos/<slug>/manim/, e.g. scene_004.py')
  .argument('<className>', 'Manim Scene class name to render')
  .option('--quality <q>', 'l|m|h|p|k', 'h')
  .option('--force', 'overwrite existing mp4', false);

program.parse();
const opts = program.opts<{ quality: string; force: boolean }>();
const [slug, scenePath, className] = program.args as [string, string, string];

const q = QUALITY_FLAGS[opts.quality];
if (!q) {
  console.error(`Unknown --quality "${opts.quality}". Use one of: ${Object.keys(QUALITY_FLAGS).join(', ')}`);
  process.exit(1);
}

const sceneAbs = path.resolve(videoFile(slug, 'manim', scenePath));
if (!fs.existsSync(sceneAbs)) {
  console.error(`Scene file not found: ${sceneAbs}`);
  process.exit(2);
}

const sceneStem = path.basename(scenePath, path.extname(scenePath));
const targetMp4 = videoFile(slug, 'manim', `${sceneStem}.mp4`);
if (fs.existsSync(targetMp4) && !opts.force) {
  console.log(`mp4 already exists: ${targetMp4}. Use --force to re-render.`);
  process.exit(0);
}

const cwd = videoDir(slug); // run inside the per-video dir so manim's media/ stays scoped

console.log(`Rendering ${className} from ${scenePath} (${q.flag}) ...`);
await runManim(cwd, sceneAbs, className, q.flag);

// Locate Manim's output: cwd/media/videos/<sceneStem>/<resolution>/<ClassName>.mp4
const mediaTree = path.join(cwd, 'media', 'videos', sceneStem, q.subdir, `${className}.mp4`);
if (!fs.existsSync(mediaTree)) {
  console.error(`Manim finished but mp4 not found at ${mediaTree}`);
  process.exit(3);
}
fs.copyFileSync(mediaTree, targetMp4);

console.log(JSON.stringify({ slug, scenePath, className, output: targetMp4 }, null, 2));

// ---------------------------------------------------------------------------

function runManim(cwd: string, sceneAbs: string, className: string, flag: string): Promise<void> {
  // Prepend TinyTeX (user-space TeX install at ~/Library/TinyTeX) to PATH so
  // Manim's MathTex pipeline can find latex / dvisvgm without sudo / system
  // install. Falls through cleanly if TinyTeX isn't installed (Manim will
  // surface the LaTeX-missing error).
  const tinyTexBin = path.join(process.env['HOME'] ?? '', 'Library/TinyTeX/bin/universal-darwin');
  const env = { ...process.env };
  if (fs.existsSync(tinyTexBin)) {
    env['PATH'] = `${tinyTexBin}:${env['PATH'] ?? ''}`;
  }
  return new Promise((resolve, reject) => {
    const proc = spawn('uv', ['run', 'manim', flag, sceneAbs, className], {
      cwd,
      stdio: 'inherit',
      env,
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`manim exited with code ${code}`));
    });
  });
}
