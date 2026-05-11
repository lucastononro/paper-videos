#!/usr/bin/env tsx
/**
 * extract-paper — run a PDF→markdown extractor on videos/<slug>/paper.pdf
 * and produce:
 *   - videos/<slug>/paper.md
 *   - videos/<slug>/equations.json   (parsed from paper.md)
 *
 * Two backends:
 *
 *   --backend marker   (default; current behavior)
 *     Invoked via `uvx --python 3.11 --from marker-pdf marker_single`.
 *     Python 3.11 pinned because surya-ocr (marker-pdf dep) uses PEP 604
 *     union syntax. Slow on CPU (~5-30 min for a 20-page paper) but
 *     no API calls; OCR-derived LaTeX.
 *
 *   --backend docling  (opt-in fast path; no extra setup beyond .env)
 *     Uses Docling for layout + a Claude vision pass for per-formula
 *     LaTeX recovery. ~30s docling + ~1s/formula vision call. Total
 *     ~1-2 min on a typical paper. Costs ~$0.05 per paper in API spend.
 *     Requires ANTHROPIC_API_KEY in env.
 *
 * Both backends write a folder of artifacts; we relocate them so the rest
 * of the pipeline (extractEquations regex → equations.json) is identical.
 */

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { videoFile, ensureSubdir } from '../lib/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const program = new Command()
  .name('extract-paper')
  .argument('<slug>')
  .option('--force', 'overwrite existing paper.md / equations.json', false)
  .option('--backend <name>', 'extraction backend: marker (default) or docling', 'marker');

program.parse();
const opts = program.opts<{ force: boolean; backend: string }>();
const [slug] = program.args as [string];

if (!['marker', 'docling'].includes(opts.backend)) {
  console.error(`Unknown --backend "${opts.backend}". Choose marker or docling.`);
  process.exit(1);
}

const pdf = videoFile(slug, 'paper.pdf');
if (!fs.existsSync(pdf)) {
  console.error(`paper.pdf missing for slug "${slug}". Run fetch-paper first.`);
  process.exit(1);
}

const targetMd = videoFile(slug, 'paper.md');
const targetEq = videoFile(slug, 'equations.json');
if (fs.existsSync(targetMd) && fs.existsSync(targetEq) && !opts.force) {
  console.log(`paper.md and equations.json already exist for "${slug}". Use --force to redo.`);
  process.exit(0);
}

const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), `${opts.backend}-${slug}-`));

if (opts.backend === 'marker') {
  console.log(`Running Marker (this can take 1–3 min on first run) ...`);
  await runMarker(pdf, tmpOut);

  const producedMd = locateMarkdown(tmpOut);
  if (!producedMd) {
    console.error(`Marker did not produce a .md under ${tmpOut}. See logs above.`);
    process.exit(2);
  }
  fs.copyFileSync(producedMd, targetMd);

  // Marker also outputs images sometimes; copy alongside paper.md if present.
  const producedDir = path.dirname(producedMd);
  const imgDir = ensureSubdir(slug, 'paper-md-assets');
  for (const f of fs.readdirSync(producedDir)) {
    if (/\.(png|jpe?g|svg)$/i.test(f)) {
      fs.copyFileSync(path.join(producedDir, f), path.join(imgDir, f));
    }
  }
} else {
  // Docling fast path
  console.log(`Running Docling fast-path (Docling layout + Claude vision LaTeX) ...`);
  if (!process.env['ANTHROPIC_API_KEY']) {
    console.error(
      `--backend docling requires ANTHROPIC_API_KEY in env (used for the per-formula LaTeX vision pass).`,
    );
    process.exit(2);
  }
  await runDocling(pdf, tmpOut);

  const producedMd = path.join(tmpOut, 'paper.md');
  if (!fs.existsSync(producedMd)) {
    console.error(`Docling did not produce paper.md at ${producedMd}. See logs above.`);
    process.exit(2);
  }
  fs.copyFileSync(producedMd, targetMd);

  // Copy any per-figure assets Docling produced
  const producedAssetsDir = path.join(tmpOut, 'paper-md-assets');
  if (fs.existsSync(producedAssetsDir)) {
    const imgDir = ensureSubdir(slug, 'paper-md-assets');
    for (const f of fs.readdirSync(producedAssetsDir)) {
      if (/\.(png|jpe?g|svg)$/i.test(f)) {
        fs.copyFileSync(path.join(producedAssetsDir, f), path.join(imgDir, f));
      }
    }
  }
}

const equations = extractEquations(fs.readFileSync(targetMd, 'utf8'));
fs.writeFileSync(targetEq, JSON.stringify(equations, null, 2));

fs.rmSync(tmpOut, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      slug,
      backend: opts.backend,
      paperMd: targetMd,
      equationsJson: targetEq,
      equationCount: equations.length,
    },
    null,
    2,
  ),
);

// ---------------------------------------------------------------------------

function runMarker(inputPdf: string, outputDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'uvx',
      [
        '--python',
        '3.11',
        '--from',
        'marker-pdf',
        'marker_single',
        inputPdf,
        '--output_dir',
        outputDir,
      ],
      { stdio: 'inherit' },
    );
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`marker_single exited with code ${code}`));
    });
  });
}

function runDocling(inputPdf: string, outputDir: string): Promise<void> {
  // Use uv's ephemeral env so docling + anthropic don't pollute the
  // primary venv. Pinned to py3.11 to match marker's pin.
  const helper = path.join(REPO_ROOT, 'scripts', 'extract_docling.py');
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'uvx',
      [
        '--python',
        '3.11',
        '--with',
        'docling',
        '--with',
        'pymupdf',
        '--with',
        'anthropic',
        'python',
        helper,
        inputPdf,
        outputDir,
      ],
      { stdio: 'inherit', env: process.env },
    );
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`extract_docling.py exited with code ${code}`));
    });
  });
}

function locateMarkdown(dir: string): string | null {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.md')) return full;
    }
  }
  return null;
}

type ExtractedEquation = {
  id: string;
  latex: string;
  display: 'inline' | 'block';
  context: string;
};

function extractEquations(md: string): ExtractedEquation[] {
  const out: ExtractedEquation[] = [];
  let n = 0;

  // Display math: $$...$$ (greedy across newlines but minimal)
  const blockRe = /\$\$([\s\S]+?)\$\$/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(md))) {
    n++;
    out.push({
      id: `eq-${String(n).padStart(3, '0')}`,
      latex: m[1]!.trim(),
      display: 'block',
      context: snippetAround(md, m.index, 120),
    });
  }

  // Inline math: $...$ (avoid escaped \$ and the $$ already matched)
  // We replace $$ blocks first to avoid double counting.
  const stripped = md.replace(blockRe, '');
  const inlineRe = /(?<!\\)\$([^$\n]{1,200}?)(?<!\\)\$/g;
  while ((m = inlineRe.exec(stripped))) {
    n++;
    out.push({
      id: `eq-${String(n).padStart(3, '0')}`,
      latex: m[1]!.trim(),
      display: 'inline',
      context: snippetAround(stripped, m.index, 120),
    });
  }

  return out;
}

function snippetAround(s: string, idx: number, span: number): string {
  const start = Math.max(0, idx - span);
  const end = Math.min(s.length, idx + span);
  return s.slice(start, end).replace(/\s+/g, ' ').trim();
}
