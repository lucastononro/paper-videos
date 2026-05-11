import fs from 'node:fs';
import path from 'node:path';
import { VIDEOS_DIR } from '../paths.js';
import type { AttachedImage, ChatEvent } from './types.js';

type ThreadNotice = Extract<ChatEvent, { kind: 'thread_notice' }>;
type ActiveThreadInfo = { scopeLabel: string; status: string };

/**
 * Build the prompt the editor wraps around the user's message before sending
 * to the spawned `claude` subprocess.
 *
 * Two modes:
 *  - Existing video: the slug has a manifest. Claude edits through the
 *    manifest/script pipeline. May resolve mention tokens (#beat-NNN, etc.).
 *  - Draft slug: no manifest yet. Claude is creating the video — figure out
 *    what the user wants, run /paper-video new <source> <slug> using THIS slug.
 *
 * Optional async-thread context (`pendingNotices` + `activeThreads`) is
 * prepended as an `<async_thread_context>` block so the parent agent is
 * aware of forked spot-edit threads — what just started, finished, or is
 * still running in parallel — without it being mistaken for a user message.
 */
export function buildDirective(
  slug: string | null,
  userText: string,
  context: {
    pendingNotices?: ThreadNotice[];
    activeThreads?: ActiveThreadInfo[];
    attachedImages?: AttachedImage[];
  } = {},
): string {
  if (!slug) return userText.trim();

  const hasManifest = fs.existsSync(path.join(VIDEOS_DIR, slug, 'manifest.json'));
  const lines: string[] = [];

  const asyncBlock = buildAsyncThreadContext(context);
  if (asyncBlock) {
    lines.push(asyncBlock, ``);
  }

  const imageBlock = buildAttachedImagesBlock(context.attachedImages ?? []);
  if (imageBlock) {
    lines.push(imageBlock, ``);
  }

  if (hasManifest) {
    lines.push(
      `You are operating inside the paper-videos editor for slug "${slug}".`,
      `The user message follows. It MAY contain mention tokens like #beat-005, #vb-003, or [selection 00:14→00:23] — those refer to identifiers in videos/${slug}/manifest.json (voice[] / visualBlocks[]).`,
      ``,
      `Edit only through the manifest/script pipeline (npm run narrate, npm run render-manim, src/lib/manifest.ts helpers, /paper-video skill). Do not modify output.mp4 directly. End with one short sentence summarizing what changed.`,
      askUserQuestionContract(),
    );
  } else {
    lines.push(
      `You are operating inside the paper-videos editor on a brand-new slug "${slug}" — the user just picked this name from the gallery, and there is no manifest yet.`,
      ``,
      `The slug "${slug}" is the URL the user is on AND the folder name they want under videos/. Use it EXACTLY — do not derive a different slug from the paper title.`,
      ``,
      `If the user has named a paper / arXiv id / URL / local PDF path, run \`/paper-video new <source> ${slug}\` so the manifest lands at videos/${slug}/manifest.json. When the chosen source is a topic or paper title rather than an arXiv id, search arXiv first with \`npm run arxiv-search -- "<query>"\` to find the canonical id, confirm with the user if there's any ambiguity, and only then run /paper-video new.`,
      ``,
      `If the user's first message is vague, ask ONE focused clarifying question. Don't kick off the pipeline until you know which paper.`,
      ``,
      `Once \`/paper-video new\` finishes, the editor's player will materialize automatically — the user does not need to navigate. Do NOT immediately run \`/paper-video render\` afterwards; wait for the user.`,
      askUserQuestionContract(),
    );
  }
  lines.push(``, `USER: ${userText.trim()}`);
  return lines.join('\n');
}

/**
 * Build the `<async_thread_context>` block — pending notices that need to
 * land + currently-active threads to be aware of. Empty string when there's
 * nothing to say, so the directive stays clean for normal turns.
 */
