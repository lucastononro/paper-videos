#!/usr/bin/env tsx
/**
 * render-pages — render every page of videos/<slug>/paper.pdf as a PNG.
 *
 * Output: videos/<slug>/pages/page-001.png ...
 *
 * Uses pdfjs-dist (Node) + @napi-rs/canvas (no native build).
 */

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { videoFile, ensureSubdir } from '../lib/paths.js';
import { createCanvas } from '@napi-rs/canvas';

// pdfjs-dist legacy build is more compatible with Node CommonJS-y world.
const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');

const program = new Command()
  .name('render-pages')
  .argument('<slug>')
  .option('--scale <n>', 'scale factor passed to pdfjs viewport', '2')
  .option('--force', 'overwrite existing PNGs', false);

program.parse();
const opts = program.opts<{ scale: string; force: boolean }>();
const [slug] = program.args as [string];

const pdfPath = videoFile(slug, 'paper.pdf');
if (!fs.existsSync(pdfPath)) {
  console.error(`paper.pdf missing for slug "${slug}".`);
  process.exit(1);
}

const pagesDir = ensureSubdir(slug, 'pages');
const scale = Number(opts.scale);

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await pdfjs.getDocument({
  data,
  // Disable font/canvas validations that need DOM globals
  isEvalSupported: false,
  useSystemFonts: true,
}).promise;

const written: string[] = [];
for (let i = 1; i <= pdf.numPages; i++) {
  const out = path.join(pagesDir, `page-${String(i).padStart(3, '0')}.png`);
  if (fs.existsSync(out) && !opts.force) {
    written.push(out);
    continue;
  }
  const page = await pdf.getPage(i);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  written.push(out);
}

console.log(JSON.stringify({ slug, pageCount: pdf.numPages, files: written }, null, 2));
