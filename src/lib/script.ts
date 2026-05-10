import fs from 'node:fs';
import { videoFile } from './paths.js';

export type ScriptFrontmatter = {
  slug: string;
  voice?: string;
  target_minutes?: number;
};

/**
 * A beat is the atomic unit. Three kinds:
 *  - narrated: has narration text + a visual/manim cue (TTS audio + visual)
 *  - pause: silent dark frame for breath (no visual, no audio)
 *  - silentDisplay: visual shown for a fixed duration with no audio (e.g. title cards)
 */
export type Beat =
  | {
      kind: 'narrated';
      id: string;
      heading: string;
      visualCue: string;
      narration: string;
    }
  | {
      kind: 'pause';
      id: string;
      heading: string;
      durationSeconds: number;
    }
  | {
      kind: 'silentDisplay';
      id: string;
      heading: string;
      visualCue: string;
      durationSeconds: number;
    };

export type ParsedScript = {
  frontmatter: ScriptFrontmatter;
  title: string | null;
  beats: Beat[];
};

const FM_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;
// Beat heading: `### beat-NNN` optionally followed by ` | <metadata> | ...`
// (e.g. `### beat-001 | act-0 | est. 7.5 sec`). The metadata is informational
// only — the parser keeps just the `beat-NNN` id.
const BEAT_RE = /^###\s+(beat-\d{3})(?:\s*\|.*)?\s*$/;
const ACT_RE = /^##\s+(.+)$/;
const TITLE_RE = /^#\s+(.+)$/;
// VISUAL/MANIM use colon (e.g. `[VISUAL: titleCard ...]`); PAUSE is bare (e.g. `[PAUSE 0.5s]`).
const CUE_RE = /^\[(VISUAL|MANIM):\s*(.+)\]$|^\[(PAUSE)\s+(.+)\]$/i;
// `[VISUAL: continue]` (or `[CONTINUE]`) inherits the previous beat's visual.
// Empty / missing cue also inherits — keeps consecutive same-content beats from
// fragmenting the visual timeline.
const CONTINUE_RE = /^\[VISUAL:\s*continue\s*\]$|^\[CONTINUE\]$/i;
const SILENT_RE = /^\(silent\b[^)]*\)$/i;
const SILENT_WITH_DURATION_RE = /^\(silent\s+([\d.]+)\s*s?\)$/i;
const NARRATION_RE = /^"(.+)"\s*$/;
const DEFAULT_SILENT_DISPLAY_SECONDS = 2.0;

export function scriptPath(slug: string): string {
  return videoFile(slug, 'script.md');
}

export function parseScript(slug: string): ParsedScript {
  const path = scriptPath(slug);
  if (!fs.existsSync(path)) {
    throw new Error(`Script missing: ${path}`);
  }
  const raw = fs.readFileSync(path, 'utf8');

  let body = raw;
  const fm: ScriptFrontmatter = { slug };
  const fmMatch = raw.match(FM_RE);
  if (fmMatch) {
    body = raw.slice(fmMatch[0].length);
    for (const line of fmMatch[1]!.split('\n')) {
      const m = line.match(/^([A-Za-z_][\w]*)\s*:\s*(.+?)\s*$/);
      if (!m) continue;
      const key = m[1]!;
      const val = m[2]!.replace(/^["']|["']$/g, '');
      if (key === 'voice') fm.voice = val;
      else if (key === 'target_minutes') fm.target_minutes = Number(val);
      else if (key === 'slug') fm.slug = val;
    }
  }

  const lines = body.split('\n');
  const beats: Beat[] = [];
  let title: string | null = null;
  let currentAct = '';
  let currentBeatId: string | null = null;
  let currentVisualCue = '';
  let currentNarrationLines: string[] = [];
  // Tracks the last non-pause visual cue across beats so `[VISUAL: continue]`
  // (or an absent cue) inherits the previous visual. Eliminates false-positive
  // "(missing cue)" beats and lets the manifest coalescer merge them.
  let lastVisualCue = '';

  const flush = () => {
    if (!currentBeatId) return;
    // Inherit previous visual when the beat is narrated and has no cue, or
    // explicitly says continue.
    if (
      currentVisualCue.length === 0 ||
      CONTINUE_RE.test(currentVisualCue.trim())
    ) {
      currentVisualCue = lastVisualCue;
    }
    const cueLower = currentVisualCue.toLowerCase();

    // Pause beat: explicit [PAUSE Xs] cue, no visual.
    if (cueLower.startsWith('[pause')) {
      const m = currentVisualCue.match(/\[PAUSE\s+([\d.]+)s?\]/i);
      const seconds = m ? Number(m[1]) : 0.5;
      beats.push({
        kind: 'pause',
        id: currentBeatId,
        heading: currentAct,
        durationSeconds: seconds,
      });
      currentBeatId = null;
      currentVisualCue = '';
      currentNarrationLines = [];
      return;
    }

    // Inspect narration lines: detect silent markers vs spoken text.
    let silentSeconds: number | null = null;
    const spokenParts: string[] = [];
    for (const raw of currentNarrationLines) {
      const l = raw.trim();
      if (l.length === 0) continue;
      const sd = l.match(SILENT_WITH_DURATION_RE);
      if (sd) {
        silentSeconds = Number(sd[1]);
        continue;
      }
      if (SILENT_RE.test(l)) {
        silentSeconds = silentSeconds ?? DEFAULT_SILENT_DISPLAY_SECONDS;
        continue;
      }
      const q = l.match(NARRATION_RE);
      spokenParts.push(q ? q[1]! : l);
    }
    const text = spokenParts.join(' ').trim();

    if (text.length === 0 && currentVisualCue.length > 0) {
      // Silent display: visual but no audio, fixed duration.
      beats.push({
        kind: 'silentDisplay',
        id: currentBeatId,
        heading: currentAct,
        visualCue: currentVisualCue,
        durationSeconds: silentSeconds ?? DEFAULT_SILENT_DISPLAY_SECONDS,
      });
    } else {
      beats.push({
        kind: 'narrated',
        id: currentBeatId,
        heading: currentAct,
        visualCue: currentVisualCue,
        narration: text,
      });
    }
    // Remember the last non-pause cue so a subsequent beat with no cue (or a
    // `[VISUAL: continue]` cue) inherits the same visual moment.
    if (currentVisualCue.length > 0) lastVisualCue = currentVisualCue;
    currentBeatId = null;
    currentVisualCue = '';
    currentNarrationLines = [];
  };

  for (const line of lines) {
    const titleM = line.match(TITLE_RE);
    if (titleM && title === null && !line.startsWith('##')) {
      title = titleM[1]!.trim();
      continue;
    }
    const actM = line.match(ACT_RE);
    if (actM) {
      flush();
      currentAct = actM[1]!.trim();
      continue;
    }
    const beatM = line.match(BEAT_RE);
    if (beatM) {
      flush();
      currentBeatId = beatM[1]!;
      continue;
    }
    if (!currentBeatId) continue;
    const cueM = line.trim().match(CUE_RE);
    if (cueM) {
      currentVisualCue = line.trim();
      continue;
    }
    currentNarrationLines.push(line);
  }
  flush();

  return { frontmatter: fm, title, beats };
}

/** Convenience: only the narrated beats, in order. */
export function narratedBeats(script: ParsedScript): Array<Extract<Beat, { kind: 'narrated' }>> {
  return script.beats.filter((b): b is Extract<Beat, { kind: 'narrated' }> => b.kind === 'narrated');
}
