#!/usr/bin/env tsx
/**
 * resolve-bbox CLI — given a slug + page number + quote, print the bbox.
 *
 * Usage:
 *   npm run resolve-bbox -- <slug> <pageNum> <quote...>
 *
 * Output is JSON; stderr if the quote is not found on the page.
 */

import { resolveBBox } from '../lib/resolve-bbox.js';

const [slug, pageArg, ...quoteArgs] = process.argv.slice(2);
if (!slug || !pageArg || quoteArgs.length === 0) {
  console.error('Usage: resolve-bbox <slug> <pageNum> <quote...>');
  process.exit(2);
}
const pageNum = Number(pageArg);
const quote = quoteArgs.join(' ');
const bbox = await resolveBBox(slug, pageNum, quote);
if (!bbox) {
  console.error(
    JSON.stringify({ ok: false, reason: 'quote-not-found', slug, pageNum, quote }, null, 2),
  );
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, slug, pageNum, quote, bbox }, null, 2));
