import { randomUUID } from 'node:crypto';
import { spawnClaudeTurn, type ClaudeRunHandle } from '../chat/spawn.js';
import { buildThreadDirective, buildFinishPrompt, extractSummary } from './directive.js';
import type { Thread, ThreadScope, ThreadStatus, ThreadEvent } from './types.js';
import type { ChatEvent } from '../chat/types.js';

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
    const rec: ThreadRecord = {
      id,
      parentConnId: args.parentConnId,
      slug: args.slug,
      scope: args.scope,
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
    // Kick off the first turn synchronously.
    this.runTurn(rec, buildThreadDirective(args.slug, args.scope, args.initialAsk));
    return this.toPlain(rec);
  }

  /** Send a follow-up turn into an existing thread (interrupts an in-flight one). */
  turn(threadId: string, text: string): boolean {
    const rec = this.threads.get(threadId);
    if (!rec) return false;
    void this.cancelInFlight(rec);
    this.runTurn(rec, text);
    return true;
  }

  /** Ask the agent to wrap up: mark `awaiting_finish` and inject the finish prompt. */
  finish(threadId: string): boolean {
    const rec = this.threads.get(threadId);
    if (!rec) return false;
    if (rec.status === 'completed' || rec.status === 'failed' || rec.status === 'ended') return false;
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

  /** Drop all threads associated with a disconnected WS connection. */
  clearForConn(parentConnId: string): void {
    for (const [id, rec] of [...this.threads.entries()]) {
      if (rec.parentConnId === parentConnId) {
        void this.cancelInFlight(rec);
        this.threads.delete(id);
      }
    }
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
    // If the user requested finish, parse the summary out of the last assistant
    // message, complete the thread, and emit a parent notice.
    if (rec.finishPending) {
      const summary = extractSummary(rec.lastAssistantText) ?? rec.lastAssistantText.trim();
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

export const threadStore = new ThreadStore();
