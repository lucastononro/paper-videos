#!/usr/bin/env tsx
/**
 * fetch-paper — download or copy a paper PDF into videos/<slug>/paper.pdf.
 *
 * Usage:
 *   npm run fetch-paper -- <arxiv_id|url|local_path> [slug]
 *
 * If slug is omitted, derived from arxiv id or filename.
 */

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import { classifySource, slugFromSource } from '../lib/slug.js';
import { ensureVideoDir, videoFile } from '../lib/paths.js';
import { defaultManifest, manifestExists, writeManifest } from '../lib/manifest.js';

const program = new Command()
  .name('fetch-paper')
  .description('Download or copy a paper PDF into videos/<slug>/paper.pdf')
  .argument('<source>', 'arxiv id (e.g. 1706.03762), arxiv URL, https URL, or local PDF path')
  .argument('[slug]', 'optional slug (derived if omitted)')
  .option('--force', 'overwrite existing paper.pdf', false)
  .option('--voice <alias>', 'voice alias for the default manifest', 'pharaoh')
  .option('--captions', 'render bottom captions over the video (default off)', false);

program.parse();
const opts = program.opts<{ force: boolean; voice: string; captions: boolean }>();
const [sourceArg, slugArg] = program.args as [string, string | undefined];

const source = classifySource(sourceArg);
const slug = slugArg ?? slugFromSource(source);

if (source.kind === 'topic') {
  console.error(
    `fetch-paper: input "${sourceArg}" looks like a topic prompt, not a paper.\n` +
      `For topic-mode videos (no paper), use:\n` +
      `    npm run new-topic -- "${sourceArg}" ${slug}\n`,
  );
  process.exit(1);
}

ensureVideoDir(slug);
const targetPdf = videoFile(slug, 'paper.pdf');

if (fs.existsSync(targetPdf) && !opts.force) {
  console.log(`paper.pdf already exists for slug "${slug}". Use --force to overwrite.`);
} else {
  await fetchPdf(source, targetPdf);
}

writeConfigYaml(slug, source, opts.voice, opts.captions);

if (!manifestExists(slug)) {
  writeManifest(
    slug,
    defaultManifest({
      slug,
      paperSource: source,
      paperTitle: '(unknown — will be filled by paper-extractor)',
      voiceAlias: opts.voice,
      captions: opts.captions,
    }),
  );
}

console.log(JSON.stringify({ slug, paperPdf: targetPdf, source }, null, 2));

// ---------------------------------------------------------------------------

async function fetchPdf(src: ReturnType<typeof classifySource>, dest: string): Promise<void> {
  switch (src.kind) {
    case 'arxiv': {
      const url = `https://arxiv.org/pdf/${src.arxivId}.pdf`;
      console.log(`Downloading arxiv:${src.arxivId} ...`);
      await downloadTo(url, dest);
      return;
    }
    case 'url': {
      console.log(`Downloading ${src.value} ...`);
      await downloadTo(src.value, dest);
      return;
    }
    case 'local': {
      const abs = path.resolve(src.value);
      if (!fs.existsSync(abs)) throw new Error(`Local PDF not found: ${abs} (input: ${src.value})`);
      if (abs !== path.resolve(dest)) {
        console.log(`Copying ${abs} -> ${dest}`);
        fs.copyFileSync(abs, dest);
      } else {
        console.log(`PDF already at ${dest}, skipping copy.`);
      }
      return;
    }
    case 'topic':
      // Already filtered out at the top of this file; the case is here for
      // exhaustiveness so TS narrows the discriminant correctly.
      throw new Error('topic-mode sources cannot be fetched as a PDF');
  }
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'paper-videos/0.1 (https://github.com/; explainer-video pipeline)',
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024)
    throw new Error(`Downloaded file suspiciously small (${buf.length} bytes)`);
  fs.writeFileSync(dest, buf);
}

function writeConfigYaml(
  slug: string,
  source: ReturnType<typeof classifySource>,
  voice: string,
  captions: boolean,
): void {
  const cfgPath = videoFile(slug, 'config.yaml');
  if (fs.existsSync(cfgPath)) return; // never clobber user-edited config
  const cfg = {
    slug,
    paperSource: source,
    paperTitle: '(unknown — will be filled by paper-extractor)',
    voice,
    captions,
    targetLengthMinutes: 12,
    focusAreas: [] as string[],
    resolution: { width: 1920, height: 1080 },
    fps: 30,
  };
  fs.writeFileSync(cfgPath, yamlStringify(cfg));
}
