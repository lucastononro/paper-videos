#!/usr/bin/env tsx
/**
 * elevenlabs-video — generate a short video clip with ElevenLabs' creative
 * video models (Seedance, Kling, Sora, Veo, Wan) via the ElevenCreative
 * Studio REST API.
 *
 * Auth: ELEVENLABS_API_KEY (the same key /v1/text-to-speech uses). The header
 * is `xi-api-key`.
 *
 * Access status (May 2026): the ElevenCreative Studio API is private beta
 * ("contact sales — available upon request"). The official @elevenlabs/elevenlabs-js
 * SDK does not yet expose a video namespace. The endpoint path and request
 * shape below are best-guesses modeled on the existing public REST
 * conventions (/v1/sound-generation, /v1/music). If your account doesn't
 * have video access, the script detects a 401/403/404 and prints a clear
 * "use the dashboard instead" message — the paper-videos visualizer's
 * provider preference chain (ElevenLabs → Veo → Manim) handles the
 * fallback.
 *
 * Override the endpoint path via env var `ELEVENLABS_VIDEO_PATH` once
 * ElevenLabs publishes official docs.
 *
 * Usage:
 *   npm run elevenlabs-video -- "A cinematic drone shot over misty mountains" \
 *     -m kling-2.6 -d 8 -a 16:9 --no-audio \
 *     --out videos/<slug>/manim/beat-002.mp4
 *
 *   # image-to-video
 *   npm run elevenlabs-video -- "the figure turns and walks away" --image first.png
 *
 *   # reference-guided (character continuity)
 *   npm run elevenlabs-video -- "the same character now in a forest" \
 *     -m kling-3.0 --reference char-portrait.png
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

const FRIENDLY_MODEL_IDS = [
  'seedance-2',
  'seedance-1-pro',
  'seedance-1.5-pro',
  'kling-2.5',
  'kling-2.6',
  'kling-3.0',
  'sora-2',
  'sora-2-pro',
  'veo-3.1',
  'veo-3.1-fast',
  'veo-3',
  'veo-3-fast',
  'wan-2.5',
  'wan-2.6',
] as const;

function inferImageMime(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const mime = IMAGE_EXTS[ext];
  if (!mime) throw new Error(`Cannot infer image mime for ${file} (unknown extension ${ext})`);
  return mime;
}

function loadImageDataUri(file: string): string {
  if (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('data:')) {
    return file;
  }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const mime = inferImageMime(abs);
  const b64 = fs.readFileSync(abs).toString('base64');
  return `data:${mime};base64,${b64}`;
}

function defaultOutPath(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const tag = crypto.randomBytes(3).toString('hex');
  return path.join(REPO_ROOT, 'elevenlabs-video-output', `${ts}_${tag}.mp4`);
}

const program = new Command()
  .name('elevenlabs-video')
  .description('Generate a short video clip with an ElevenLabs creative video model')
  .argument('<prompt>', 'cinematographic prompt')
  .option('-m, --model <id>', `friendly model id (one of: ${FRIENDLY_MODEL_IDS.join(', ')})`, 'kling-2.6')
  .option(
    '--model-id-raw <string>',
    'override the resolved model id sent to the API (escape hatch when ElevenLabs changes their internal naming)',
  )
  .option('-o, --out <path>', 'output mp4 path (or directory if --count>1)')
  .option('-a, --aspect <ratio>', '16:9 | 9:16 | 1:1 (model-dependent)', '16:9')
  .option('-d, --duration <seconds>', 'clip duration in seconds', '8')
  .option('-r, --resolution <res>', '720p | 1080p | 4k (model-dependent)')
  .option('-c, --count <n>', 'number of videos (1-4)', '1')
  .option('--seed <n>', 'reproducibility seed')
  .option('--negative <text>', 'negative prompt')
  .option('--audio', 'request native audio (Seedance 2 / Wan 2.6 only — most models reject)')
  .option('--no-audio', 'omit the audio field (default — paper-video narration overlays)')
  .option('--image <path>', 'first frame (local file, https://, or data:)')
  .option('--last-frame <path>', 'last frame (requires --image)')
  .option(
    '--reference <path>',
    'reference image (repeatable, up to 3)',
    (val: string, acc: string[]) => acc.concat(val),
    [] as string[],
  )
  .option('--camera <mode>', 'camera control hint (pan_left, tilt_up, push_in, etc. — model-dependent)')
  .option('--poll-interval <seconds>', 'poll cadence for long-running operation', '10')
  .option('--print-only', 'print resolved request and exit (no API call)');

program.parse();
const opts = program.opts<{
  model: string;
  modelIdRaw?: string;
  out?: string;
  aspect: string;
  duration: string;
  resolution?: string;
  count: string;
  seed?: string;
  negative?: string;
  audio?: boolean;
  image?: string;
  lastFrame?: string;
  reference: string[];
  camera?: string;
  pollInterval: string;
  printOnly?: boolean;
}>();

const [prompt] = program.args as [string];

// ---- validate -----------------------------------------------------------
if (opts.lastFrame && !opts.image) throw new Error('--last-frame requires --image');
if (opts.reference.length > 3) throw new Error('Up to 3 reference images allowed');
if (opts.reference.length > 0 && (opts.image || opts.lastFrame)) {
  // Some models (Kling 3.0) allow both; others reject. Warn rather than error.
  process.stderr.write(
    `[elevenlabs-video] warning: combining --reference with --image/--last-frame may be rejected by some models\n`,
  );
}
const duration = parseInt(opts.duration, 10);
if (!Number.isFinite(duration) || duration < 1 || duration > 60) {
  throw new Error('--duration must be a positive integer ≤ 60');
}
const sampleCount = parseInt(opts.count, 10);
if (sampleCount < 1 || sampleCount > 4) throw new Error('--count must be 1-4');

if (!FRIENDLY_MODEL_IDS.includes(opts.model as (typeof FRIENDLY_MODEL_IDS)[number])) {
  process.stderr.write(
    `[elevenlabs-video] warning: model "${opts.model}" not in the known list; passing through as-is. Use --model-id-raw to fully override.\n`,
  );
}

// ---- auth ---------------------------------------------------------------
const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error(
    '[elevenlabs-video] missing ELEVENLABS_API_KEY in .env. This is the same key /v1/text-to-speech uses.',
  );
  process.exit(1);
}

// ---- endpoint -----------------------------------------------------------
// Provisional path — override via ELEVENLABS_VIDEO_PATH once ElevenLabs
// publishes official docs.
const apiBase = process.env.ELEVENLABS_API_BASE ?? 'https://api.elevenlabs.io';
const generatePath = process.env.ELEVENLABS_VIDEO_PATH ?? '/v1/video-generation';
const generateUrl = `${apiBase}${generatePath}`;
// Polling path follows the same naming for long-running ops. ElevenLabs'
// dubbing uses /v1/dubbing/<id> for status; we mirror that convention.
const statusPath = process.env.ELEVENLABS_VIDEO_STATUS_PATH ?? '/v1/video-generation';
const statusUrl = (id: string) => `${apiBase}${statusPath}/${encodeURIComponent(id)}`;

// ---- build body ---------------------------------------------------------
const resolvedModelId = opts.modelIdRaw ?? opts.model;

type RequestBody = {
  model: string;
  prompt: string;
  aspect_ratio?: string;
  duration_seconds?: number;
  resolution?: string;
  sample_count?: number;
  seed?: number;
  negative_prompt?: string;
  generate_audio?: boolean;
  first_frame?: string;
  last_frame?: string;
  reference_images?: string[];
  camera_control?: string;
};

const body: RequestBody = {
  model: resolvedModelId,
  prompt,
  aspect_ratio: opts.aspect,
  duration_seconds: duration,
  sample_count: sampleCount,
};
if (opts.resolution) body.resolution = opts.resolution;
if (opts.seed !== undefined) body.seed = parseInt(opts.seed, 10);
if (opts.negative) body.negative_prompt = opts.negative;
if (opts.audio !== undefined) body.generate_audio = opts.audio;
if (opts.image) body.first_frame = loadImageDataUri(opts.image);
if (opts.lastFrame) body.last_frame = loadImageDataUri(opts.lastFrame);
if (opts.reference.length > 0) body.reference_images = opts.reference.map(loadImageDataUri);
if (opts.camera) body.camera_control = opts.camera;

if (opts.printOnly) {
  const redacted = JSON.parse(
    JSON.stringify(body, (k, v) => {
      if (typeof v === 'string' && v.startsWith('data:') && v.length > 200) {
        return `<data-uri ${v.length} chars>`;
      }
      return v;
    }),
  );
  console.log(
    JSON.stringify(
      {
        endpoint: generateUrl,
        status_endpoint_template: statusUrl(':id'),
        model: resolvedModelId,
        body: redacted,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

// ---- network helpers ----------------------------------------------------
const authHeaders: Record<string, string> = {
  'xi-api-key': apiKey,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

function isAccessDenied(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

function reportAccessDenied(status: number, bodyText: string): never {
  process.stderr.write('\n');
  console.error(
    `[elevenlabs-video] HTTP ${status} from ${generateUrl}\n` +
      `\n` +
      `The ElevenCreative Studio video API is private beta as of May 2026 — your\n` +
      `current ELEVENLABS_API_KEY does not have video-generation scope, OR the\n` +
      `endpoint path (${generatePath}) is wrong for your tier.\n` +
      `\n` +
      `Two options:\n` +
      `  (1) Request beta access at https://elevenlabs.io/contact-sales (subject:\n` +
      `      "ElevenCreative Studio API video access"). Once granted, re-run.\n` +
      `  (2) Generate this clip manually at https://elevenlabs.io/video using the\n` +
      `      same prompt, then save the mp4 to your target path (e.g.\n` +
      `      videos/<slug>/manim/beat-NNN.mp4). The paper-videos composition will\n` +
      `      pick it up as a manimClip with no schema change.\n` +
      `\n` +
      `Provisional fallback for the paper-videos pipeline: the visualizer's\n` +
      `provider chain is ElevenLabs → Veo → Manim. Run /veo with the same\n` +
      `prompt to use Google Veo via GEMINI_API_KEY instead.\n` +
      `\n` +
      `Server response (first 400 chars): ${bodyText.slice(0, 400)}`,
  );
  process.exit(2);
}

type StartResponse = {
  id?: string;
  operation_id?: string;
  generation_id?: string;
  status?: string;
};

type StatusResponse = {
  status?: 'pending' | 'queued' | 'running' | 'in_progress' | 'completed' | 'succeeded' | 'failed' | 'error' | string;
  done?: boolean;
  error?: { message?: string };
  videos?: Array<{ url?: string; base64?: string; mime_type?: string }>;
  output?: { url?: string; base64?: string; mime_type?: string } | null;
  result?: { videos?: Array<{ url?: string; base64?: string; mime_type?: string }> };
};

async function start(): Promise<string> {
  const res = await fetch(generateUrl, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (isAccessDenied(res.status)) reportAccessDenied(res.status, text);
  if (!res.ok) {
    throw new Error(`Submit failed (${res.status}): ${text.slice(0, 500)}`);
  }
  let json: StartResponse;
  try {
    json = JSON.parse(text) as StartResponse;
  } catch {
    throw new Error(`Submit returned non-JSON: ${text.slice(0, 200)}`);
  }
  const id = json.id ?? json.operation_id ?? json.generation_id;
  if (!id) throw new Error(`No operation id in response: ${JSON.stringify(json).slice(0, 300)}`);
  return id;
}

const TERMINAL_OK = new Set(['completed', 'succeeded', 'finished', 'done']);
const TERMINAL_FAIL = new Set(['failed', 'error', 'rejected', 'cancelled', 'canceled']);

async function poll(id: string): Promise<StatusResponse> {
  const intervalMs = Math.max(1, parseFloat(opts.pollInterval)) * 1000;
  let elapsed = 0;
  while (true) {
    await new Promise((r) => setTimeout(r, intervalMs));
    elapsed += intervalMs / 1000;
    process.stderr.write(`\r[elevenlabs-video] polling… ${elapsed.toFixed(0)}s`);
    const res = await fetch(statusUrl(id), { headers: { 'xi-api-key': apiKey! } });
    const text = await res.text();
    if (isAccessDenied(res.status)) reportAccessDenied(res.status, text);
    if (!res.ok) throw new Error(`\nPoll failed (${res.status}): ${text.slice(0, 300)}`);
    let json: StatusResponse;
    try {
      json = JSON.parse(text) as StatusResponse;
    } catch {
      throw new Error(`\nPoll returned non-JSON: ${text.slice(0, 200)}`);
    }
    const status = (json.status ?? '').toLowerCase();
    if (json.done || TERMINAL_OK.has(status)) {
      process.stderr.write('\n');
      return json;
    }
    if (TERMINAL_FAIL.has(status)) {
      process.stderr.write('\n');
      throw new Error(`Generation ${status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 300)}`);
    }
  }
}

function extractVideos(s: StatusResponse): Array<{ url?: string; base64?: string; mime?: string }> {
  const out: Array<{ url?: string; base64?: string; mime?: string }> = [];
  for (const v of s.videos ?? []) out.push({ url: v.url, base64: v.base64, mime: v.mime_type });
  for (const v of s.result?.videos ?? []) out.push({ url: v.url, base64: v.base64, mime: v.mime_type });
  if (s.output) out.push({ url: s.output.url, base64: s.output.base64, mime: s.output.mime_type });
  if (out.length === 0) {
    throw new Error(
      `Generation completed but contained no videos. Raw: ${JSON.stringify(s).slice(0, 500)}`,
    );
  }
  return out;
}

function resolveOutputPaths(n: number): string[] {
  const base = opts.out ?? defaultOutPath();
  if (n === 1) {
    fs.mkdirSync(path.dirname(base), { recursive: true });
    return [base];
  }
  const dir = base.endsWith('.mp4') ? base.replace(/\.mp4$/, '') : base;
  fs.mkdirSync(dir, { recursive: true });
  return Array.from({ length: n }, (_, i) =>
    path.join(dir, `video-${String(i + 1).padStart(2, '0')}.mp4`),
  );
}

async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url, { headers: { 'xi-api-key': apiKey! } });
  if (!res.ok) {
    // Some signed URLs reject auth headers. Retry plain.
    const r2 = await fetch(url);
    if (!r2.ok) throw new Error(`download failed (${res.status}): ${url}`);
    fs.writeFileSync(outPath, Buffer.from(await r2.arrayBuffer()));
    return;
  }
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
}

async function main(): Promise<void> {
  console.log(
    `[elevenlabs-video] model=${resolvedModelId} aspect=${opts.aspect} duration=${duration}s count=${sampleCount}`,
  );
  console.log(`[elevenlabs-video] endpoint=${generateUrl}`);
  console.log(
    `[elevenlabs-video] prompt: ${prompt.slice(0, 140)}${prompt.length > 140 ? '…' : ''}`,
  );

  const id = await start();
  console.log(`[elevenlabs-video] operation started: ${id}`);

  const final = await poll(id);
  const videos = extractVideos(final);
  const outPaths = resolveOutputPaths(videos.length);

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const outPath = outPaths[i];
    if (!v || !outPath) continue;
    if (v.base64) {
      fs.writeFileSync(outPath, Buffer.from(v.base64, 'base64'));
    } else if (v.url) {
      await downloadToFile(v.url, outPath);
    } else {
      console.warn(`[elevenlabs-video] video ${i + 1}: no bytes and no url — skipping`);
      continue;
    }
    const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
    console.log(`[elevenlabs-video] wrote ${outPath} (${sizeMb} MB)`);
  }
}

main().catch((err) => {
  console.error(`\n[elevenlabs-video] error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
