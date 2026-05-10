#!/usr/bin/env tsx
/**
 * migrate-manifest-v2 — convert a v1 (segments-only) manifest into the v2
 * schema (voice + visualBlocks) and persist it. For each visualBlock, mine the
 * relevant beats' [MANIM: name description="..."] cues out of script.md and
 * concatenate them into the block's description metadata.
 *
 * Usage: npm run migrate-manifest-v2 -- <slug>
 */

import { Command } from 'commander';
import fs from 'node:fs';
import { readManifestRaw, migrateToV2, writeManifest, manifestPath } from '../lib/manifest.js';
import { parseScript } from '../lib/script.js';

const program = new Command().name('migrate-manifest-v2').argument('<slug>');
program.parse();
const [slug] = program.args as [string];

const raw = readManifestRaw(slug);
// Force re-coalesce even if the manifest already has voice/visualBlocks: the
// coalescer rules evolve (e.g. when generalized beyond manimClip) and we want
// `npm run migrate-manifest-v2` to be the canonical "rebuild from segments" tool.
const v2 = migrateToV2({ ...raw, voice: [], visualBlocks: [] });

// Index beats from script.md by id so we can mine descriptions.
const script = parseScript(slug);
const beatById = new Map(script.beats.map((b) => [b.id, b]));

// Each VoiceBeat in v2 corresponds 1:1 to a script beat (or to a former silent
// segment). Build a map of beat -> visualBlock that "contains" it (by frame
// overlap), so we can attribute descriptions correctly.
const blockForBeat = new Map<string, string>(); // beatId -> blockId
for (const beat of v2.voice) {
  const beatStart = beat.startFrame;
  const beatEnd = beat.startFrame + beat.durationFrames;
  for (const block of v2.visualBlocks) {
    const bStart = block.startFrame;
    const bEnd = block.startFrame + block.durationFrames;
    // Beat falls inside this block if its midpoint is within [bStart, bEnd).
    const mid = (beatStart + beatEnd) / 2;
    if (mid >= bStart && mid < bEnd) {
      blockForBeat.set(beat.id, block.id);
      break;
    }
  }
}

// Aggregate descriptions per block.
const descByBlock = new Map<string, string[]>();
for (const [beatId, blockId] of blockForBeat) {
  const beat = beatById.get(beatId);
  if (!beat) continue;
  const desc = extractDescription(beatVisualCue(beat));
  if (desc) {
    if (!descByBlock.has(blockId)) descByBlock.set(blockId, []);
    descByBlock.get(blockId)!.push(desc);
  }
}

// Stitch descriptions into the blocks; also attach a `text` summary on each
// voice beat (the narration line) for debuggability.
const blocks = v2.visualBlocks.map((block) => {
  const parts = descByBlock.get(block.id) ?? [];
  // Dedupe consecutive identical descriptions (when a single beat's cue echoes
  // a sibling, no need to repeat).
  const dedup: string[] = [];
  for (const p of parts) {
    if (dedup[dedup.length - 1] !== p) dedup.push(p);
  }
  const description =
    dedup.length === 0
      ? block.description
      : dedup.length === 1
        ? dedup[0]!
        : dedup.map((p, i) => `${i + 1}. ${p}`).join('\n');
  return { ...block, description };
});

const voice = v2.voice.map((vb) => {
  const beat = beatById.get(vb.id);
  if (beat && beat.kind === 'narrated') {
    return { ...vb, text: beat.narration };
  }
  return vb;
});

const out = { ...v2, schemaVersion: 2 as const, visualBlocks: blocks, voice };
writeManifest(slug, out);

console.log(
  JSON.stringify(
    {
      slug,
      manifest: manifestPath(slug),
      schemaVersion: 2,
      voiceBeats: out.voice.length,
      visualBlocks: out.visualBlocks.length,
      blocksWithDescriptions: blocks.filter((b) => b.description.length > 0).length,
      describedManimBlocks: blocks.filter(
        (b) => b.visual.kind === 'manimClip' && b.description.length > 0,
      ).length,
    },
    null,
    2,
  ),
);

// ---------------------------------------------------------------------------

function beatVisualCue(beat: ReturnType<typeof parseScript>['beats'][number]): string | null {
  if (beat.kind === 'narrated' || beat.kind === 'silentDisplay') return beat.visualCue;
  return null;
}

function extractDescription(cue: string | null): string | null {
  if (!cue) return null;
  const m = cue.match(/description="([^"]+)"/);
  return m ? m[1]! : null;
}
