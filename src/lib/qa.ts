import fs from 'node:fs';
import path from 'node:path';
import { videoDir, videoFile } from './paths.js';
import { readManifest, type Manifest, type Visual } from './manifest.js';
import { isLatexBalanced, splitLatex } from './split-latex.js';

export type Severity = 'error' | 'warning' | 'info';

export type QaIssue = {
  severity: Severity;
  kind: string;
  detail: Record<string, unknown>;
  message: string;
  /** Frame the user should jump to when clicking this issue. */
  jumpFrame: number;
};

export type QaReport = {
  slug: string;
  generatedAt: string;
  totalFrames: number;
  fps: number;
  voiceBeats: number;
  visualBlocks: number;
  issues: QaIssue[];
  byKind: Record<string, number>;
  bySeverity: Record<Severity, number>;
};

const FORBIDDEN_TAGS = [
  'laughs',
  'giggles',
  'shouts',
  'whispers',
  'mischievous',
  'playfully',
  'sarcastic',
  'deadpan',
  'childlike',
  'crying',
  'gasps',
  'trembling',
  'robotic',
];

/**
 * Walk the slug's manifest + filesystem and emit a typed list of QA issues.
 * Deterministic and fast (sub-second on typical manifests). The agentic
 * interpretation lives in `.claude/agents/video-qa.md`, which reads the report
 * this function writes.
 */
