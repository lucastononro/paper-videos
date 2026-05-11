import { randomUUID } from 'node:crypto';
import { spawnClaudeTurn, type ClaudeRunHandle } from '../chat/spawn.js';
import { chatStore } from '../chat/store.js';
import { buildThreadDirective, buildFinishPrompt, extractSummary } from './directive.js';
import type { Thread, ThreadScope, ThreadStatus, ThreadEvent } from './types.js';
import type { ChatEvent } from '../chat/types.js';
import { readManifest } from '../../../../src/lib/manifest.js';

type ThreadRecord = Thread & {
  inFlight: ClaudeRunHandle | null;
  /** Plain accumulator for the most recent assistant message — used by the
   *  finish-handoff path to extract `SUMMARY:` from the last reply. */
  lastAssistantText: string;
  /** Set on a finish-pending thread so the next assistant `done` event can
   *  pull the summary out, broadcast a `thread:notice`, and flip status. */
  finishPending: boolean;
};

type Subscriber = (e: ThreadEvent) => void;

class ThreadStore {
  private threads = new Map<string, ThreadRecord>();
  private subscribers = new Set<Subscriber>();

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  list(slug?: string): Thread[] {
    const all = [...this.threads.values()].map(this.toPlain);
    return slug ? all.filter((t) => t.slug === slug) : all;
  }

  /**
   * Active = ready / running / awaiting_finish. Used to inject an
   * "active threads" awareness block into the parent agent's directive
   * so it knows what's running in parallel without having to re-derive
   * from chat history.
   */
  listActive(slug: string): Thread[] {
    return this.list(slug).filter(
      (t) => t.status === 'ready' || t.status === 'running' || t.status === 'awaiting_finish',
    );
  }

  get(threadId: string): Thread | null {
    const t = this.threads.get(threadId);
    return t ? this.toPlain(t) : null;
  }

  /** Snapshot everything (including buffered events) for a hydrating client. */
  snapshot(threadId: string): { thread: Thread; events: ChatEvent[] } | null {
    const t = this.threads.get(threadId);
    if (!t) return null;
    return { thread: this.toPlain(t), events: [...t.events] };
  }

  /**
   * Create a thread and immediately spawn the child claude process with the
   * scoped directive + the user's initial ask.
   */
  create(args: {
    parentConnId: string;
    slug: string;
    scope: ThreadScope;
    initialAsk: string;
  }): Thread {
    const id = randomUUID();
    const now = Date.now();
    // Derive overlapping beat / block ids from the time range when present.
    // The user only selects a time crop on the filmstrip; the harness fills
    // in beats/blocks so the agent has a finding aid pointing at the right
    // files. (Older callers can still pass beatIds/blockIds directly.)
    const enrichedScope = enrichScope(args.slug, args.scope);
    const rec: ThreadRecord = {
      id,
      parentConnId: args.parentConnId,
      slug: args.slug,
      scope: enrichedScope,
      status: 'ready',
      initialAsk: args.initialAsk,
      sessionId: null,
      events: [],
      summary: null,
      createdAt: now,
      updatedAt: now,
      inFlight: null,
      lastAssistantText: '',
      finishPending: false,
    };
    this.threads.set(id, rec);
    this.broadcast({ kind: 'thread:created', thread: this.toPlain(rec) });
    // Record the initial ask in the thread's events so reconnect-replays show
    // the user's first message.
    const userEvent: ChatEvent = { kind: 'user_text', text: args.initialAsk, ts: Date.now() };
    rec.events.push(userEvent);
    this.broadcast({ kind: 'thread:event', threadId: rec.id, event: userEvent });
    // Persist a "started" notice in the PARENT chat so the main agent (and
    // a reload-after-navigate) sees that a spot-edit thread was spawned and
    // what its initial ask was. The summary slot carries the user's ask
    // verbatim — short enough to read at a glance, long enough that the
    // main agent can reason about whether other beats need similar work.
    chatStore.recordEvent(args.slug, {
      kind: 'thread_notice',
      threadId: rec.id,
      scopeLabel: scopeShortLabel(enrichedScope),
      summary: args.initialAsk,
      status: 'started',
      ts: Date.now(),
    });
    // Kick off the first turn synchronously.
    this.runTurn(rec, buildThreadDirective(args.slug, enrichedScope, args.initialAsk));
    return this.toPlain(rec);
  }