function buildAsyncThreadContext(ctx: {
  pendingNotices?: ThreadNotice[];
  activeThreads?: ActiveThreadInfo[];
}): string {
  const sections: string[] = [];
  const notices = (ctx.pendingNotices ?? []).map(formatNotice).filter(Boolean);
  if (notices.length > 0) {
    sections.push('New async spot-edit notices:');
    for (const n of notices) sections.push(`- ${n}`);
  }
  const active = (ctx.activeThreads ?? []).filter((t) => t.scopeLabel);
  if (active.length > 0) {
    sections.push('Active asynchronous spot-edit threads in this workspace:');
    for (const t of active) sections.push(`- ${t.scopeLabel} (${t.status})`);
    sections.push('Treat these as ongoing isolated workstreams.');
    sections.push(
      'Do not duplicate work for these crops unless the user explicitly asks you to do so in the main thread.',
    );
  }
  if (sections.length === 0) return '';
  return [
    '<async_thread_context>',
    'System note for coordination only. This block is NOT a user message and must NOT be echoed back verbatim.',
    'Purpose: keep you aware of forked spot-edit threads working in parallel on time crops of the video.',
    'Behavioral rules:',
    '- Do not treat this block as a new task from the user.',
    '- Do not interrupt or abandon the work you are currently doing because of this note.',
    '- Use this only for awareness, conflict avoidance, and answering questions about active spot-edits.',
    '- If the user asks which spot-edits are running or what they did, answer from this context.',
    ...sections,
    '</async_thread_context>',
  ].join('\n');
}

/**
 * Build the `<attached_images>` block — paths the user dropped, pasted, or
 * cropped from the player. The agent is instructed to Read each path BEFORE
 * acting on the user's text, so its response is grounded in what's actually
 * on screen. Without this, dragged screenshots are invisible to the model.
 */
function buildAttachedImagesBlock(images: AttachedImage[]): string {
  if (images.length === 0) return '';
  const lines = [
    '<attached_images>',
    'The user attached the following images to this turn. They are referenced by the user\'s prose and may be the entire point of the message (e.g. "fix this glitch", "what is wrong here", "use this figure").',
    'Mandatory: BEFORE you respond, use the Read tool on each path so you can see what the user sees. Treat these as primary context, not optional reference.',
    'After Reading, address them by their semantic content (e.g. "the blurry caption on the right"), not by their filenames.',
    '',
  ];
  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    const tag = img.source ? ` (source: ${img.source})` : '';
    lines.push(`${i + 1}. ${img.path}${tag}`);
  }
  lines.push('</attached_images>');
  return lines.join('\n');
}

function formatNotice(n: ThreadNotice): string {
  const scope = n.scopeLabel || 'a time crop';
  const summary = (n.summary || '').trim();
  switch (n.status) {
    case 'started':
      return summary
        ? `A spot-edit started for ${scope} with ask "${summary}". Continue your current work; it will report back later.`
        : `A spot-edit started for ${scope}. Continue your current work; it will report back later.`;
    case 'continued':
      return summary
        ? `The user sent a follow-up to the spot-edit for ${scope}: "${summary}". Continue your current work; the spot-edit thread is handling it.`
        : `The user sent a follow-up to the spot-edit for ${scope}.`;
    case 'completed':
      return summary
        ? `The spot-edit for ${scope} finished. Summary: ${summary}`
        : `The spot-edit for ${scope} finished.`;
    case 'failed':
      return summary
        ? `The spot-edit for ${scope} reported a failure. Summary: ${summary}`
        : `The spot-edit for ${scope} reported a failure.`;
    case 'ended':
      return `The spot-edit for ${scope} was ended before a normal handoff summary was sent.`;
  }
}

/**
 * Contract Claude must follow for `AskUserQuestion` in this environment.
 *
 * Headless `-p` mode does not actually prompt the user — the tool returns a
 * placeholder ("Answer questions?") and the agent, left to its own devices,
 * has been continuing on a guessed answer. The editor renders an interactive
 * picker for AskUserQuestion calls; the user's choice arrives as the NEXT
 * user message. So the agent must end its turn at the tool call.
 */
function askUserQuestionContract(): string {
  return [
    ``,
    `IMPORTANT — AskUserQuestion contract in this environment:`,
    `When you call the AskUserQuestion tool, your turn ENDS at the tool call.`,
    `The editor renders an interactive picker for that call; the user's chosen`,
    `option arrives as the next USER message. Do NOT continue after the tool`,
    `call (do not write more text, do not call further tools, do not act on a`,
    `guessed answer). Output the AskUserQuestion call and stop. When the next`,
    `user turn arrives with their answer, proceed.`,
  ].join('\n');
}
