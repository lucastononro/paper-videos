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
    // The text on the page that this beat is about. Optional; when set, the
    // harness resolves `highlightBBox` from the PDF text layer (see
    // src/lib/resolve-bbox.ts) — far more reliable than the storyteller
    // guessing pixel coordinates.
    quote: z.string().optional(),
    highlightBBox: BBox.optional(),
    // When true and a highlightBBox exists, the renderer crops to the bbox
    // (with padding) and scales it up to fill the canvas instead of dimming
    // the rest of the page. Useful when the highlight is small text on a
    // dense page.
    zoom: z.boolean().optional(),
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
  // Render the bottom CaptionBar over the video. Default false because most
  // viewers prefer narration alone; the user opts in at /paper-video new time.
  captions: z.boolean().default(false),
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
 * VisualBlocks coalesce **all** kinds of consecutive same-content visuals into
 * single blocks: same-mp4 manimClips, same-page paperPages with the same focus
 * + highlightBBox, same-id images / diagrams, same-equation equationCards (full
 * reveal), identical titleCards. An interleaved `pause` whose surrounding
 * visuals match continues the run (the visual keeps showing during silence).
 * Pauses that don't bridge same-content runs become solo pause blocks.
 *
 * Why this matters: BlockFade in PaperExplainerCore fades to navy at every
 * block boundary. If the storyteller emits the same visual cue across N
 * consecutive narrated beats without coalescing, you get N visible flashes
 * even though the content is identical. The coalescer eliminates those
 * spurious fades while preserving genuine scene changes.
 *
 * Things that NEVER coalesce: equationStep (each step is a deliberate moment),
 * pause (silence is intentional). highlightedQuote coalesces only on exact text
 * match (rare, but consistent).
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
  let blockCounter = 0;
  const nextBlockId = () => `vb-${String(++blockCounter).padStart(3, '0')}`;

  const isAdjacent = (a: Segment, b: Segment): boolean =>
    a.startFrame + a.durationFrames === b.startFrame;

  const pushBlockFromSegs = (visual: Visual, segs: Segment[]): void => {
    const first = segs[0]!;
    const last = segs[segs.length - 1]!;
    blocks.push({
      id: nextBlockId(),
      startFrame: first.startFrame,
      durationFrames: last.startFrame + last.durationFrames - first.startFrame,
      description: '',
      visual,
    });
  };

  const segs = manifest.segments;
  let i = 0;
  while (i < segs.length) {
    const seg = segs[i]!;

    // Pause segments stand alone unless they bridge two same-fingerprint
    // visuals (handled inside the run grow-loop below).
    if (seg.visual.kind === 'pause') {
      pushBlockFromSegs(seg.visual, [seg]);
      i += 1;
      continue;
    }

    const fp = visualKey(seg.visual);
    if (fp === null) {
      // Never-coalesce kind (e.g. equationStep). Solo block.
      pushBlockFromSegs(seg.visual, [seg]);
      i += 1;
      continue;
    }

    // Try to grow a run of same-fingerprint segments, optionally bridging
    // contiguous pauses if a same-fingerprint segment follows them.
    const runSegs: Segment[] = [seg];
    let j = i + 1;
    while (j < segs.length) {
      const nxt = segs[j]!;
      const prev = runSegs[runSegs.length - 1]!;
      if (!isAdjacent(prev, nxt)) break;

      if (nxt.visual.kind === 'pause') {
        // Look past contiguous pauses for the next non-pause; only absorb if
        // it continues the same fingerprint and is adjacent.
        let k = j + 1;
        while (k < segs.length && segs[k]!.visual.kind === 'pause' && isAdjacent(segs[k - 1]!, segs[k]!)) {
          k += 1;
        }
        const peek = k < segs.length ? segs[k]! : null;
        if (
          peek &&
          peek.visual.kind !== 'pause' &&
          isAdjacent(segs[k - 1]!, peek) &&
          visualKey(peek.visual) === fp
        ) {
          for (let p = j; p <= k; p += 1) runSegs.push(segs[p]!);
          j = k + 1;
          continue;
        }
        break;
      }

      if (visualKey(nxt.visual) === fp) {
        runSegs.push(nxt);
        j += 1;
        continue;
      }
      break;
    }

    pushBlockFromSegs(seg.visual, runSegs);
    i = j;
  }

  return {
    ...manifest,
    schemaVersion: 2 as const,
    voice,
    visualBlocks: blocks,
  };
}

