#!/usr/bin/env tsx
/**
 * narrate — generate ElevenLabs narration for one beat.
 *
 * Usage:
 *   npm run narrate -- <slug> <beat_id>          # single beat
 *   npm run narrate -- <slug> --all              # every missing narrated beat
 *
 * Reads:
 *   - videos/<slug>/script.md  (beat structure)
 *   - videos/<slug>/config.yaml (voice override)
 *   - references/usage/elevenlabs/voices.yaml
 *
 * Writes:
 *   - videos/<slug>/narration/<beat_id>.mp3
 *   - videos/<slug>/narration/<beat_id>.timestamps.json
 *
 * Request-stitching: `previous_text` and `next_text` are populated automatically
 * from the surrounding narrated beats so prosody flows naturally across cuts.
 *
 * Hits the ElevenLabs REST endpoint directly:
 *   POST /v1/text-to-speech/{voice_id}/with-timestamps
 */

import 'dotenv/config';
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ensureSubdir, videoFile } from '../lib/paths.js';
import { resolveVoice } from '../lib/voices.js';
import { parseScript, narratedBeats } from '../lib/script.js';
import {
  charsToWords,
  audioDurationSeconds,
  type CharTiming,
  type SegmentTimestamps,
  writeTimestamps,
} from '../lib/timeline.js';

// Default silence pads applied around every generated mp3 so beats don't
// feel clipped and the cuts between beats have breathing room. Word
// timestamps are shifted by the leading pad so caption sync stays correct.
// The trailing pad is the dominant gap between consecutive narrated beats:
// 0.9s of trailing silence + the segment-build's 0.2s tail + 0.25s leading
// silence on the next mp3 ≈ 1.35s between speech ends/starts. This is the
// "audios don't step on each other" margin.
const DEFAULT_PAD_LEADING_SEC = 0.25;
const DEFAULT_PAD_TRAILING_SEC = 0.9;

const program = new Command()
  .name('narrate')
  .argument('<slug>')
  .argument('[beat_id]', 'specific beat to render')
  .option('--all', 'generate every missing narrated beat in script.md', false)
  .option('--force', 'overwrite existing audio files', false)
  .option(
    '--pad-leading <seconds>',
    'silence to prepend to each mp3',
    String(DEFAULT_PAD_LEADING_SEC),
  )
  .option(
    '--pad-trailing <seconds>',
    'silence to append to each mp3',
    String(DEFAULT_PAD_TRAILING_SEC),
  );

program.parse();
const opts = program.opts<{
  all: boolean;
  force: boolean;
  padLeading: string;
  padTrailing: string;
}>();
const padLeading = Math.max(0, parseFloat(opts.padLeading));
const padTrailing = Math.max(0, parseFloat(opts.padTrailing));
const [slug, beatArg] = program.args as [string, string | undefined];

const apiKey = process.env['ELEVENLABS_API_KEY'];
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY is not set. Add it to .env (see .env.example).');
  process.exit(1);
}

const cfg = readConfigYaml(slug);
const script = parseScript(slug);
const allNarrated = narratedBeats(script);
const voiceAlias = script.frontmatter.voice ?? cfg.voice ?? 'pharaoh';
const voice = resolveVoice(voiceAlias);

const targets = opts.all || !beatArg ? allNarrated.map((b) => b.id) : [beatArg];

const narrationDir = ensureSubdir(slug, 'narration');

