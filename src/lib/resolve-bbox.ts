/**
 * resolve-bbox — find a quote on a paper page and return its bounding box
 * in normalized image coordinates (top-left origin, [0,1]).
 *
 * Why this exists: storytellers eyeball pixel coordinates and get them wrong
 * almost every time (the existing manifests confirm this — manual bboxes
 * routinely highlight a banner above the intended quote, or land off the
 * actual text). Anchoring the bbox to the quote string itself eliminates
 * the guesswork: the storyteller writes `quote="..."` and the harness
 * computes the rectangle from the PDF's text-extraction layer.
 *
 * Strategy:
 *   1. Load videos/<slug>/paper.pdf via pdfjs-dist.
 *   2. Extract token-level text-with-positions for the requested page
 *      (cached — pdfjs page parse is slow).
 *   3. Find the longest contiguous token run whose normalized text matches
 *      the query (lowercased, stripped of punctuation/whitespace, smart
 *      quotes folded). Substring search across the whole page is a fallback.
 *   4. Compute the union of those tokens' rectangles → bbox.
 *   5. Normalize against page width/height with a tiny pixel-padding so the
 *      highlight has breathing room.
 *
 * Returns null when the quote can't be located (caller should warn but not
 * crash — the visual still renders, just without a highlight).
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { videoFile } from './paths.js';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');

export type BBox = { x: number; y: number; w: number; h: number };

type Token = {
  norm: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type PageData = {
  tokens: Token[];
  pageWidth: number;
  pageHeight: number;
};

// Cache page-token extraction by (slug,pageNum) — building the script for a
// long video may resolve many quotes on the same handful of pages.
const pageCache = new Map<string, Promise<PageData>>();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, '')
    .replace(/[–—]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

async function loadPage(slug: string, pageNum: number): Promise<PageData> {
  const key = `${slug}::${pageNum}`;
  const cached = pageCache.get(key);
  if (cached) return cached;
  const pdfPath = videoFile(slug, 'paper.pdf');
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`paper.pdf missing for slug "${slug}" — run /paper-video new first.`);
  }
  const promise = (async () => {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true })
      .promise;
    if (pageNum < 1 || pageNum > pdf.numPages) {
      throw new Error(`Page ${pageNum} out of range (1..${pdf.numPages})`);
    }
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent({ disableCombineTextItems: false });
    const tokens: Token[] = [];
    for (const it of content.items as Array<any>) {
      const str = it.str as string;
      if (!str || !str.trim()) continue;
      const transform = it.transform as number[];
      const e = transform[4] ?? 0;
      const f = transform[5] ?? 0;
      const w = it.width as number;
      const h = it.height as number;
      const yTop = viewport.height - f - h;
      tokens.push({ norm: normalize(str), x: e, y: yTop, w, h });
    }
    return { tokens, pageWidth: viewport.width, pageHeight: viewport.height };
  })();
  pageCache.set(key, promise);
  return promise;
}

function findRun(tokens: Token[], target: string): { start: number; end: number } | null {
  if (!target) return null;
  // Greedy contiguous match.
  for (let i = 0; i < tokens.length; i++) {
    let acc = '';
    for (let j = i; j < tokens.length; j++) {
      acc += tokens[j]!.norm;
      if (acc === target) return { start: i, end: j };
      if (acc.length >= target.length) {
        if (acc.startsWith(target)) return { start: i, end: j };
        break;
      }
      if (!target.startsWith(acc)) break;
    }
  }
  // Fallback: substring across the whole page when a quote sits inside a
  // longer run we'd otherwise reject (e.g., the first matching token's
  // normalized form already contains characters past the query head).
  const offsets: number[] = [];
  let cursor = 0;
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
    const oEnd = offsets[k]! + tokens[k]!.norm.length;
    if (start === -1 && oEnd > idx) start = k;
    if (oEnd >= endIdx) {
      end = k;
      break;
    }
  }
  if (start === -1 || end === -1) return null;
  return { start, end };
}

/**
 * Resolve a quote on a given page to a normalized bbox.
 * Returns null on miss (caller should warn but not crash).
 */
export async function resolveBBox(
  slug: string,
  pageNum: number,
  quote: string,
): Promise<BBox | null> {
  const target = normalize(quote);
  if (!target) return null;
  const { tokens, pageWidth, pageHeight } = await loadPage(slug, pageNum);
  const run = findRun(tokens, target);
  if (!run) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = run.start; i <= run.end; i++) {
    const t = tokens[i]!;
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + t.w);
    maxY = Math.max(maxY, t.y + t.h);
  }
  // Padding (≈6px horizontal, 4px vertical at PDF's intrinsic dpi) gives the
  // highlight border a small margin so glyphs aren't clipped at the edge.
  const padX = 6 / pageWidth;
  const padY = 4 / pageHeight;
  const x = Math.max(0, minX / pageWidth - padX);
  const y = Math.max(0, minY / pageHeight - padY);
  const w = Math.min(1 - x, (maxX - minX) / pageWidth + 2 * padX);
  const h = Math.min(1 - y, (maxY - minY) / pageHeight + 2 * padY);
  return { x, y, w, h };
}