  /** Send a follow-up turn into an existing thread (interrupts an in-flight one). */
  turn(threadId: string, text: string): boolean {
    const rec = this.threads.get(threadId);
    if (!rec) return false;
    // Record the user's message in the thread's events so a reconnect-replay
    // shows it. Mirrors the parent chat's behavior.
    const userEvent: ChatEvent = { kind: 'user_text', text, ts: Date.now() };
    rec.events.push(userEvent);
    this.broadcast({ kind: 'thread:event', threadId: rec.id, event: userEvent });
    // Surface the continuation to the parent chat so the main agent stays
    // aware of what the user has been asking the spot-edit thread to do.
    chatStore.recordEvent(rec.slug, {
      kind: 'thread_notice',
      threadId: rec.id,
      scopeLabel: scopeShortLabel(rec.scope),
      summary: text,
      status: 'continued',
      ts: Date.now(),
    });
    void this.cancelInFlight(rec);
    this.runTurn(rec, text);
    return true;
  }

  /** Ask the agent to wrap up: mark `awaiting_finish` and inject the finish prompt. */
  finish(threadId: string): boolean {
    const rec = this.threads.get(threadId);
    if (!rec) return false;
    if (rec.status === 'completed' || rec.status === 'failed' || rec.status === 'ended')
      return false;
    rec.finishPending = true;
    this.setStatus(rec, 'awaiting_finish');
    void this.cancelInFlight(rec).then(() => {
      this.runTurn(rec, buildFinishPrompt(rec.scope));
    });
    return true;
  }

  /** Hard-stop a thread without a summary (user clicked "End"). */
  end(threadId: string): boolean {
    const rec = this.threads.get(threadId);
    if (!rec) return false;
    void this.cancelInFlight(rec);
    rec.finishPending = false;
    this.setStatus(rec, 'ended');
    // Tell the parent agent the thread was force-ended so it doesn't keep
    // expecting a handoff summary.
    chatStore.recordEvent(rec.slug, {
      kind: 'thread_notice',
      threadId: rec.id,
      scopeLabel: scopeShortLabel(rec.scope),
      summary: '',
      status: 'ended',
      ts: Date.now(),
    });
    return true;
  }

  cancel(threadId: string): boolean {
    const rec = this.threads.get(threadId);
    if (!rec) return false;
    void this.cancelInFlight(rec);
    if (rec.status === 'running') this.setStatus(rec, 'ready');
    return true;
  }

  delete(threadId: string): boolean {
    const rec = this.threads.get(threadId);
    if (!rec) return false;
    if (rec.status === 'running' || rec.status === 'awaiting_finish') return false;
    void this.cancelInFlight(rec);
    this.threads.delete(threadId);
    return true;
  }

  /**
   * Connection went away. We do NOT cancel running threads — the user might
   * have just refreshed the page and is about to reconnect. Threads stay
   * alive; their events accumulate in `events[]` for replay.
   *
   * (If you genuinely want to terminate a thread, call `end()` from the UI.)
   */
  detachConn(_parentConnId: string): void {
    /* no-op — threads survive WS disconnect */
  }

  // ----- internals -----

