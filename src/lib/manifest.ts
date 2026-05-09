import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { videoDir, videoFile } from './paths.js';

const BBox = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

const Visual = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('titleCard'), text: z.string(), subtitle: z.string().optional() }),
  z.object({
    kind: z.literal('paperPage'),
    pageIdx: z.number().int().nonnegative(),
    focus: z.enum(['top', 'center', 'bottom', 'all']).default('all'),
    highlightBBox: BBox.optional(),
  }),
  z.object({
    kind: z.literal('highlightedQuote'),
    pageIdx: z.number().int().nonnegative(),
    text: z.string(),
    bbox: BBox.optional(),
  }),
  z.object({
    kind: z.literal('equationCard'),
    equationId: z.string(),
    reveal: z.enum(['stepwise', 'all']).default('all'),
  }),
  z.object({
    kind: z.literal('equationStep'),
    equationId: z.string(),
    step: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('image'),
    assetId: z.string(),
  }),
  z.object({
    kind: z.literal('diagram'),
    assetId: z.string(),
  }),
  z.object({
    kind: z.literal('manimClip'),
    sceneFile: z.string(),
    mp4: z.string(),
    clipDurationFrames: z.number().int().positive().optional(),
  }),
  z.object({ kind: z.literal('pause') }),
]);

const Segment = z.object({
  // Accepts either legacy seg-NNN or new beat-NNN ids.
  id: z.string().regex(/^(beat|seg)-\d{3}$/),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(),
  audioFile: z.string().nullable(), // null for silent pause beats
  timestampsFile: z.string().nullable(),
  visual: Visual,
});

// v2 schema: decouple voice timeline from visual timeline. A visual block can
// span many voice beats; a voice beat can be backed by 1..N visual blocks.
// Pauses, holds, and "stay still while voice continues" all fall out naturally.
const VoiceBeat = z.object({
  id: z.string().regex(/^(beat|seg)-\d{3}$/),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(),
  audioFile: z.string().nullable(),
  timestampsFile: z.string().nullable(),
  text: z.string().optional(), // narration text for reference / debugging
});

const VisualBlock = z.object({
  id: z.string().regex(/^vb-\d{3,}$/),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(),
  // Natural-language description of what the viewer sees during this block.
  // Populated by the storyteller from [MANIM: name description="..."] cues
  // and used by the visualizer to author / hold scenes correctly.
  description: z.string().default(''),
  visual: Visual,
});

const PaperSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('arxiv'), value: z.string(), arxivId: z.string() }),
  z.object({ kind: z.literal('url'), value: z.string() }),
  z.object({ kind: z.literal('local'), value: z.string() }),
]);

