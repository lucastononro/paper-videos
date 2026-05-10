/**
 * Chat history persistence: append-only JSONL per slug.
 *
 * File: videos/<slug>/.cache/chat-history.jsonl
 *   - One ChatEvent per line, in arrival order.
 *   - `.cache/` is already gitignored (videos/*\/.cache/ — see .gitignore).
 *   - Append-only so a server crash mid-write loses at most one line.
 *
 * Why this exists: chat events used to live only in the in-memory chatStore.
 * A server restart wiped every parent chat AND made --resume impossible
 * (sessionId lives in a `session_started` event, also in memory only). With
 * this layer, on every (re)subscribe the slug's events replay from disk and
 * the ChatStore can re-issue --resume against the saved sessionId.
 *
 * `slug=null` (the unused "global" chat) has no folder so its events stay
 * in-memory only — that's intentional, not an oversight.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ChatEvent } from './types.js';

// ESM __dirname; resolve up to repo root from editor/server/src/chat/.
const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');

function chatLogPath(slug: string): string {
  return path.join(REPO_ROOT, 'videos', slug, '.cache', 'chat-history.jsonl');
}

export type LoadedChat = {
  events: ChatEvent[];
  sessionId: string | null;
};

export function loadChatHistory(slug: string): LoadedChat {
  const p = chatLogPath(slug);
  if (!fs.existsSync(p)) return { events: [], sessionId: null };
  const raw = fs.readFileSync(p, 'utf8');
  const events: ChatEvent[] = [];
  let sessionId: string | null = null;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as ChatEvent;
      events.push(e);
      if (e.kind === 'session_started') sessionId = e.sessionId;
    } catch {
      // Skip corrupt lines — append-only writes can't produce them in normal
      // operation, but a kill-9 mid-write could leave a partial line.
    }
  }
  return { events, sessionId };
}

export function appendChatEvent(slug: string, e: ChatEvent): void {
  const p = chatLogPath(slug);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(e) + '\n');
}

export function clearChatHistory(slug: string): void {
  const p = chatLogPath(slug);
  if (fs.existsSync(p)) fs.rmSync(p);
}