/**
 * Fingerprint a visual for the coalescer. Two adjacent visuals with the same
 * fingerprint string merge into a single visual block — fewer block boundaries
 * means fewer BlockFade flashes for the same content. Returns `null` for kinds
 * that should never coalesce (equationStep, pause).
 */
function visualKey(v: Visual): string | null {
  switch (v.kind) {
    case 'manimClip':
      return `manim:${v.mp4}`;
    case 'paperPage': {
      const bb = v.highlightBBox;
      const bbKey = bb ? `${bb.x},${bb.y},${bb.w},${bb.h}` : '_';
      const zoomKey = v.zoom ? 'z' : '_';
      return `paperPage:${v.pageIdx}:${v.focus}:${bbKey}:${zoomKey}`;
    }
    case 'highlightedQuote': {
      const bb = v.bbox;
      const bbKey = bb ? `${bb.x},${bb.y},${bb.w},${bb.h}` : '_';
      return `quote:${v.pageIdx}:${bbKey}:${v.text}`;
    }
    case 'equationCard':
      // Full-reveal equation cards can hold across beats; stepwise reveals are
      // deliberately per-step, so don't coalesce them.
      return v.reveal === 'all' ? `eq:${v.equationId}` : null;
    case 'equationStep':
      return null;
    case 'image':
      return `image:${v.assetId}`;
    case 'diagram':
      return `diagram:${v.assetId}`;
    case 'titleCard':
      return `title:${v.text}|${v.subtitle ?? ''}`;
    case 'pause':
      return null;
  }
}

