#!/usr/bin/env tsx
/**
 * sync-manifest — incremental, live-preview manifest rebuild.
 *
 * Usage:
 *   npm run sync-manifest -- <slug>
 *
 * Walks `videos/<slug>/script.md`, includes every beat whose narration
 * (mp3 + timestamps) is on disk, swaps any Manim cue whose mp4 isn't
 * rendered yet for a "Rendering: <scene>…" placeholder titleCard, and
 * writes the result to `videos/<slug>/manifest.json`.
 *
 * Idempotent. Cheap to call. Designed for the producer + visualizer to
 * call after EVERY single beat operation so the editor's chokidar watcher
 * fires `preview:reload` and the player materializes new beats live.
 *
 * Prints a one-line summary so the agent (and the user reading the chat)
 * can see how many beats are ready out of how many the script has total.
 */

import { Command } from 'commander';
import { rebuildSegmentsFromScript } from '../lib/manifest.js';
import { parseScript } from '../lib/script.js';

const program = new Command()
  .name('sync-manifest')
  .description('Incremental manifest rebuild for live-preview iteration.')
  .argument('<slug>');

program.parse();
const [slug] = program.args as [string];

const updated = await rebuildSegmentsFromScript(slug, { partial: true });
const totalBeats = parseScript(slug).beats.length;
const readyBeats = updated.segments.length;
const totalSeconds = updated.segments.length
  ? (updated.segments[updated.segments.length - 1]!.startFrame +
      updated.segments[updated.segments.length - 1]!.durationFrames) /
    updated.fps
  : 0;
console.log(
  JSON.stringify(
    {
      slug,
      readyBeats,
      totalBeats,
      partialSeconds: Number(totalSeconds.toFixed(2)),
      done: readyBeats === totalBeats,
    },
    null,
    2,
  ),
);