const generated: string[] = [];
for (const beatId of targets) {
  const idx = allNarrated.findIndex((b) => b.id === beatId);
  if (idx === -1) {
    console.error(`Narrated beat "${beatId}" not found in script.md`);
    process.exit(2);
  }
  const beat = allNarrated[idx]!;
  const mp3 = `${narrationDir}/${beatId}.mp3`;
  const ts = `${narrationDir}/${beatId}.timestamps.json`;
  if (fs.existsSync(mp3) && fs.existsSync(ts) && !opts.force) {
    console.log(`skip ${beatId} (already exists)`);
    continue;
  }
  if (beat.narration.length === 0) {
    console.error(`Beat ${beatId} has empty narration. Edit script.md.`);
    continue;
  }
  if (beat.narration.length > 600) {
    console.warn(
      `warn: ${beatId} narration is ${beat.narration.length} chars (>600). Consider splitting.`,
    );
  }

  // Request stitching: pull surrounding narrated beats.
  // Note: eleven_v3 does not currently support previous_text/next_text — the API
  // returns 400 unsupported_model. Skip stitching on v3 to keep TTS working;
  // prosody continuity comes from the per-beat audio tags instead.
  const stitchable = voice.model_id !== 'eleven_v3';
  const prev = stitchable && idx > 0 ? allNarrated[idx - 1]!.narration : undefined;
  const next =
    stitchable && idx < allNarrated.length - 1 ? allNarrated[idx + 1]!.narration : undefined;

  console.log(
    `Synthesizing ${beatId} (${beat.narration.length} chars) [voice=${voiceAlias}, prev=${!!prev}, next=${!!next}] ...`,
  );

  const { audioMp3, charAlignment } = await elevenlabsTTS({
    apiKey,
    voiceId: voice.voice_id,
    modelId: voice.model_id,
    text: beat.narration,
    previousText: prev,
    nextText: next,
    voiceSettings: {
      stability: voice.stability,
      similarity_boost: voice.similarity_boost,
      style: voice.style,
      use_speaker_boost: voice.use_speaker_boost,
    },
    outputFormat: voice.output_format,
  });
  // Pad the raw mp3 with leading + trailing silence (if requested) and
  // shift word timestamps by the leading pad so caption sync stays aligned.
  const paddedMp3 = padMp3(audioMp3, padLeading, padTrailing);
  fs.writeFileSync(mp3, paddedMp3);

  const rawWords = charsToWords(charAlignment);
  // Strip ElevenLabs audio-tag tokens (`[curious]`, `[pause]`, `[serious]`,
  // `[emphasized]`, etc.) from the caption word stream. The tags steer
  // prosody server-side but should never appear on screen — when v3 leaks
  // them into the alignment they'd otherwise show up as visible bracketed
  // "words" in CaptionBar. Also strip leading/trailing bracket-only fragments
  // from a word in case a tag fused with adjacent text without a space.
  const TAG_ONLY = /^\[[^\]]+\]$/;
  const TAG_FRAGMENT = /\[[^\]]+\]/g;
  const words = rawWords
    .filter((w) => !TAG_ONLY.test(w.word))
    .map((w) => ({
      ...w,
      word: w.word.replace(TAG_FRAGMENT, ''),
      start: w.start + padLeading,
      end: w.end + padLeading,
    }))
    .filter((w) => w.word.length > 0);
  const payload: SegmentTimestamps = {
    segmentId: beatId,
    audioDurationSeconds: audioDurationSeconds(words) + padTrailing,
    words,
  };
  writeTimestamps(ts, payload);
  generated.push(beatId);
}

console.log(JSON.stringify({ slug, generated, voiceAlias }, null, 2));

// ---------------------------------------------------------------------------

type ElevenLabsResponse = {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  } | null;
  normalized_alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  } | null;
};

async function elevenlabsTTS(args: {
  apiKey: string;
  voiceId: string;
  modelId: string;
  text: string;
  previousText?: string;
  nextText?: string;
  voiceSettings: Record<string, number | boolean>;
  outputFormat: string;
}): Promise<{ audioMp3: Buffer; charAlignment: CharTiming[] }> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(args.voiceId)}/with-timestamps?output_format=${encodeURIComponent(args.outputFormat)}`;
  const body: Record<string, unknown> = {
    text: args.text,
    model_id: args.modelId,
    voice_settings: args.voiceSettings,
  };
  if (args.previousText) body['previous_text'] = args.previousText;
  if (args.nextText) body['next_text'] = args.nextText;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': args.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs API ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = (await res.json()) as ElevenLabsResponse;
  const audioMp3 = Buffer.from(json.audio_base64, 'base64');
  const align = json.normalized_alignment ?? json.alignment;
  if (!align) throw new Error('ElevenLabs response missing alignment data.');
  const charAlignment: CharTiming[] = align.characters.map((c, i) => ({
    char: c,
    start: align.character_start_times_seconds[i] ?? 0,
    end: align.character_end_times_seconds[i] ?? 0,
  }));
  return { audioMp3, charAlignment };
}

function readConfigYaml(slug: string): { voice?: string } {
  const p = videoFile(slug, 'config.yaml');
  if (!fs.existsSync(p)) return {};
  const data = parseYaml(fs.readFileSync(p, 'utf8')) as { voice?: string };
  return data ?? {};
}

// Prepend `lead` and append `trail` seconds of silence to the given mp3
// buffer using ffmpeg's adelay + apad filters. Returns the padded buffer.
// If both pads are 0 (or ffmpeg is missing), returns the input unchanged.
function padMp3(input: Buffer, lead: number, trail: number): Buffer {
  if (lead <= 0 && trail <= 0) return input;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'narrate-pad-'));
  const inFile = path.join(tmp, 'in.mp3');
  const outFile = path.join(tmp, 'out.mp3');
  fs.writeFileSync(inFile, input);
  // adelay expects ms, applied per channel — `=delays=Nms:all=1` pads the
  // signal start with N ms of silence on every channel. apad with pad_dur
  // appends N seconds of silence to the end of the stream.
  const filters: string[] = [];
  if (lead > 0) filters.push(`adelay=delays=${Math.round(lead * 1000)}:all=1`);
  if (trail > 0) filters.push(`apad=pad_dur=${trail.toFixed(3)}`);
  const args = [
    '-y',
    '-loglevel',
    'error',
    '-i',
    inFile,
    '-af',
    filters.join(','),
    '-c:a',
    'libmp3lame',
    '-q:a',
    '2',
    outFile,
  ];
  const r = spawnSync('ffmpeg', args, { stdio: 'pipe' });
  if (r.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(
      `ffmpeg failed (exit ${r.status}): ${r.stderr?.toString().slice(0, 500) ?? ''}`,
    );
  }
  const out = fs.readFileSync(outFile);
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}
