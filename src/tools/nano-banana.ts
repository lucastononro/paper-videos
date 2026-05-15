#!/usr/bin/env tsx
/**
 * nano-banana — generate / edit images with Google's "Nano Banana" models
 * (Gemini image-generation family) via the Gemini API REST endpoint.
 *
 * Synchronous: one POST, one response. Much simpler than Veo.
 *
 * Usage:
 *   # text-to-image
 *   npm run nano-banana -- "A photorealistic macro shot of a dewdrop on a leaf"
 *
 *   # edit one image
 *   npm run nano-banana -- "Change background to a sunset beach" --image ./me.jpg
 *
 *   # combine multiple images
 *   npm run nano-banana -- "Put the product from img1 into the scene from img2" \
 *     --image ./product.png --image ./scene.jpg
 *
 *   # iterative editing (multi-turn conversation, persisted to a json file)
 *   npm run nano-banana -- "Generate a logo for Bean Dream" --conversation ./logo.json
 *   npm run nano-banana -- "Make the colors warmer, add steam" --conversation ./logo.json
 *
 *   # write into a paper-video folder
 *   npm run nano-banana -- "title card art, navy + gold" \
 *     --out videos/attention-is-all-you-need/images/img-001.png
 *
 * Requires GEMINI_API_KEY in .env (get one at https://aistudio.google.com/apikey).
 */

import 'dotenv/config';
import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { REPO_ROOT } from '../lib/paths.js';

const IMAGE_EXTS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

function inferImageMime(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const mime = IMAGE_EXTS[ext];
  if (!mime) throw new Error(`Cannot infer image mime for ${file} (unknown extension ${ext})`);
  return mime;
}

function loadImagePart(file: string): { inlineData: { mimeType: string; data: string } } {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  return {
    inlineData: {
      mimeType: inferImageMime(abs),
      data: fs.readFileSync(abs).toString('base64'),
    },
  };
}

function defaultOutPath(ext = '.png'): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const tag = crypto.randomBytes(3).toString('hex');
  return path.join(REPO_ROOT, 'nano-banana-output', `${ts}_${tag}${ext}`);
}

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };
type Content = { role?: 'user' | 'model'; parts: Part[] };
type GenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Part[]; role?: string };
    finishReason?: string;
    safetyRatings?: unknown;
  }>;
  promptFeedback?: { blockReason?: string; safetyRatings?: unknown };
  error?: { message?: string; code?: number; status?: string };
};

const program = new Command()
  .name('nano-banana')
  .description('Generate / edit images with Gemini image-generation models (Nano Banana family)')
  .argument('<prompt>', 'text prompt')
  .option(
    '-m, --model <id>',
    'gemini-3.1-flash-image-preview (Nano Banana 2) | gemini-3-pro-image-preview (Pro) | gemini-2.5-flash-image (v1)',
    'gemini-3.1-flash-image-preview',
  )
  .option('-o, --out <path>', 'output image path (or directory if multiple images returned)')
  .option(
    '-i, --image <path>',
    'input image for editing (repeatable for multi-image input)',
    (val: string, acc: string[]) => acc.concat(val),
    [] as string[],
  )
  .option('--conversation <path>', 'json file to persist multi-turn history (read + append)')
  .option('--save-text <path>', 'also write any text in the model response to this file')
  .option('--print-only', 'print resolved request and exit (no API call)');

program.parse();
const opts = program.opts<{
  model: string;
  out?: string;
  image: string[];
  conversation?: string;
  saveText?: string;
  printOnly?: boolean;
}>();

const [prompt] = program.args as [string];

// ---- build contents ----------------------------------------------------
let contents: Content[] = [];

if (opts.conversation && fs.existsSync(opts.conversation)) {
  const raw = JSON.parse(fs.readFileSync(opts.conversation, 'utf-8')) as unknown;
  if (Array.isArray(raw)) {
    contents = raw as Content[];
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as { contents?: unknown }).contents)) {
    contents = (raw as { contents: Content[] }).contents;
  } else {
    throw new Error(`Conversation file ${opts.conversation} is not an array or {contents:[]}`);
  }
}

const userParts: Part[] = [{ text: prompt }, ...opts.image.map(loadImagePart)];
contents.push({ role: 'user', parts: userParts });

const body = {
  contents,
  generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
};