export const ManifestSchema = z.object({
  // schemaVersion 2 = decoupled voice + visualBlocks. Absence (or 1) means legacy
  // segments-only; readManifest() migrates v1 → v2 on read.
  schemaVersion: z.literal(2).optional(),
  slug: z.string(),
  paperSource: PaperSourceSchema,
  paperTitle: z.string(),
  voiceAlias: z.string(),
  fps: z.number().int().positive().default(30),
  resolution: z
    .object({ width: z.number().int().positive(), height: z.number().int().positive() })
    .default({ width: 1920, height: 1080 }),
  // Legacy v1 field — kept for backwards compat, but not preferred.
  segments: z.array(Segment).default([]),
  // v2 fields:
  voice: z.array(VoiceBeat).default([]),
  visualBlocks: z.array(VisualBlock).default([]),
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type Segment = z.infer<typeof Segment>;
export type Visual = z.infer<typeof Visual>;
export type VoiceBeat = z.infer<typeof VoiceBeat>;
export type VisualBlock = z.infer<typeof VisualBlock>;

export function manifestPath(slug: string): string {
  return videoFile(slug, 'manifest.json');
}

export function readManifest(slug: string): Manifest {
  const p = manifestPath(slug);
  if (!fs.existsSync(p)) {
    throw new Error(`Manifest missing for slug "${slug}" (${p}). Run /paper-video new first.`);
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const parsed = ManifestSchema.parse(raw);
  // Auto-migrate v1 (segments-only) to v2 (voice + visualBlocks) on read.
  return migrateToV2(parsed);
}

/** Read the manifest exactly as on disk, without v1→v2 auto-migration. */
export function readManifestRaw(slug: string): Manifest {
  const raw = JSON.parse(fs.readFileSync(manifestPath(slug), 'utf8'));
  return ManifestSchema.parse(raw);
}

export function writeManifest(slug: string, manifest: Manifest): void {
  const validated = ManifestSchema.parse(manifest);
  const p = manifestPath(slug);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(validated, null, 2));
}

export function manifestExists(slug: string): boolean {
  return fs.existsSync(manifestPath(slug));
}

export function totalDurationFrames(manifest: Manifest): number {
  // Prefer v2 voice timeline if present, else fall back to legacy segments.
  const tracks = manifest.voice.length > 0 ? manifest.voice : manifest.segments;
  if (tracks.length === 0) return 0;
  const last = tracks[tracks.length - 1]!;
  return last.startFrame + last.durationFrames;
}

/**
 * Migrate a v1 manifest (segments-only) to v2 (voice + visualBlocks) in memory.
 * Voice beats are 1:1 with old segments minus the visual field.
 * VisualBlocks collapse consecutive same-mp4 manimClip segments (and their
 * adjacent pause segments) into single blocks. Other visual kinds (titleCard,
 * equationCard, image, ...) become individual single-segment blocks.
 *
 * Idempotent: if the manifest already has voice/visualBlocks, returns as-is.
 */
export function migrateToV2(manifest: Manifest): Manifest {
  if (manifest.voice.length > 0 && manifest.visualBlocks.length > 0) return manifest;
  if (manifest.segments.length === 0) {
    return { ...manifest, schemaVersion: 2 as const };
  }

  const voice: VoiceBeat[] = manifest.segments.map((s) => ({
    id: s.id,
    startFrame: s.startFrame,
    durationFrames: s.durationFrames,
    audioFile: s.audioFile,
    timestampsFile: s.timestampsFile,
  }));

  const blocks: VisualBlock[] = [];
  let openManimRun: { mp4: string; sceneFile: string; segs: Segment[] } | null = null;
  let blockCounter = 0;
  const nextBlockId = () => `vb-${String(++blockCounter).padStart(3, '0')}`;

  const flushManimRun = () => {
    if (!openManimRun) return;
    const first = openManimRun.segs[0]!;
    const last = openManimRun.segs[openManimRun.segs.length - 1]!;
    blocks.push({
      id: nextBlockId(),
      startFrame: first.startFrame,
      durationFrames: last.startFrame + last.durationFrames - first.startFrame,
      description: '',
      visual: {
        kind: 'manimClip',
        sceneFile: openManimRun.sceneFile,
        mp4: openManimRun.mp4,
      },
    });
    openManimRun = null;
  };

  for (const seg of manifest.segments) {
    const lastSeg = openManimRun ? openManimRun.segs[openManimRun.segs.length - 1] : null;
    const adjacent = lastSeg
      ? lastSeg.startFrame + lastSeg.durationFrames === seg.startFrame
      : false;

    if (seg.visual.kind === 'manimClip') {
      if (openManimRun && adjacent && openManimRun.mp4 === seg.visual.mp4) {
        openManimRun.segs.push(seg);
      } else {
        flushManimRun();
        openManimRun = {
          mp4: seg.visual.mp4,
          sceneFile: seg.visual.sceneFile,
          segs: [seg],
        };
      }
    } else if (seg.visual.kind === 'pause' && openManimRun && adjacent) {
      // Pause inside a manim run extends the block; the held mp4 keeps showing.
      openManimRun.segs.push(seg);
    } else {
      flushManimRun();
      blocks.push({
        id: nextBlockId(),
        startFrame: seg.startFrame,
        durationFrames: seg.durationFrames,
        description: '',
        visual: seg.visual,
      });
    }
  }
  flushManimRun();

  return {
    ...manifest,
    schemaVersion: 2 as const,
    voice,
    visualBlocks: blocks,
  };
}

export function defaultManifest(args: {
  slug: string;
  paperSource: Manifest['paperSource'];
  paperTitle: string;
  voiceAlias: string;
}): Manifest {
  return ManifestSchema.parse({
    ...args,
    fps: 30,
    resolution: { width: 1920, height: 1080 },
    segments: [],
  });
}

export function videoOutputPath(slug: string): string {
  return videoFile(slug, 'output.mp4');
}

export function videoPublicDir(slug: string): string {
  return path.join(videoDir(slug), 'public');
}

/**
 * Walk script.md beats + per-beat timestamps and rebuild manifest.segments with
 * accurate frame ranges. Pause beats use their declared duration; narrated
 * beats use the audio duration from their timestamps file.
 */
export async function rebuildSegmentsFromScript(slug: string): Promise<Manifest> {
  const { parseScript } = await import('./script.js');
  const { readTimestamps, secondsToFrames } = await import('./timeline.js');
  const script = parseScript(slug);
  const manifest = readManifest(slug);
  const fps = manifest.fps;
  const segments: Segment[] = [];
  let cursor = 0;
  for (const beat of script.beats) {
    if (beat.kind === 'pause') {
      const durationFrames = Math.max(1, secondsToFrames(beat.durationSeconds, fps));
      segments.push({
        id: beat.id,
        startFrame: cursor,
        durationFrames,
        audioFile: null,
        timestampsFile: null,
        visual: { kind: 'pause' },
      });
      cursor += durationFrames;
      continue;
    }
    if (beat.kind === 'silentDisplay') {
      const durationFrames = Math.max(1, secondsToFrames(beat.durationSeconds, fps));
      segments.push({
        id: beat.id,
        startFrame: cursor,
        durationFrames,
        audioFile: null,
        timestampsFile: null,
        visual: parseVisualCue(beat.visualCue),
      });
      cursor += durationFrames;
      continue;
    }
    const tsPath = videoFile(slug, 'narration', `${beat.id}.timestamps.json`);
    if (!fs.existsSync(tsPath)) {
      throw new Error(`Missing timestamps for ${beat.id}: ${tsPath}. Run narrate.ts first.`);
    }
    const ts = readTimestamps(tsPath);
    // Add 200ms tail so visual settles after voice ends.
    const durationFrames = Math.max(1, secondsToFrames(ts.audioDurationSeconds + 0.2, fps));
    const visual = parseVisualCue(beat.visualCue);
    segments.push({
      id: beat.id,
      startFrame: cursor,
      durationFrames,
      audioFile: `narration/${beat.id}.mp3`,
      timestampsFile: `narration/${beat.id}.timestamps.json`,
      visual,
    });
    cursor += durationFrames;
  }
  const updated: Manifest = { ...manifest, segments };
  writeManifest(slug, updated);
  return updated;
}

function parseVisualCue(cue: string): Visual {
  const m = cue.trim().match(/^\[(VISUAL|MANIM):\s*(.+)\]$/i);
  if (!m) {
    return { kind: 'titleCard', text: '(missing cue)' };
  }
  const kindTag = m[1]!.toUpperCase();
  const body = m[2]!.trim();

  if (kindTag === 'MANIM') {
    const rawName = body.split(/\s+/)[0]!;
    const sceneName = rawName.replace(/[^A-Za-z0-9_]/g, '_');
    return {
      kind: 'manimClip',
      sceneFile: `manim/${sceneName}.py`,
      mp4: `manim/${sceneName}.mp4`,
    };
  }

  const head = body.split(/\s+/)[0]!.toLowerCase();
  const args = parseKVArgs(body.slice(head.length).trim());

  switch (head) {
    case 'titlecard':
      return {
        kind: 'titleCard',
        text: args['text'] ?? args._text ?? body.slice(head.length).trim().replace(/^"|"$/g, ''),
        subtitle: args['subtitle'],
      };
    case 'paperpage':
      return {
        kind: 'paperPage',
        pageIdx: Number(args['page'] ?? 1) - 1,
        focus: (args['focus'] ?? 'all') as 'top' | 'center' | 'bottom' | 'all',
        ...(parseBBox(args['highlight']) ? { highlightBBox: parseBBox(args['highlight'])! } : {}),
      };
    case 'highlightedquote':
      return {
        kind: 'highlightedQuote',
        pageIdx: Number(args['pageIdx'] ?? 0),
        text: args['text'] ?? args._text ?? '',
        ...(parseBBox(args['bbox']) ? { bbox: parseBBox(args['bbox'])! } : {}),
      };
    case 'equationcard':
      return {
        kind: 'equationCard',
        equationId: args['equationId'] ?? 'eq-001',
        reveal: (args['reveal'] ?? 'all') as 'stepwise' | 'all',
      };
    case 'equationstep':
      return {
        kind: 'equationStep',
        equationId: args['equationId'] ?? 'eq-001',
        step: Number(args['step'] ?? 0),
      };
    case 'image':
      return { kind: 'image', assetId: args['src'] ?? args._text ?? 'img-001' };
    case 'diagram':
      return { kind: 'diagram', assetId: args['src'] ?? args._text ?? 'diag-001' };
    case 'pause':
      return { kind: 'pause' };
    default:
      return { kind: 'titleCard', text: body };
  }
}

/** Parse a "x,y,w,h" string into a normalized bbox in [0,1]. Returns null if invalid. */
function parseBBox(s: string | undefined): { x: number; y: number; w: number; h: number } | null {
  if (!s) return null;
  const parts = s.split(',').map((n) => Number(n.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  const [x, y, w, h] = parts as [number, number, number, number];
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.001 || y + h > 1.001) return null;
  return { x, y, w, h };
}

function parseKVArgs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Capture all quoted strings first (assigned to a key if preceded by `key=`,
  // else stored under _text).
  const kvQuoted = [...s.matchAll(/(\w+)="([^"]*)"/g)];
  for (const m of kvQuoted) {
    out[m[1]!] = m[2]!;
    s = s.replace(m[0]!, '');
  }
  const bareQuoted = s.match(/"([^"]*)"/);
  if (bareQuoted) {
    out['_text'] = bareQuoted[1]!;
    s = s.replace(bareQuoted[0]!, '');
  }
  for (const m of s.matchAll(/(\w+)=([^\s]+)/g)) {
    out[m[1]!] = m[2]!;
  }
  return out;
}
