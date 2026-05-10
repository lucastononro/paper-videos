import fs from 'node:fs';
import path from 'node:path';
import { VIDEOS_DIR } from '../paths.js';

/**
 * Build the prompt the editor wraps around the user's message before sending
 * to the spawned `claude` subprocess.
 *
 * Two modes:
 *  - Existing video: the slug has a manifest. Claude edits through the
 *    manifest/script pipeline. May resolve mention tokens (#beat-NNN, etc.).
 *  - Draft slug: no manifest yet. Claude is creating the video — figure out
 *    what the user wants, run /paper-video new <source> <slug> using THIS slug.
 */
export function buildDirective(slug: string | null, userText: string): string {
  if (!slug) return userText.trim();

  const hasManifest = fs.existsSync(path.join(VIDEOS_DIR, slug, 'manifest.json'));
  const lines: string[] = [];

  if (hasManifest) {
    lines.push(
      `You are operating inside the paper-videos editor for slug "${slug}".`,
      `The user message follows. It MAY contain mention tokens like #beat-005, #vb-003, or [selection 00:14→00:23] — those refer to identifiers in videos/${slug}/manifest.json (voice[] / visualBlocks[]).`,
      ``,
      `Edit only through the manifest/script pipeline (npm run narrate, npm run render-manim, src/lib/manifest.ts helpers, /paper-video skill). Do not modify output.mp4 directly. End with one short sentence summarizing what changed.`,
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
    );
  }
  lines.push(``, `USER: ${userText.trim()}`);
  return lines.join('\n');
}