export function runQa(slug: string): QaReport {
  const manifest = readManifest(slug);
  const issues: QaIssue[] = [];
  const fps = manifest.fps;
  const dir = videoDir(slug);

  // Index equations.json (if present) for unknown-id checks.
  const equationsPath = videoFile(slug, 'equations.json');
  let equationsById = new Map<string, { latex: string }>();
  if (fs.existsSync(equationsPath)) {
    try {
      const arr = JSON.parse(fs.readFileSync(equationsPath, 'utf8')) as Array<{
        id: string;
        latex: string;
      }>;
      equationsById = new Map(arr.map((e) => [e.id, { latex: e.latex }]));
      // Regression guard for the matrix-tear bug: every equation rendered
      // stepwise gets `splitLatex(latex)`-ed, and each fragment must have
      // balanced `\begin{…}\end{…}`. If the splitter ever stops being
      // depth-aware (or someone fixes a different bug by reverting it),
      // this surfaces as an `equation:malformed-split` issue immediately
      // rather than only showing up as red-text in the rendered mp4.
      // History: a single Cauchy two-line `\begin{pmatrix}1,2,3\\3,1,2\end{pmatrix}`
      // was being split at the row separator, producing fragments like
      // `s_1\begin{pmatrix}1,2,3` (no closing `\end{pmatrix}`).
      for (const [id, { latex }] of equationsById) {
        const parts = splitLatex(latex);
        for (const [idx, part] of parts.entries()) {
          if (!isLatexBalanced(part)) {
            issues.push({
              severity: 'error',
              kind: 'equation:malformed-split',
              detail: {
                equationId: id,
                fragmentIndex: idx,
                totalFragments: parts.length,
                fragment: part.slice(0, 200),
              },
              message: `${id} stepwise split produced an unbalanced fragment (\\begin/\\end mismatch) — fragment ${idx + 1}/${parts.length} starts: "${part.slice(0, 80)}…". Likely a regression in splitLatex (depth-aware matrix handling).`,
              jumpFrame: 0,
            });
          }
        }
      }
    } catch {
      /* malformed — surface separately */
    }
  }

  // Index assets-index.json (if present).
  const assetsPath = videoFile(slug, 'assets-index.json');
  let assets: Record<string, { kind: string; file: string }> = {};
  if (fs.existsSync(assetsPath)) {
    try {
      assets = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
    } catch {
      /* surface separately */
    }
  }

  // Index manim mp4 durations (set by render-remotion / preparePreview).
  const durPath = videoFile(slug, 'public', 'manim-durations.json');
  const manimDurations: Record<string, number> = fs.existsSync(durPath)
    ? (JSON.parse(fs.readFileSync(durPath, 'utf8')) as Record<string, number>)
    : {};

  // ---- Voice beats: audio file existence + timing ----
  const sortedVoice = [...manifest.voice].sort((a, b) => a.startFrame - b.startFrame);
  for (let i = 0; i < sortedVoice.length; i += 1) {
    const beat = sortedVoice[i]!;

    if (beat.audioFile) {
      const abs = path.join(dir, beat.audioFile);
      if (!fs.existsSync(abs)) {
        issues.push({
          severity: 'error',
          kind: 'audio:missing-mp3',
          detail: { beat: beat.id, expectedPath: abs },
          message: `${beat.id}: missing mp3 at ${beat.audioFile}`,
          jumpFrame: beat.startFrame,
        });
      }
    }
    if (beat.timestampsFile) {
      const abs = path.join(dir, beat.timestampsFile);
      if (!fs.existsSync(abs)) {
        issues.push({
          severity: 'error',
          kind: 'audio:missing-timestamps',
          detail: { beat: beat.id, expectedPath: abs },
          message: `${beat.id}: missing timestamps file ${beat.timestampsFile}`,
          jumpFrame: beat.startFrame,
        });
      }
    }
    if (beat.durationFrames <= 0) {
      issues.push({
        severity: 'error',
        kind: 'manifest:duration-zero',
        detail: { entityId: beat.id },
        message: `${beat.id}: duration <= 0 frames`,
        jumpFrame: beat.startFrame,
      });
    }

    // Adjacency / gap to the next beat.
    const next = sortedVoice[i + 1];
    if (next) {
      const beatEnd = beat.startFrame + beat.durationFrames;
      const gap = next.startFrame - beatEnd;
      if (gap < 0) {
        issues.push({
          severity: 'error',
          kind: 'audio:overlap',
          detail: {
            beatA: beat.id,
            beatB: next.id,
            overlapFrames: -gap,
            overlapMs: framesToMs(-gap, fps),
          },
          message: `${beat.id} overlaps ${next.id} by ${framesToMs(-gap, fps)}ms`,
          jumpFrame: next.startFrame,
        });
      } else if (gap > Math.round(fps * 1.5)) {
        issues.push({
          severity: 'warning',
          kind: 'audio:gap-too-large',
          detail: { afterBeat: beat.id, gapMs: framesToMs(gap, fps) },
          message: `${beat.id} → ${next.id} has a ${(framesToMs(gap, fps) / 1000).toFixed(1)}s silent gap (>1.5s)`,
          jumpFrame: beatEnd,
        });
      } else if (gap > 0 && gap < Math.round(fps * 0.08) && beat.audioFile && next.audioFile) {
        issues.push({
          severity: 'warning',
          kind: 'audio:gap-too-small',
          detail: { afterBeat: beat.id, gapMs: framesToMs(gap, fps) },
          message: `${beat.id} → ${next.id} gap is only ${framesToMs(gap, fps)}ms (clipping risk)`,
          jumpFrame: beatEnd,
        });
      }
    }

    // Caption word-overflow check.
    if (beat.timestampsFile) {
      const abs = path.join(dir, beat.timestampsFile);
      if (fs.existsSync(abs)) {
        try {
          const ts = JSON.parse(fs.readFileSync(abs, 'utf8')) as {
            audioDurationSeconds: number;
            words: Array<{ word: string; start: number; end: number }>;
          };
          const beatEndSec = beat.durationFrames / fps;
          for (const w of ts.words) {
            if (w.end > beatEndSec + 0.05) {
              issues.push({
                severity: 'warning',
                kind: 'sync:caption-word-overflows-beat',
                detail: {
                  beat: beat.id,
                  word: w.word,
                  endMs: Math.round(w.end * 1000),
                  beatEndMs: Math.round(beatEndSec * 1000),
                },
                message: `${beat.id}: caption word "${w.word}" ends at ${w.end.toFixed(2)}s but beat is ${beatEndSec.toFixed(2)}s`,
                jumpFrame: beat.startFrame + Math.round(w.start * fps),
              });
              break; // one per beat is enough
            }
          }
        } catch {
          issues.push({
            severity: 'warning',
            kind: 'audio:missing-timestamps',
            detail: { beat: beat.id, expectedPath: abs, parseError: true },
            message: `${beat.id}: timestamps file is malformed JSON`,
            jumpFrame: beat.startFrame,
          });
        }
      }
    }

    // Forbidden audio tag check.
    if (beat.text) {
      for (const tag of FORBIDDEN_TAGS) {
        if (beat.text.toLowerCase().includes(`[${tag}]`)) {
          issues.push({
            severity: 'warning',
            kind: 'tag:forbidden',
            detail: { beat: beat.id, tag },
            message: `${beat.id}: uses [${tag}] — theatrical tag, undermines academic credibility`,
            jumpFrame: beat.startFrame,
          });
        }
      }
    }
  }

  // ---- Visual blocks: file existence + content sanity + flicker ----
  const sortedBlocks = [...manifest.visualBlocks].sort((a, b) => a.startFrame - b.startFrame);
  for (let i = 0; i < sortedBlocks.length; i += 1) {
    const block = sortedBlocks[i]!;
    if (block.durationFrames <= 0) {
      issues.push({
        severity: 'error',
        kind: 'manifest:duration-zero',
        detail: { entityId: block.id },
        message: `${block.id}: duration <= 0 frames`,
        jumpFrame: block.startFrame,
      });
    }
    issuesForVisual(
      block.visual,
      block.id,
      block.startFrame,
      dir,
      equationsById,
      assets,
      manimDurations,
      block.durationFrames,
      fps,
    ).forEach((iss) => issues.push(iss));

    // Gap between consecutive blocks.
    const next = sortedBlocks[i + 1];
    if (next) {
      const blockEnd = block.startFrame + block.durationFrames;
      const gap = next.startFrame - blockEnd;
      if (gap < 0) {
        issues.push({
          severity: 'error',
          kind: 'manifest:overlap-between-blocks',
          detail: { afterBlock: block.id, nextBlock: next.id, overlapFrames: -gap },
          message: `${block.id} overlaps ${next.id} by ${-gap} frames`,
          jumpFrame: next.startFrame,
        });
      } else if (gap > 0) {
        issues.push({
          severity: 'info',
          kind: 'manifest:gap-between-blocks',
          detail: { afterBlock: block.id, gapFrames: gap },
          message: `${block.id} → ${next.id} has a ${gap}-frame gap (no visual showing)`,
          jumpFrame: blockEnd,
        });
      }

      // Flicker check: adjacent same-fingerprint blocks should have been
      // coalesced by migrateToV2 (CLAUDE.md hard-rule #17). If we still see
      // them, something regressed.
      const fa = visualKey(block.visual);
      const fb = visualKey(next.visual);
      if (fa !== null && fa === fb && Math.abs(gap) <= Math.round(fps * 0.3)) {
        issues.push({
          severity: 'warning',
          kind: 'visual:flicker',
          detail: { blocks: [block.id, next.id], sharedFingerprint: fa, gapFrames: gap },
          message: `${block.id} and ${next.id} share visual content (${fa}) — should have coalesced (rule #17 regression)`,
          jumpFrame: blockEnd,
        });
      }
    }
  }

  const byKind: Record<string, number> = {};
  const bySeverity: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const iss of issues) {
    byKind[iss.kind] = (byKind[iss.kind] ?? 0) + 1;
    bySeverity[iss.severity] += 1;
  }

  const lastBeat = sortedVoice[sortedVoice.length - 1];
  const total = lastBeat ? lastBeat.startFrame + lastBeat.durationFrames : 0;

  return {
    slug,
    generatedAt: new Date().toISOString(),
    totalFrames: total,
    fps,
    voiceBeats: manifest.voice.length,
    visualBlocks: manifest.visualBlocks.length,
    issues,
    byKind,
    bySeverity,
  };
}