export function defaultManifest(args: {
  slug: string;
  paperSource: Manifest['paperSource'];
  paperTitle: string;
  voiceAlias: string;
  captions?: boolean;
}): Manifest {
  return ManifestSchema.parse({
    ...args,
    fps: 30,
    resolution: { width: 1920, height: 1080 },
    segments: [],
    captions: args.captions ?? false,
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
 *
 * Modes:
 *   - default (`partial:false`): every narrated beat MUST have its mp3 +
 *     timestamps; missing files throw. Used at the end of the producer
 *     pipeline as a final consistency check.
 *
 *   - `partial:true`: incremental / live-preview mode. Stops including beats
 *     at the first one whose audio isn't ready yet — the timeline truncates
 *     cleanly at the last finished beat. If a Manim mp4 referenced by an
 *     included beat is still missing, the visual falls back to a "Rendering:
 *     <scene>" titleCard so the voice can play and the user sees the gap.
 *     Used by `npm run sync-manifest -- <slug>` after every per-beat narrate
 *     or render-manim, so the editor's chokidar watcher can fire
 *     preview:reload and the player materializes new beats live.
 */
export async function rebuildSegmentsFromScript(
  slug: string,
  options: { partial?: boolean } = {},
): Promise<Manifest> {
  const { partial = false } = options;
  const { parseScript } = await import('./script.js');
  const { readTimestamps, secondsToFrames } = await import('./timeline.js');
  const { resolveBBox } = await import('./resolve-bbox.js');

  // Resolve a paperPage / highlightedQuote visual's bbox from its quote text
  // when one is present and no manual bbox was provided. Misses log a warning
  // and leave the visual without a highlight.
  const enrichVisual = async (v: Visual): Promise<Visual> => {
    if (v.kind === 'paperPage' && v.quote && !v.highlightBBox) {
      const bbox = await resolveBBox(slug, v.pageIdx + 1, v.quote);
      if (bbox) return { ...v, highlightBBox: bbox };
      console.warn(
        `[resolve-bbox] quote not found on page ${v.pageIdx + 1}: "${v.quote.slice(0, 80)}…"`,
      );
      return v;
    }
    if (v.kind === 'highlightedQuote' && v.text && !v.bbox) {
      const bbox = await resolveBBox(slug, v.pageIdx + 1, v.text);
      if (bbox) return { ...v, bbox };
      console.warn(
        `[resolve-bbox] highlightedQuote text not found on page ${v.pageIdx + 1}: "${v.text.slice(0, 80)}…"`,
      );
      return v;
    }
    return v;
  };

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
        visual: await enrichVisual(parseVisualCue(beat.visualCue)),
      });
      cursor += durationFrames;
      continue;
    }
    const tsPath = videoFile(slug, 'narration', `${beat.id}.timestamps.json`);
    const mp3Path = videoFile(slug, 'narration', `${beat.id}.mp3`);
    const ready = fs.existsSync(tsPath) && fs.existsSync(mp3Path);
    if (!ready) {
      if (partial) {
        // Live-preview mode: truncate the timeline at the last ready beat so
        // the player gets a clean partial video to scrub. Subsequent beats
        // will materialize as future syncs after their audio lands.
        break;
      }
      throw new Error(`Missing timestamps for ${beat.id}: ${tsPath}. Run narrate.ts first.`);
    }
    const ts = readTimestamps(tsPath);
    // Add 200ms tail so visual settles after voice ends.
    const durationFrames = Math.max(1, secondsToFrames(ts.audioDurationSeconds + 0.2, fps));
    let visual = await enrichVisual(parseVisualCue(beat.visualCue));
    // In partial mode, if the visual references a Manim mp4 that hasn't
    // rendered yet, swap in a "Rendering…" placeholder card so the voice
    // beat still plays — the visualizer will replace it on its next sync.
    if (partial && visual.kind === 'manimClip') {
      const mp4Path = videoFile(slug, visual.mp4);
      if (!fs.existsSync(mp4Path)) {
        const sceneName = visual.mp4.replace(/^manim\//, '').replace(/\.mp4$/, '');
        visual = { kind: 'titleCard', text: `Rendering: ${sceneName}…` };
      }
    }
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
  // Clear stale v2 fields so migrateToV2 rebuilds them from the fresh
  // segments — otherwise its idempotency guard returns the old voice /
  // visualBlocks and incremental syncs never propagate to the player.
  const updated: Manifest = migrateToV2({
    ...manifest,
    segments,
    voice: [],
    visualBlocks: [],
    schemaVersion: undefined,
  });
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
        // `quote=` is the preferred way to highlight: the harness resolves
        // the bbox from the PDF text layer at manifest-build time. Manual
        // `highlight=x,y,w,h` is supported for back-compat / edge cases.
        ...(args['quote'] ? { quote: args['quote'] } : {}),
        ...(parseBBox(args['highlight']) ? { highlightBBox: parseBBox(args['highlight'])! } : {}),
        ...(args['zoom'] === 'true' || args['zoom'] === '1' ? { zoom: true } : {}),
      };
    case 'highlightedquote': {
      // `pageIdx=N` is 0-indexed (legacy convention); `page=N` is 1-indexed.
      // Use whichever the storyteller emitted without changing its meaning.
      const pageIdx =
        args['pageIdx'] !== undefined
          ? Number(args['pageIdx'])
          : Math.max(0, Number(args['page'] ?? 1) - 1);
      return {
        kind: 'highlightedQuote',
        pageIdx,
        text: args['text'] ?? args._text ?? '',
        ...(parseBBox(args['bbox']) ? { bbox: parseBBox(args['bbox'])! } : {}),
      };
    }
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
