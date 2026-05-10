import type { ThreadScope } from './types.js';

/**
 * Build the directive sent to a child claude process running a spot-edit
 * thread. The thread is scoped to a small set of beats / blocks; we tell the
 * agent to ONLY edit those, run QA after, and end with a one-paragraph
 * summary that the parent thread can read.
 */
export function buildThreadDirective(slug: string, scope: ThreadScope, userText: string): string {
  const targets = describeScope(scope);
  return [
    `You are running an asynchronous "spot-edit" thread inside the paper-videos editor.`,
    `Slug: "${slug}"`,
    `Scope: ${targets}`,
    ``,
    `RULES:`,
    `- Only edit the manifest entries / script.md beats / Manim scenes that fall inside the scope above.`,
    `- Do NOT touch beats or blocks outside the scope. If a change requires touching something outside, stop and explain why instead of doing it.`,
    `- Use the existing pipeline: src/lib/manifest.ts helpers, npm run narrate, npm run render-manim, npm run migrate-manifest-v2.`,
    `- After your edit, run \`npm run qa -- ${slug}\` to validate. If new errors appear, fix them.`,
    ``,
    `FINISH PROTOCOL:`,
    `- When the user (or a later "finish" instruction) tells you to finish, write ONE concise paragraph (2-4 sentences) summarizing what changed. Start that paragraph with the literal token "SUMMARY:" so the editor can extract it.`,
    `- Do not add any other prose around the summary on the finish turn.`,
    ``,
    `USER ASK: ${userText.trim()}`,
  ].join('\n');
}

export function buildFinishPrompt(scope: ThreadScope): string {
  return [
    `Finish this spot-edit thread now.`,
    `Scope was: ${describeScope(scope)}.`,
    `Output exactly one line starting with "SUMMARY: " followed by 2-4 sentences describing what changed (files touched, beats re-narrated, scenes re-rendered, QA result). No other prose, no headings, no follow-up offers.`,
  ].join('\n');
}

export function describeScope(scope: ThreadScope): string {
  const parts: string[] = [];
  if (scope.beatIds.length > 0) parts.push(`voice beats ${scope.beatIds.join(', ')}`);
  if (scope.blockIds.length > 0) parts.push(`visual blocks ${scope.blockIds.join(', ')}`);
  if (scope.label) parts.push(`(time range ${scope.label})`);
  return parts.length === 0 ? '(unspecified)' : parts.join(' + ');
}

const SUMMARY_RE = /^SUMMARY:\s*([\s\S]+?)\s*$/m;
export function extractSummary(text: string): string | null {
  const m = text.match(SUMMARY_RE);
  return m ? m[1]!.trim() : null;
}