function issuesForVisual(
  v: Visual,
  blockId: string,
  startFrame: number,
  dir: string,
  equationsById: Map<string, { latex: string }>,
  assets: Record<string, { kind: string; file: string }>,
  manimDurations: Record<string, number>,
  blockDurationFrames: number,
  fps: number,
): QaIssue[] {
  const out: QaIssue[] = [];
  switch (v.kind) {
    case 'manimClip': {
      const abs = path.join(dir, v.mp4);
      if (!fs.existsSync(abs)) {
        out.push({
          severity: 'error',
          kind: 'visual:manim-mp4-missing',
          detail: { block: blockId, expectedPath: abs },
          message: `${blockId}: manim mp4 missing at ${v.mp4}`,
          jumpFrame: startFrame,
        });
      } else {
        const probed = manimDurations[v.mp4];
        if (typeof probed === 'number' && probed < blockDurationFrames - 5) {
          out.push({
            severity: 'info',
            kind: 'visual:manim-duration-shorter-than-block',
            detail: {
              block: blockId,
              mp4Frames: probed,
              blockFrames: blockDurationFrames,
              deltaFrames: blockDurationFrames - probed,
              deltaSec: (blockDurationFrames - probed) / fps,
            },
            message: `${blockId}: mp4 is ${probed}f but block is ${blockDurationFrames}f — last frame held for ${((blockDurationFrames - probed) / fps).toFixed(1)}s (this is intended unless unexpectedly long)`,
            jumpFrame: startFrame + probed,
          });
        }
      }
      break;
    }
    case 'paperPage': {
      const pagePath = path.join(
        dir,
        'pages',
        `page-${String(v.pageIdx + 1).padStart(3, '0')}.png`,
      );
      if (!fs.existsSync(pagePath)) {
        out.push({
          severity: 'error',
          kind: 'visual:page-missing',
          detail: { block: blockId, pageIdx: v.pageIdx, expectedPath: pagePath },
          message: `${blockId}: page-${v.pageIdx + 1} missing at ${pagePath}`,
          jumpFrame: startFrame,
        });
      }
      if (v.highlightBBox) {
        const bb = v.highlightBBox;
        if (
          bb.x < 0 ||
          bb.y < 0 ||
          bb.w <= 0 ||
          bb.h <= 0 ||
          bb.x + bb.w > 1.001 ||
          bb.y + bb.h > 1.001
        ) {
          out.push({
            severity: 'error',
            kind: 'visual:bbox-out-of-bounds',
            detail: { block: blockId, bbox: bb },
            message: `${blockId}: highlightBBox out of [0,1] range`,
            jumpFrame: startFrame,
          });
        }
      }
      break;
    }
    case 'highlightedQuote': {
      const pagePath = path.join(
        dir,
        'pages',
        `page-${String(v.pageIdx + 1).padStart(3, '0')}.png`,
      );
      if (!fs.existsSync(pagePath)) {
        out.push({
          severity: 'error',
          kind: 'visual:page-missing',
          detail: { block: blockId, pageIdx: v.pageIdx, expectedPath: pagePath },
          message: `${blockId}: page-${v.pageIdx + 1} missing at ${pagePath}`,
          jumpFrame: startFrame,
        });
      }
      if (v.bbox) {
        const bb = v.bbox;
        if (
          bb.x < 0 ||
          bb.y < 0 ||
          bb.w <= 0 ||
          bb.h <= 0 ||
          bb.x + bb.w > 1.001 ||
          bb.y + bb.h > 1.001
        ) {
          out.push({
            severity: 'error',
            kind: 'visual:bbox-out-of-bounds',
            detail: { block: blockId, bbox: bb },
            message: `${blockId}: bbox out of [0,1] range`,
            jumpFrame: startFrame,
          });
        }
      }
      break;
    }
    case 'equationCard':
    case 'equationStep':
      if (!equationsById.has(v.equationId)) {
        out.push({
          severity: 'error',
          kind: 'equation:unknown-id',
          detail: { block: blockId, equationId: v.equationId },
          message: `${blockId}: references unknown equation id "${v.equationId}"`,
          jumpFrame: startFrame,
        });
      }
      break;
    case 'image':
    case 'diagram':
      if (!assets[v.assetId]) {
        out.push({
          severity: 'error',
          kind: 'visual:asset-missing',
          detail: { block: blockId, assetId: v.assetId },
          message: `${blockId}: references unknown asset "${v.assetId}"`,
          jumpFrame: startFrame,
        });
      } else {
        const file = assets[v.assetId]!.file;
        const abs = path.join(dir, file);
        if (!fs.existsSync(abs)) {
          out.push({
            severity: 'error',
            kind: 'visual:asset-missing',
            detail: { block: blockId, assetId: v.assetId, expectedPath: abs },
            message: `${blockId}: asset "${v.assetId}" file ${file} not on disk`,
            jumpFrame: startFrame,
          });
        }
      }
      break;
    default:
      break;
  }
  return out;
}

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
    case 'highlightedQuote':
      return `quote:${v.pageIdx}:${v.text}`;
    case 'equationCard':
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

function framesToMs(frames: number, fps: number): number {
  return Math.round((frames / fps) * 1000);
}

export function writeQaReport(slug: string, report: QaReport): string {
  const out = videoFile(slug, 'qa-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  return out;
}

export function readQaReport(slug: string): QaReport | null {
  const p = videoFile(slug, 'qa-report.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as QaReport;
  } catch {
    return null;
  }
}

// Manifest type re-export for downstream consumers (avoid duplicate import).
export type { Manifest };