if (opts.printOnly) {
  const redacted = JSON.parse(
    JSON.stringify(body, (k, v) => (k === 'data' && typeof v === 'string' ? `<base64 ${v.length} chars>` : v)),
  );
  console.log(JSON.stringify({ model: opts.model, body: redacted }, null, 2));
  process.exit(0);
}

const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in .env (get one at https://aistudio.google.com/apikey)');
  process.exit(1);
}

const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`;

// ---- call --------------------------------------------------------------
async function main() {
  console.log(`[nano-banana] model=${opts.model}  inputs=${opts.image.length} image(s)`);
  console.log(`[nano-banana] prompt: ${prompt.slice(0, 140)}${prompt.length > 140 ? '…' : ''}`);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as GenerateContentResponse;
  if (!res.ok) {
    const msg = json.error?.message ?? JSON.stringify(json).slice(0, 500);
    throw new Error(`generateContent failed (${res.status}): ${msg}`);
  }
  if (json.promptFeedback?.blockReason) {
    throw new Error(`Prompt blocked: ${json.promptFeedback.blockReason}`);
  }
  const candidates = json.candidates ?? [];
  if (candidates.length === 0) {
    throw new Error(`No candidates in response: ${JSON.stringify(json).slice(0, 500)}`);
  }

  // Walk every part across every candidate. Collect inline images + text.
  const images: Array<{ mime: string; data: string }> = [];
  const texts: string[] = [];
  const modelContent: Content = { role: 'model', parts: [] };
  for (const c of candidates) {
    for (const p of c.content?.parts ?? []) {
      if (p.inlineData?.data) {
        images.push({ mime: p.inlineData.mimeType ?? 'image/png', data: p.inlineData.data });
        modelContent.parts.push({
          inlineData: { mimeType: p.inlineData.mimeType ?? 'image/png', data: p.inlineData.data },
        });
      } else if (typeof p.text === 'string' && p.text.length > 0) {
        texts.push(p.text);
        modelContent.parts.push({ text: p.text });
      }
    }
  }

  if (images.length === 0) {
    const combinedText = texts.join('\n').slice(0, 500);
    const finish = candidates[0]?.finishReason ?? 'unknown';
    throw new Error(
      `No images in response (finishReason=${finish}). Model text: ${combinedText || '<empty>'}`,
    );
  }

  // ---- write images ----
  const firstMime = images[0]?.mime ?? 'image/png';
  const defaultExt = MIME_TO_EXT[firstMime] ?? '.png';
  const base = opts.out ?? defaultOutPath(defaultExt);

  let outPaths: string[];
  if (images.length === 1) {
    fs.mkdirSync(path.dirname(base), { recursive: true });
    outPaths = [base];
  } else {
    const dir = base.replace(/\.(png|jpg|jpeg|webp)$/i, '');
    fs.mkdirSync(dir, { recursive: true });
    outPaths = images.map((img, i) => {
      const ext = MIME_TO_EXT[img.mime] ?? '.png';
      return path.join(dir, `image-${String(i + 1).padStart(2, '0')}${ext}`);
    });
  }

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const outPath = outPaths[i];
    if (!img || !outPath) continue;
    fs.writeFileSync(outPath, Buffer.from(img.data, 'base64'));
    const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
    console.log(`[nano-banana] wrote ${outPath} (${sizeMB} MB, ${img.mime})`);
  }

  // ---- text ----
  if (texts.length > 0) {
    const joined = texts.join('\n\n');
    if (opts.saveText) {
      fs.mkdirSync(path.dirname(opts.saveText), { recursive: true });
      fs.writeFileSync(opts.saveText, joined);
      console.log(`[nano-banana] wrote text to ${opts.saveText}`);
    } else {
      console.log(`[nano-banana] model text: ${joined.slice(0, 200)}${joined.length > 200 ? '…' : ''}`);
    }
  }

  // ---- conversation ----
  if (opts.conversation) {
    const next = contents.concat(modelContent);
    fs.mkdirSync(path.dirname(opts.conversation), { recursive: true });
    fs.writeFileSync(opts.conversation, JSON.stringify(next, null, 2));
    console.log(`[nano-banana] updated conversation history: ${opts.conversation} (${next.length} turns)`);
  }
}

main().catch((err) => {
  console.error(`[nano-banana] error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
