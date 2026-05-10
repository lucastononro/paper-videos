#!/usr/bin/env tsx
/**
 * overlay-bbox — visual verification for the bbox resolver.
 *
 * Loads videos/<slug>/pages/page-NNN.png and draws a red rectangle on top of
 * the resolved bbox region. Output: experiments/highlights/out/<slug>-p<N>-<label>.png
 *
 * Usage:
 *   npx tsx experiments/highlights/overlay-bbox.ts <slug> <pageNum> <quote...>
 *   npx tsx experiments/highlights/overlay-bbox.ts <slug> <pageNum> --bbox <x,y,w,h>
 */

import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { resolveBBox } from './resolve-bbox.ts';

const REPO = path.resolve(import.meta.dirname, '..', '..');

type BBox = { x: number; y: number; w: number; h: number };

async function overlay(slug: string, pageNum: number, label: string, bbox: BBox): Promise<string> {
  const pageStem = String(pageNum).padStart(3, '0');
  const pngIn = path.join(REPO, 'videos', slug, 'pages', `page-${pageStem}.png`);
  if (!fs.existsSync(pngIn)) throw new Error(`page PNG missing: ${pngIn}`);
  const img = await loadImage(pngIn);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  // Draw the bbox: red border + 30% red fill so we can see the area covered.
  const x = bbox.x * img.width;
  const y = bbox.y * img.height;
  const w = bbox.w * img.width;
  const h = bbox.h * img.height;
  ctx.fillStyle = 'rgba(255, 64, 64, 0.18)';
  ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 32, 32, 0.95)';
  ctx.strokeRect(x, y, w, h);
  // Tag the corner with the label so multiple overlays are distinguishable.
  ctx.fillStyle = 'rgba(255, 32, 32, 0.95)';
  ctx.font = '20px sans-serif';
  ctx.fillText(label, x + 4, Math.max(16, y - 6));
  const outDir = path.join(REPO, 'experiments', 'highlights', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${slug}-p${pageStem}-${label}.png`);
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  return out;
}

const [slug, pageArg, ...rest] = process.argv.slice(2);
if (!slug || !pageArg || rest.length === 0) {
  console.error('Usage: overlay-bbox <slug> <pageNum> <quote...>');
  console.error('       overlay-bbox <slug> <pageNum> --bbox <x,y,w,h> [--label name]');
  process.exit(2);
}
const pageNum = Number(pageArg);

let bbox: BBox | null = null;
let label = 'resolved';
if (rest[0] === '--bbox') {
  const [, raw, ...tail] = rest;
  if (!raw) throw new Error('--bbox needs x,y,w,h');
  const [x, y, w, h] = raw.split(',').map(Number);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) throw new Error('bad bbox');
  bbox = { x: x!, y: y!, w: w!, h: h! };
  // Optional --label suffix.
  const li = tail.indexOf('--label');
  if (li !== -1 && tail[li + 1]) label = tail[li + 1]!;
  else label = 'manual';
} else {
  const quote = rest.join(' ');
  bbox = await resolveBBox(slug, pageNum, quote);
  if (!bbox) {
    console.error(JSON.stringify({ ok: false, reason: 'quote-not-found' }, null, 2));
    process.exit(1);
  }
  label = 'resolved';
}

const outPath = await overlay(slug, pageNum, label, bbox);
console.log(JSON.stringify({ ok: true, bbox, out: outPath }, null, 2));
