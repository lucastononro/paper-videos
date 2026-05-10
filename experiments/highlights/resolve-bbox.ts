#!/usr/bin/env tsx
/**
 * resolve-bbox — find a quote on a paper page and return its bounding box.
 *
 * Usage:
 *   npx tsx experiments/highlights/resolve-bbox.ts <slug> <pageNum> <quote...>
 *
 * Strategy:
 *   1. Load videos/<slug>/paper.pdf via pdfjs-dist.
 *   2. Extract text content with positions for the requested page.
 *   3. Reconstruct the per-token sequence with viewport coordinates.
 *   4. Search for the longest contiguous run of tokens whose concatenation
 *      (loose-matched, lowercase, ignoring punctuation/whitespace) starts
 *      with the query.
 *   5. Compute the union of those tokens' rectangles → final bbox.
 *   6. Normalize to [0,1] of page width/height (top-left origin).
 *
 * Why a fuzzy match: PDF text extraction returns a token stream with weird
 * spacing — quotes sometimes split across lines or get hyphenation, and
 * ligatures change "fi" → "ﬁ". We strip non-alphanumerics and lowercase
 * before comparing.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');

const REPO = path.resolve(import.meta.dirname, '..', '..');

type BBox = { x: number; y: number; w: number; h: number };

type Token = {
  raw: string;
  norm: string;        // lowercase, alphanumerics-only
  // viewport-space rect (top-left origin, after applying default getViewport)
  x: number;
  y: number;
  w: number;
  h: number;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, '')   // smart quotes
    .replace(/[–—]/g, '')               // dashes
    .replace(/[^a-z0-9]+/g, '');
}

async function pageTokens(pdfPath: string, pageNum: number): Promise<{ tokens: Token[]; pageWidth: number; pageHeight: number }> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  if (pageNum < 1 || pageNum > pdf.numPages) {
    throw new Error(`Page ${pageNum} out of range (1..${pdf.numPages})`);
  }
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent({ disableCombineTextItems: false });
  const tokens: Token[] = [];
  // Each item has { str, transform: [a,b,c,d,e,f], width, height }.
  // The transform's e/f gives the baseline origin in PDF space (origin
  // bottom-left). Convert to top-left-origin viewport space.
  for (const it of content.items as Array<any>) {
    const str = it.str as string;
    if (!str || !str.trim()) continue;
    const [, , , , e, f] = it.transform as number[];
    const w = it.width as number;
    const h = it.height as number;
    // Baseline is at (e, f); the glyph rises ~h above baseline.
    // Convert PDF-bottom-left → viewport-top-left.
    const yTop = viewport.height - f - h;
    tokens.push({
      raw: str,
      norm: normalize(str),
      x: e,
      y: yTop,
      w,
      h,
    });
  }
  return { tokens, pageWidth: viewport.width, pageHeight: viewport.height };
}

function findRun(tokens: Token[], query: string): { start: number; end: number } | null {
  const target = normalize(query);
  if (!target) return null;
  // Greedy contiguous match: starting at each token, accumulate normalized
  // text until it covers the target prefix. Track the run that consumed
  // exactly the target.
  for (let i = 0; i < tokens.length; i++) {
    let acc = '';
    for (let j = i; j < tokens.length; j++) {
      acc += tokens[j]!.norm;
      if (acc === target) return { start: i, end: j };
      if (acc.length > target.length) {
        if (acc.startsWith(target)) return { start: i, end: j };
        break;
      }
      if (!target.startsWith(acc)) break;
    }
  }
  // Fallback: substring search across the whole page's normalized text — for
  // when a quote sits inside a longer token run we'd otherwise reject.
  let cursor = 0;
  const offsets: number[] = [];
  for (const t of tokens) {
    offsets.push(cursor);
    cursor += t.norm.length;
  }
  const fullText = tokens.map((t) => t.norm).join('');
  const idx = fullText.indexOf(target);
  if (idx === -1) return null;
  const endIdx = idx + target.length;
  let start = -1;
  let end = -1;
  for (let k = 0; k < offsets.length; k++) {
    const o = offsets[k]!;
    const oEnd = o + tokens[k]!.norm.length;
    if (start === -1 && oEnd > idx) start = k;
    if (oEnd >= endIdx) {
      end = k;
      break;
    }
  }
  if (start === -1 || end === -1) return null;
  return { start, end };
}

function unionRect(tokens: Token[], start: number, end: number): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = start; i <= end; i++) {
    const t = tokens[i]!;
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + t.w);
    maxY = Math.max(maxY, t.y + t.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export async function resolveBBox(slug: string, pageNum: number, quote: string): Promise<BBox | null> {
  const pdfPath = path.join(REPO, 'videos', slug, 'paper.pdf');
  const { tokens, pageWidth, pageHeight } = await pageTokens(pdfPath, pageNum);
  const run = findRun(tokens, quote);
  if (!run) return null;
  const r = unionRect(tokens, run.start, run.end);
  // Normalize and add a tiny padding to give the highlight some breathing room.
  const padX = 6 / pageWidth;
  const padY = 4 / pageHeight;
  const x = Math.max(0, r.x / pageWidth - padX);
  const y = Math.max(0, r.y / pageHeight - padY);
  const w = Math.min(1 - x, r.w / pageWidth + 2 * padX);
  const h = Math.min(1 - y, r.h / pageHeight + 2 * padY);
  return { x, y, w, h };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const [slug, pageArg, ...quoteArgs] = process.argv.slice(2);
  if (!slug || !pageArg || quoteArgs.length === 0) {
    console.error('Usage: resolve-bbox <slug> <pageNum> <quote...>');
    process.exit(2);
  }
  const pageNum = Number(pageArg);
  const quote = quoteArgs.join(' ');
  const bbox = await resolveBBox(slug, pageNum, quote);
  if (!bbox) {
    console.error(JSON.stringify({ ok: false, reason: 'quote-not-found', slug, pageNum, quote }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, slug, pageNum, quote, bbox }, null, 2));
}