  private toPlain(t: ThreadRecord): Thread {
    return {
      id: t.id,
      parentConnId: t.parentConnId,
      slug: t.slug,
      scope: t.scope,
      status: t.status,
      initialAsk: t.initialAsk,
      sessionId: t.sessionId,
      events: t.events,
      summary: t.summary,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private setStatus(rec: ThreadRecord, status: ThreadStatus, summary?: string): void {
    if (rec.status === status && (summary === undefined || rec.summary === summary)) return;
    rec.status = status;
    rec.updatedAt = Date.now();
    if (summary !== undefined) rec.summary = summary;
    this.broadcast({ kind: 'thread:status', threadId: rec.id, status, summary });
  }

  private async cancelInFlight(rec: ThreadRecord): Promise<void> {
    if (!rec.inFlight) return;
    rec.inFlight.cancel();
    try {
      await rec.inFlight.wait;
    } catch {
      /* nothing */
    }
    rec.inFlight = null;
  }

  private runTurn(rec: ThreadRecord, directive: string): void {
    rec.lastAssistantText = '';
    if (rec.status !== 'awaiting_finish') this.setStatus(rec, 'running');
    const handle = spawnClaudeTurn({
      text: directive,
      resumeSessionId: rec.sessionId,
      onEvent: (e) => this.onChildEvent(rec, e),
    });
    rec.inFlight = handle;
    void handle.wait.finally(() => {
      if (rec.inFlight === handle) rec.inFlight = null;
      this.onTurnComplete(rec);
    });
  }

  private onChildEvent(rec: ThreadRecord, e: ChatEvent): void {
    if (e.kind === 'session_started') rec.sessionId = e.sessionId;
    if (e.kind === 'text') rec.lastAssistantText += e.text;
    rec.events.push(e);
    this.broadcast({ kind: 'thread:event', threadId: rec.id, event: e });
  }

  private onTurnComplete(rec: ThreadRecord): void {
    // Two paths to "completed":
    //  1. The user clicked Finish (rec.finishPending = true) — explicit handoff.
    //  2. The agent decided it's done and emitted a `SUMMARY: …` line on its
    //     own — we treat that as auto-finish, no separate user click needed.
    // The directive (see directive.ts) tells the agent it CAN do (2) when the
    // task is genuinely complete, so the user doesn't have to babysit a
    // "Finish" button for every spot-edit.
    const spontaneousSummary = extractSummary(rec.lastAssistantText);
    const shouldComplete = rec.finishPending || spontaneousSummary !== null;
    if (shouldComplete) {
      const summary = spontaneousSummary ?? rec.lastAssistantText.trim();
      rec.finishPending = false;
      this.setStatus(rec, 'completed', summary);
      this.broadcast({
        kind: 'thread:notice',
        slug: rec.slug,
        threadId: rec.id,
        status: 'completed',
        scope: rec.scope,
        summary,
      });
      chatStore.recordEvent(rec.slug, {
        kind: 'thread_notice',
        threadId: rec.id,
        scopeLabel: scopeShortLabel(rec.scope),
        summary,
        status: 'completed',
        ts: Date.now(),
      });
      return;
    }
    // Otherwise the turn just finished — back to ready, awaiting next ask.
    if (rec.status === 'running') this.setStatus(rec, 'ready');
  }

  private broadcast(e: ThreadEvent): void {
    for (const fn of this.subscribers) {
      try {
        fn(e);
      } catch {
        /* noop */
      }
    }
  }
}

function scopeShortLabel(s: ThreadScope): string {
  if (s.label) return s.label;
  const parts: string[] = [];
  if (s.beatIds.length) parts.push(s.beatIds.join(', '));
  if (s.blockIds.length) parts.push(s.blockIds.join(', '));
  return parts.join(' + ') || 'video';
}

/**
 * Fill in derived `beatIds`/`blockIds` from a time range. The user only
 * selects a crop on the filmstrip; we resolve which manifest entries
 * overlap so the spot-edit agent's directive can point at the right files.
 *
 * Idempotent: when the scope already carries beatIds/blockIds (older
 * single-beat/single-block callers), we keep them unchanged.
 */
function enrichScope(slug: string, scope: ThreadScope): ThreadScope {
  const hasRange = typeof scope.startFrame === 'number' && typeof scope.endFrame === 'number';
  const hasIds = scope.beatIds.length > 0 || scope.blockIds.length > 0;
  if (!hasRange || hasIds) return scope;
  let manifest;
  try {
    manifest = readManifest(slug);
  } catch {
    return scope;
  }
  const startFrame = scope.startFrame!;
  const endFrame = scope.endFrame!;
  const overlaps = (s: number, d: number) => s + d > startFrame && s < endFrame;
  return {
    ...scope,
    beatIds: manifest.voice
      .filter((b) => overlaps(b.startFrame, b.durationFrames))
      .map((b) => b.id),
    blockIds: manifest.visualBlocks
      .filter((b) => overlaps(b.startFrame, b.durationFrames))
      .map((b) => b.id),
  };
}

export const threadStore = new ThreadStore();
