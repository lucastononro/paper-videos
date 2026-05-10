import type { ThreadScope } from './types.js';

/**
 * Build the directive sent to a child claude process running a spot-edit
 * thread. The thread is scoped to a TIME CROP of the video — a range
 * `[startFrame, endFrame]` the user dragged on the filmstrip. The harness
 * pre-resolves which voice beats and visual blocks overlap that range and
 * lists them as a finding aid, but the agent is expected to figure out
 * what actually needs to change from the user's ask + the time range
 * itself.
 */
export function buildThreadDirective(slug: string, scope: ThreadScope, userText: string): string {
  const lines: string[] = [
    `You are running an asynchronous "spot-edit" thread inside the paper-videos editor.`,
    `Slug: "${slug}"`,
  ];
  if (typeof scope.startFrame === 'number' && typeof scope.endFrame === 'number') {
    const label = scope.label ?? `${scope.startFrame}–${scope.endFrame} frames`;
    lines.push(`Time crop: ${label}  (frames ${scope.startFrame}–${scope.endFrame})`);
  }
  if (scope.beatIds.length > 0 || scope.blockIds.length > 0) {
    lines.push(`Overlapping (finding aid — not a hard constraint on what to edit):`);
    if (scope.beatIds.length > 0) lines.push(`  voice beats: ${scope.beatIds.join(', ')}`);
    if (scope.blockIds.length > 0) lines.push(`  visual blocks: ${scope.blockIds.join(', ')}`);
  }
  lines.push(
    ``,
    `RULES:`,
    `- The user picked a TIME CROP of the video. Edit whatever needs editing within that crop to address their ask. The overlapping-beats/blocks list above is a finding aid pointing you at the right files in videos/${slug}/ — read script.md, manifest.json, narration/, manim/ for the relevant ids and figure out what to change.`,
    `- Stay inside the time crop. If a fix genuinely requires editing material outside it, stop and explain rather than silently widening scope.`,
    `- Use the existing pipeline: src/lib/manifest.ts helpers, npm run narrate, npm run render-manim, npm run sync-manifest. Do not run \`npm run render-remotion\` — final render is button-driven.`,
    `- QA runs automatically in the editor after every save; you do not need to invoke it. If you want to read the latest report, look at \`videos/${slug}/qa-report.json\`.`,
    ``,
    `FINISH PROTOCOL — agent-driven OR user-driven:`,
    `- You can finish this thread yourself. When you genuinely believe the user's ask is satisfied (edits made + the relevant beats look right + QA is happy), end your turn with EXACTLY one line that starts with the literal token "SUMMARY:" followed by 2-4 sentences describing what changed (files touched, beats re-narrated, scenes re-rendered). The editor detects that token and auto-completes the thread; the parent agent gets the summary as a notice.`,
    `- If the user explicitly asks to finish in a follow-up turn, do the same: end your reply with a SUMMARY: line.`,
    `- The user may also click an "End" button which force-stops the thread without a summary — you don't need to handle that case.`,
    `- DO NOT emit "SUMMARY:" prematurely. If the work isn't actually done (you made edits but haven't verified them, or you're waiting on a tool result), keep working — the thread stays open and accepts follow-up turns.`,
    `- If you genuinely cannot complete the ask (missing data, blocked by a deeper issue), end your turn with "SUMMARY: failed — <one-sentence reason>." That's still a valid completion; the editor flags it as a failure.`,
    ``,
    `USER ASK: ${userText.trim()}`,
  );
  return lines.join('\n');
}

export function buildFinishPrompt(scope: ThreadScope): string {
  return [
    `Finish this spot-edit thread now.`,
    `Scope was: ${describeScope(scope)}.`,
    `Output exactly one line starting with "SUMMARY: " followed by 2-4 sentences describing what changed (files touched, beats re-narrated, scenes re-rendered, QA result). No other prose, no headings, no follow-up offers.`,
  ].join('\n');
}

export function describeScope(scope: ThreadScope): string {
  if (scope.label) return `time crop ${scope.label}`;
  if (typeof scope.startFrame === 'number' && typeof scope.endFrame === 'number') {
    return `time crop ${scope.startFrame}–${scope.endFrame} frames`;
  }
  const parts: string[] = [];
  if (scope.beatIds.length > 0) parts.push(`voice beats ${scope.beatIds.join(', ')}`);
  if (scope.blockIds.length > 0) parts.push(`visual blocks ${scope.blockIds.join(', ')}`);
  return parts.length === 0 ? '(unspecified)' : parts.join(' + ');
}

const SUMMARY_RE = /^SUMMARY:\s*([\s\S]+?)\s*$/m;
export function extractSummary(text: string): string | null {
  const m = text.match(SUMMARY_RE);
  return m ? m[1]!.trim() : null;
}
