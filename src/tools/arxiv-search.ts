#!/usr/bin/env tsx
/**
 * arxiv-search — query arXiv and emit JSON results.
 *
 * Usage: npm run arxiv-search -- "<query>" [--max 5]
 *
 * Implementation note: we hit the public arXiv API directly (no extra deps)
 * so we don't depend on any third-party arxiv-* package version drift.
 */

import { Command } from 'commander';

const program = new Command()
  .name('arxiv-search')
  .argument('<query>')
  .option('--max <n>', 'max results', '5')
  .option('--start <n>', 'pagination offset', '0');

program.parse();
const opts = program.opts<{ max: string; start: string }>();
const [query] = program.args as [string];

const url = new URL('http://export.arxiv.org/api/query');
url.searchParams.set('search_query', `all:${query}`);
url.searchParams.set('start', opts.start);
url.searchParams.set('max_results', opts.max);
url.searchParams.set('sortBy', 'relevance');
url.searchParams.set('sortOrder', 'descending');

const res = await fetch(url, {
  headers: {
    'User-Agent': 'paper-videos/0.1 (explainer pipeline; respects 1 req/3s)',
  },
});
if (!res.ok) {
  console.error(`arXiv API error: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const xml = await res.text();
const entries = parseAtom(xml);

console.log(JSON.stringify({ query, count: entries.length, results: entries }, null, 2));

// ---------------------------------------------------------------------------
// Tiny Atom parser — sufficient for arXiv's well-formed feed.

type ArxivEntry = {
  arxivId: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  pdfUrl: string;
  abstractUrl: string;
  primaryCategory: string | null;
};

function parseAtom(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml))) {
    const e = m[1]!;
    const id = pick(e, /<id>([^<]+)<\/id>/);
    const arxivId = id.replace(/^https?:\/\/arxiv\.org\/abs\//, '').replace(/v\d+$/, '');
    const title = collapseSpaces(pick(e, /<title>([\s\S]*?)<\/title>/));
    const summary = collapseSpaces(pick(e, /<summary>([\s\S]*?)<\/summary>/));
    const published = pick(e, /<published>([^<]+)<\/published>/);
    const authors = [...e.matchAll(/<author>\s*<name>([^<]+)<\/name>/g)].map((a) => a[1]!);
    const links = [...e.matchAll(/<link\s+([^>]+)\/>/g)].map((l) => parseAttrs(l[1]!));
    const pdfUrl = links.find((l) => l['title'] === 'pdf')?.['href'] ?? '';
    const abstractUrl = links.find((l) => l['rel'] === 'alternate')?.['href'] ?? '';
    const catMatch = e.match(/<arxiv:primary_category[^>]*\bterm="([^"]+)"/);
    entries.push({
      arxivId,
      title,
      summary,
      authors,
      published,
      pdfUrl,
      abstractUrl,
      primaryCategory: catMatch ? catMatch[1]! : null,
    });
  }
  return entries;
}

function pick(s: string, re: RegExp): string {
  const m = s.match(re);
  return m ? m[1]!.trim() : '';
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]!] = m[2]!;
  return out;
}
