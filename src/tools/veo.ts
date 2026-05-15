#!/usr/bin/env tsx
/**
 * veo — generate video with Google's Veo model via the REST API.
 *
 * Two backends, auto-detected:
 *   1. Gemini API (default)  — needs GEMINI_API_KEY in .env. Get one at
 *      https://aistudio.google.com/apikey. Endpoint:
 *        https://generativelanguage.googleapis.com/v1beta
 *   2. Vertex AI              — opt-in via --vertex or by setting
 *      GOOGLE_CLOUD_PROJECT. Auth via `gcloud auth print-access-token`.
 *      Endpoint:
 *        https://aiplatform.googleapis.com/v1/projects/<PROJECT>/locations/<LOC>
 *
 * Usage examples:
 *   # text-to-video (Gemini API)
 *   npm run veo -- "A cinematic drone shot over misty mountains at sunrise"
 *
 *   # image-to-video
 *   npm run veo -- "the character turns and walks away" --image ./frame.png
 *
 *   # first + last frame
 *   npm run veo -- "smooth transition" --image ./first.png --last-frame ./last.png
 *
 *   # extend a clip
 *   npm run veo -- "continue the scene" --video ./clip.mp4
 *
 *   # reference images (up to 3 assets, or 1 style ref on veo-2.0-generate-exp)
 *   npm run veo -- "the character walks through a forest" \
 *     --reference ./char.png --reference ./forest.png
 *
 *   # Vertex AI with GCS output
 *   npm run veo -- "a koi pond" --vertex --storage-uri gs://my-bucket/out/
 *
 *   # write into a paper-video folder
 *   npm run veo -- "title splash" --out videos/attention-is-all-you-need/veo/teaser.mp4
 */

import 'dotenv/config';
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { REPO_ROOT } from '../lib/paths.js';

type MaskMode = 'insert' | 'remove' | 'remove_static' | 'outpaint';
type CameraControl =
  | 'fixed'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'truck_left'
  | 'truck_right'
  | 'pedestal_up'
  | 'pedestal_down'
  | 'push_in'
  | 'pull_out';

const VIDEO_EXTS: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
};

const IMAGE_EXTS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

type VeoImage = { bytesBase64Encoded?: string; gcsUri?: string; mimeType: string };
type VeoVideo = { bytesBase64Encoded?: string; gcsUri?: string; mimeType: string };
type VeoMask = VeoImage & { maskMode?: MaskMode };
type VeoReferenceImage = { image: VeoImage };

function inferMime(file: string, kind: 'image' | 'video'): string {
  const ext = path.extname(file).toLowerCase();
  const table = kind === 'image' ? IMAGE_EXTS : VIDEO_EXTS;
  const mime = table[ext];
  if (!mime) throw new Error(`Cannot infer mime for ${file} (unknown extension ${ext})`);
  return mime;
}

function loadImage(file: string): VeoImage {
  if (file.startsWith('gs://') || file.startsWith('https://')) {
    return { gcsUri: file, mimeType: IMAGE_EXTS[path.extname(file).toLowerCase()] ?? 'image/png' };
  }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  return { bytesBase64Encoded: fs.readFileSync(abs).toString('base64'), mimeType: inferMime(abs, 'image') };
}

function loadVideo(file: string): VeoVideo {
  if (file.startsWith('gs://') || file.startsWith('https://')) {
    return { gcsUri: file, mimeType: VIDEO_EXTS[path.extname(file).toLowerCase()] ?? 'video/mp4' };
  }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  return { bytesBase64Encoded: fs.readFileSync(abs).toString('base64'), mimeType: inferMime(abs, 'video') };
}

function defaultOutPath(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const tag = crypto.randomBytes(3).toString('hex');
  return path.join(REPO_ROOT, 'veo-output', `${ts}_${tag}.mp4`);
}

function gcloudToken(): string {
  const r = spawnSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf-8' });
  if (r.status !== 0) {
    throw new Error(`gcloud auth print-access-token failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout.trim();
}

const program = new Command()
  .name('veo')
  .description('Generate video with Veo (Gemini API or Vertex AI REST)')
  .argument('<prompt>', 'text prompt describing the video')
  .option(
    '-m, --model <id>',
    'veo-3.1-generate-preview | veo-3.1-fast-generate-preview | veo-3.1-generate-001 | veo-3.1-lite-generate-preview | veo-2.0-generate-exp',
    'veo-3.1-generate-preview',
  )
  .option('-o, --out <path>', 'output mp4 path (or directory if --count>1)')
  .option('-a, --aspect <ratio>', '16:9 | 9:16 | 1:1', '16:9')
  .option('-d, --duration <seconds>', '4, 6, or 8 (default 8)', '8')
  .option('-r, --resolution <res>', '720p | 1080p | 4k (Veo 3 only)')
  .option('-c, --count <n>', 'number of videos to generate (1-4)', '1')
  .option('--seed <n>', 'random seed for reproducibility')
  .option('--negative <text>', 'negative prompt (what to exclude)')
  .option('--audio', 'request native audio generation (full veo-3.1-generate-preview only; the fast/lite variants reject this field)')
  .option('--no-audio', 'omit the generateAudio field entirely (default — works with every model)')
  .option('--image <path>', 'first frame (local file, gs://, or https://)')
  .option('--last-frame <path>', 'last frame (requires --image)')
  .option('--video <path>', 'input video to extend or edit')
  .option('--mask <path>', 'mask image for video editing (requires --video)')
  .option('--mask-mode <mode>', 'insert | remove | remove_static | outpaint')
  .option(
    '--reference <path>',
    'reference image (repeatable, up to 3 assets or 1 style)',
    (val: string, acc: string[]) => acc.concat(val),
    [] as string[],
  )
  .option('--camera <mode>', 'camera control: fixed | pan_left | pan_right | tilt_up | tilt_down | truck_left | truck_right | pedestal_up | pedestal_down | push_in | pull_out')
  .option('--person-generation <mode>', 'person safety setting')
  .option('--resize-mode <mode>', 'resize mode (Veo 3 image-to-video)')
  .option('--compression-quality <q>', 'output compression quality')
  .option('--storage-uri <gcsUri>', 'GCS bucket for output (Vertex AI). If set, response carries gcsUri instead of bytes.')
  .option('--poll-interval <seconds>', 'how often to poll the operation', '10')
  .option('--enhance-prompt', 'enable prompt enhancement (Veo 2 only)')
  .option('--vertex', 'force Vertex AI backend (requires gcloud + GOOGLE_CLOUD_PROJECT)')
  .option('--gemini', 'force Gemini API backend (requires GEMINI_API_KEY)')
  .option('--project <id>', 'GCP project id (Vertex). Defaults to $GOOGLE_CLOUD_PROJECT')
  .option('--location <loc>', 'GCP location (Vertex)', 'us-central1')
  .option('--print-only', 'print resolved request and exit (no API call)');

program.parse();
const opts = program.opts<{
  model: string;
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
  video?: string;
  mask?: string;
  maskMode?: MaskMode;
  reference: string[];
  camera?: CameraControl;
  personGeneration?: string;
  resizeMode?: string;
  compressionQuality?: string;
  storageUri?: string;
  pollInterval: string;
  enhancePrompt?: boolean;
  vertex?: boolean;
  gemini?: boolean;
  project?: string;
  location: string;
  printOnly?: boolean;
}>();

const [prompt] = program.args as [string];

// ---- validate -----------------------------------------------------------
if (opts.lastFrame && !opts.image) throw new Error('--last-frame requires --image');
if (opts.image && opts.video) throw new Error('--image and --video are mutually exclusive');
if (opts.mask && !opts.video) throw new Error('--mask requires --video');
if (opts.reference.length > 3) throw new Error('Up to 3 reference images allowed');
const usingReferences = opts.reference.length > 0;
if (usingReferences && (opts.image || opts.video || opts.lastFrame)) {
  throw new Error('--reference cannot be combined with --image, --last-frame, or --video');
}
if (opts.vertex && opts.gemini) throw new Error('Choose --vertex OR --gemini, not both');
const duration = parseInt(opts.duration, 10);
if (![4, 6, 8].includes(duration)) throw new Error('--duration must be 4, 6, or 8');
const sampleCount = parseInt(opts.count, 10);
if (sampleCount < 1 || sampleCount > 4) throw new Error('--count must be 1-4');

// ---- pick backend -------------------------------------------------------
const project = opts.project ?? process.env.GOOGLE_CLOUD_PROJECT;
const useVertex = opts.vertex || (!opts.gemini && !process.env.GEMINI_API_KEY && !!project);
const useGemini = !useVertex;

if (useVertex && !project) {
  throw new Error('Vertex AI backend selected but no project id. Pass --project or set GOOGLE_CLOUD_PROJECT.');
}
if (useGemini && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
  throw new Error(
    'Gemini API backend selected but no GEMINI_API_KEY in .env. Get one at https://aistudio.google.com/apikey, or pass --vertex with a GOOGLE_CLOUD_PROJECT.',
  );
}

// ---- build instance + parameters ---------------------------------------
const instance: Record<string, unknown> = { prompt };
if (opts.image) instance.image = loadImage(opts.image);
if (opts.lastFrame) instance.lastFrame = loadImage(opts.lastFrame);
if (opts.video) instance.video = loadVideo(opts.video);
if (opts.mask) {
  const mask: VeoMask = loadImage(opts.mask);
  if (opts.maskMode) mask.maskMode = opts.maskMode;
  instance.mask = mask;
}
if (usingReferences) {
  instance.referenceImages = opts.reference.map<VeoReferenceImage>((p) => ({ image: loadImage(p) }));
}
if (opts.camera) instance.cameraControl = opts.camera;

const parameters: Record<string, unknown> = {
  aspectRatio: opts.aspect,
  durationSeconds: duration,
  sampleCount,
};
if (opts.audio !== undefined) parameters.generateAudio = opts.audio;
if (opts.resolution) parameters.resolution = opts.resolution;
if (opts.seed !== undefined) parameters.seed = parseInt(opts.seed, 10);
if (opts.negative) parameters.negativePrompt = opts.negative;
if (opts.personGeneration) parameters.personGeneration = opts.personGeneration;
if (opts.resizeMode) parameters.resizeMode = opts.resizeMode;
if (opts.compressionQuality) parameters.compressionQuality = opts.compressionQuality;
if (opts.storageUri) parameters.storageUri = opts.storageUri;
if (opts.enhancePrompt) parameters.enhancePrompt = true;

const body = { instances: [instance], parameters };

if (opts.printOnly) {
  // Redact giant base64 strings.
  const redacted = JSON.parse(
    JSON.stringify(body, (k, v) =>
      k === 'bytesBase64Encoded' && typeof v === 'string' ? `<base64 ${v.length} chars>` : v,
    ),
  );
  console.log(JSON.stringify({ backend: useVertex ? 'vertex' : 'gemini', model: opts.model, body: redacted }, null, 2));
  process.exit(0);
}

// ---- endpoints + auth ---------------------------------------------------
type Backend = {
  predictUrl: string;
  authHeaders: () => Record<string, string>;
  pollOnce: (opName: string) => Promise<{ done: boolean; raw: unknown }>;
};

function geminiBackend(): Backend {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY!;
  const base = 'https://generativelanguage.googleapis.com/v1beta';
  return {
    predictUrl: `${base}/models/${opts.model}:predictLongRunning`,
    authHeaders: () => ({ 'x-goog-api-key': apiKey }),
    pollOnce: async (opName) => {
      const res = await fetch(`${base}/${opName}`, { headers: { 'x-goog-api-key': apiKey } });
      const json = (await res.json()) as { done?: boolean };
      if (!res.ok) throw new Error(`Poll failed (${res.status}): ${JSON.stringify(json)}`);
      return { done: Boolean(json.done), raw: json };
    },
  };
}

function vertexBackend(): Backend {
  const token = gcloudToken();
  const base = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/${opts.location}`;
  const modelUrl = `${base}/publishers/google/models/${opts.model}`;
  return {
    predictUrl: `${modelUrl}:predictLongRunning`,
    authHeaders: () => ({ Authorization: `Bearer ${token}` }),
    pollOnce: async (opName) => {
      const res = await fetch(`${modelUrl}:fetchPredictOperation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName: opName }),
      });
      const json = (await res.json()) as { done?: boolean };
      if (!res.ok) throw new Error(`Poll failed (${res.status}): ${JSON.stringify(json)}`);
      return { done: Boolean(json.done), raw: json };
    },
  };
}

const backend = useVertex ? vertexBackend() : geminiBackend();

// ---- submit + poll ------------------------------------------------------
type VideoPrediction = {
  bytesBase64Encoded?: string;
  gcsUri?: string;
  mimeType?: string;
  video?: { videoBytes?: string; uri?: string; mimeType?: string };
};
type GeneratedSample = { video?: { videoBytes?: string; uri?: string; mimeType?: string } };
type OperationResponse = {
  done?: boolean;
  name?: string;
  error?: { message?: string; code?: number };
  response?: {
    // Vertex AI shape
    predictions?: VideoPrediction[];
    // @google/genai SDK shape
    generatedVideos?: GeneratedSample[];
    // Gemini REST API shape (response.generateVideoResponse.generatedSamples[])
    generateVideoResponse?: { generatedSamples?: GeneratedSample[] };
    raiMediaFilteredCount?: number;
    raiMediaFilteredReasons?: string[];
  };
};

async function submit(): Promise<string> {
  const res = await fetch(backend.predictUrl, {
    method: 'POST',
    headers: { ...backend.authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { name?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(`Submit failed (${res.status}): ${JSON.stringify(json)}`);
  if (!json.name) throw new Error(`No operation name in response: ${JSON.stringify(json)}`);
  return json.name;
}

async function poll(opName: string): Promise<OperationResponse> {
  const intervalMs = Math.max(1, parseFloat(opts.pollInterval)) * 1000;
  let elapsed = 0;
  while (true) {
    await new Promise((r) => setTimeout(r, intervalMs));
    elapsed += intervalMs / 1000;
    process.stderr.write(`\r[veo] polling… ${elapsed.toFixed(0)}s`);
    const { done, raw } = await backend.pollOnce(opName);
    if (done) {
      process.stderr.write('\n');
      return raw as OperationResponse;
    }
  }
}

function extractVideos(op: OperationResponse): Array<{ bytes?: string; uri?: string; mime?: string }> {
  if (op.error) throw new Error(`Veo operation failed: ${op.error.message ?? JSON.stringify(op.error)}`);
  const resp = op.response ?? {};
  if (resp.raiMediaFilteredCount && resp.raiMediaFilteredCount > 0) {
    const reasons = resp.raiMediaFilteredReasons?.join('; ') ?? 'unspecified';
    console.warn(`[veo] ${resp.raiMediaFilteredCount} sample(s) filtered by safety policy: ${reasons}`);
  }
  // Vertex AI shape: response.predictions[].bytesBase64Encoded
  // Gemini API shape: response.generatedVideos[].video.{videoBytes,uri,mimeType}
  if (resp.predictions && resp.predictions.length > 0) {
    return resp.predictions.map((p) => ({
      bytes: p.bytesBase64Encoded ?? p.video?.videoBytes,
      uri: p.gcsUri ?? p.video?.uri,
      mime: p.mimeType ?? p.video?.mimeType,
    }));
  }
  if (resp.generatedVideos && resp.generatedVideos.length > 0) {
    return resp.generatedVideos.map((g) => ({
      bytes: g.video?.videoBytes,
      uri: g.video?.uri,
      mime: g.video?.mimeType,
    }));
  }
  const samples = resp.generateVideoResponse?.generatedSamples;
  if (samples && samples.length > 0) {
    return samples.map((g) => ({
      bytes: g.video?.videoBytes,
      uri: g.video?.uri,
      mime: g.video?.mimeType,
    }));
  }
  throw new Error(`Operation completed but contained no videos. Raw: ${JSON.stringify(op).slice(0, 500)}`);
}

function resolveOutputPaths(n: number): string[] {
  const base = opts.out ?? defaultOutPath();
  if (n === 1) {
    fs.mkdirSync(path.dirname(base), { recursive: true });
    return [base];
  }
  const dir = base.endsWith('.mp4') ? base.replace(/\.mp4$/, '') : base;
  fs.mkdirSync(dir, { recursive: true });
  return Array.from({ length: n }, (_, i) => path.join(dir, `video-${String(i + 1).padStart(2, '0')}.mp4`));
}

async function downloadFromGeminiFiles(uri: string, outPath: string): Promise<boolean> {
  // Gemini API often returns video URIs that need API key auth to download.
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) return false;
  if (!uri.startsWith('https://')) return false;
  try {
    const res = await fetch(uri, { headers: { 'x-goog-api-key': apiKey }, redirect: 'follow' });
    if (!res.ok) {
      console.warn(`[veo] download failed (${res.status}) for ${uri}`);
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    return true;
  } catch (err) {
    console.warn(`[veo] download error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function main() {
  console.log(`[veo] backend=${useVertex ? 'vertex' : 'gemini'} model=${opts.model} aspect=${opts.aspect} duration=${duration}s count=${sampleCount}`);
  console.log(`[veo] prompt: ${prompt.slice(0, 120)}${prompt.length > 120 ? '…' : ''}`);

  const opName = await submit();
  console.log(`[veo] operation started: ${opName}`);

  const op = await poll(opName);
  const videos = extractVideos(op);
  const outPaths = resolveOutputPaths(videos.length);

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const outPath = outPaths[i];
    if (!v || !outPath) continue;
    if (v.bytes) {
      fs.writeFileSync(outPath, Buffer.from(v.bytes, 'base64'));
      console.log(`[veo] wrote ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
    } else if (v.uri) {
      if (v.uri.startsWith('gs://')) {
        const pointer = outPath.replace(/\.mp4$/, '.uri.txt');
        fs.writeFileSync(pointer, v.uri);
        console.log(`[veo] GCS uri: ${v.uri}`);
        console.log(`[veo] wrote pointer file: ${pointer}`);
        console.log(`[veo] download with: gsutil cp "${v.uri}" "${outPath}"`);
      } else {
        const ok = await downloadFromGeminiFiles(v.uri, outPath);
        if (ok) {
          console.log(`[veo] wrote ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
        } else {
          const pointer = outPath.replace(/\.mp4$/, '.uri.txt');
          fs.writeFileSync(pointer, v.uri);
          console.log(`[veo] uri: ${v.uri}`);
          console.log(`[veo] wrote pointer file: ${pointer}`);
        }
      }
    } else {
      console.warn(`[veo] video ${i + 1}: no bytes and no uri — skipping`);
    }
  }
}

main().catch((err) => {
  console.error(`\n[veo] error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
