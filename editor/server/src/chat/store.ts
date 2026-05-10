import { spawnClaudeTurn, type ClaudeRunHandle } from './spawn.js';
import { buildDirective } from './directive.js';
import { appendChatEvent, clearChatHistory, loadChatHistory } from './persistence.js';
import type { ChatEvent } from './types.js';

/**
 * Per-slug chat session.
 *
 * Why per-slug (not per-connection):
 *  - The user's chat survives page reloads / tab navigations / WS reconnects.
 *  - The claude subprocess keeps running while the user is away (gallery,
 *    other tab, refresh) — when they return, the buffered events replay.
 *  - --resume uses the slug's stable session_id so multi-turn continuity
 *    spans reconnects.
 *
 * `slug=null` covers any chat that isn't tied to a project (currently unused
 * in the UI; reserved for future "global" conversations).
 */

type Session = {
  slug: string | null;
  events: ChatEvent[];
  sessionId: string | null;
  inFlight: ClaudeRunHandle | null;
  /** Connection ids currently subscribed to this slug's chat. */
  subscribers: Set<string>;
  /**
   * Timestamp (ms) up to which thread_notice events have been delivered
   * into the parent agent's directive. Anything newer than this gets
   * inlined as `<async_thread_context>` on the next turn and then this
   * cursor is bumped. In-memory only — server restart redelivers all
   * notices, which is desirable (the agent's session was reset too).
   */
  lastNoticeDeliveredTs: number;
  /**
   * Cursor-style message queue: messages typed while a turn is in-flight
   * land here instead of interrupting. They drain FIFO when the active
   * turn completes. In-memory only — server restart drops the queue.
   */
  queue: Array<{ id: string; text: string; ts: number }>;
};

type Listener = (slug: string | null, e: ChatEvent) => void;
type InFlightListener = (slug: string | null, inFlight: boolean) => void;

class ChatStore {
  private sessions = new Map<string | null, Session>();
  private listeners = new Set<Listener>();
  private inFlightListeners = new Set<InFlightListener>();

  /** Subscribe to events. Used by ws.ts to forward to all relevant connections. */
  onEvent(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Subscribe to in-flight transitions. Used by the gallery broadcaster. */
  onInFlightChange(fn: InFlightListener): () => void {
    this.inFlightListeners.add(fn);
    return () => this.inFlightListeners.delete(fn);
  }

  isInFlight(slug: string | null): boolean {
    return Boolean(this.sessions.get(slug)?.inFlight);
  }

  /** Slugs (string only — null is excluded) currently running a chat turn. */
  inFlightSlugs(): Set<string> {
    const out = new Set<string>();
    for (const s of this.sessions.values()) {
      if (s.slug && s.inFlight) out.add(s.slug);
    }
    return out;
  }

  history(slug: string | null): ChatEvent[] {
    return [...(this.sessions.get(slug)?.events ?? [])];
  }

  /**
   * Push an externally-produced event into the slug's history and broadcast
   * it to subscribers. Used by the thread store to inject `thread_notice`
   * events into the parent chat (so a refresh / navigation replays the same
   * notice the live UI showed). The event also flows through `onEvent`
   * listeners, which means ws.ts forwards it to subscribed connections — no
   * extra plumbing needed.
   */
  recordEvent(slug: string | null, e: ChatEvent): void {
    const s = this.ensure(slug);
    s.events.push(e);
    if (slug) appendChatEvent(slug, e);
    for (const fn of this.listeners) fn(slug, e);
  }

  hasSession(slug: string | null): boolean {
    return this.sessions.has(slug);
  }

  /** Tag a connection as listening to a slug's events. */
  attach(connId: string, slug: string | null): void {
    const s = this.ensure(slug);
    s.subscribers.add(connId);
  }

  /** Remove a connection. The subprocess (if any) keeps running. */
  detach(connId: string, slug: string | null): void {
    const s = this.sessions.get(slug);
    if (s) s.subscribers.delete(connId);
  }

  detachAll(connId: string): void {
    for (const s of this.sessions.values()) s.subscribers.delete(connId);
  }

  /**
   * Send a turn into the slug's chat. Cursor-style queuing:
   *  - If no turn is in flight, the message starts a new turn immediately.
   *  - If a turn IS in flight, the message is appended to the per-slug
   *    queue and broadcast as a `chat:queue` event so the UI can render
   *    a "queued" bubble. When the active turn completes, the queue
   *    drains FIFO — the first queued message becomes the next turn.
   *
   * Old behaviour (interrupt-and-redirect) was lossy: a half-finished
   * agent reply was killed and the new message often took a beat to echo
   * back, making the user think the message disappeared.
   *
   * To genuinely interrupt the current turn (Stop button), call
   * `cancel(slug)` separately. That path doesn't enqueue anything.
   */
  async turn(slug: string | null, userText: string): Promise<void> {
    const s = this.ensure(slug);
    if (s.inFlight) {
      const id = `qm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      s.queue.push({ id, text: userText, ts: Date.now() });
      this.emitQueue(slug, s);
      return;
    }
    await this.runTurn(slug, s, userText);
  }

  /**
   * Internal: actually start a turn. Records the user_text event, builds
   * the directive (with async-thread context), spawns claude, and on
   * completion drains one item from the queue if anything is pending.
   */
  private async runTurn(slug: string | null, s: Session, userText: string): Promise<void> {
    const userEvent: ChatEvent = { kind: 'user_text', text: userText, ts: Date.now() };
    s.events.push(userEvent);
    if (slug) appendChatEvent(slug, userEvent);
    for (const fn of this.listeners) fn(slug, userEvent);

    // Prepend an `<async_thread_context>` block so the parent agent sees
    // any pending spot-edit notices + active threads. Lazy import to avoid
    // a circular dep at module-init time.
    const pendingNotices = this.consumePendingNotices(slug);
    let activeThreads: Array<{ scopeLabel: string; status: string }> = [];
    if (slug) {
      const { threadStore } = await import('../threads/store.js');
      const { describeScope } = await import('../threads/directive.js');
      activeThreads = threadStore.listActive(slug).map((t) => ({
        scopeLabel: describeScope(t.scope),
        status: t.status,
      }));
    }
    const directive = buildDirective(slug, userText, { pendingNotices, activeThreads });
    const handle = spawnClaudeTurn({
      text: directive,
      resumeSessionId: s.sessionId,
      onEvent: (e: ChatEvent) => {
        if (e.kind === 'session_started') s.sessionId = e.sessionId;
        s.events.push(e);
        if (slug) appendChatEvent(slug, e);
        for (const fn of this.listeners) fn(slug, e);
      },
    });
    s.inFlight = handle;
    this.emitInFlight(slug, true);

    // Don't await here — caller returns immediately so the WS hub can keep
    // handling frames. Drain the queue FIFO when this turn completes.
    void handle.wait.finally(() => {
      if (s.inFlight === handle) s.inFlight = null;
      this.emitInFlight(slug, false);
      const next = s.queue.shift();
      if (next) {
        // A queued message is now becoming the active turn. Broadcast the
        // smaller queue first (so the UI removes it from the queued list),
        // then start the turn — runTurn will emit user_text which the UI
        // promotes to a real bubble.
        this.emitQueue(slug, s);
        void this.runTurn(slug, s, next.text).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[chat] queued runTurn failed', err);
        });
      }
    });
  }

  /** Stop the current turn without sending another. Does NOT touch the queue. */
  cancel(slug: string | null): void {
    const s = this.sessions.get(slug);
    if (!s || !s.inFlight) return;
    s.inFlight.cancel();
  }

  /**
   * Remove a queued message (or all of them) without affecting the
   * currently-running turn. `id` omitted = clear the entire queue.
   */
  cancelQueued(slug: string | null, id?: string): void {
    const s = this.sessions.get(slug);
    if (!s) return;
    if (id) {
      s.queue = s.queue.filter((q) => q.id !== id);
    } else {
      s.queue = [];
    }
    this.emitQueue(slug, s);
  }

  /** Snapshot of the queued messages for a slug (for replay on resubscribe). */
  queueSnapshot(slug: string | null): Array<{ id: string; text: string; ts: number }> {
    const s = this.sessions.get(slug);
    return s ? [...s.queue] : [];
  }

  private emitQueue(slug: string | null, s: Session): void {
    const event: ChatEvent = {
      kind: 'chat:queue',
      slug: slug ?? null,
      queue: s.queue.map((q) => ({ id: q.id, text: q.text, ts: q.ts })),
    };
    for (const fn of this.listeners) fn(slug, event);
  }

  /** Wipe a slug's chat (forget session, clear history). Used by reset/clear. */
  reset(slug: string | null): void {
    const s = this.sessions.get(slug);
    if (!s) return;
    if (s.inFlight) s.inFlight.cancel();
    s.events = [];
    s.sessionId = null;
    s.inFlight = null;
    s.queue = [];
    if (slug) clearChatHistory(slug);
    this.emitInFlight(slug, false);
    this.emitQueue(slug, s);
  }

  /**
   * Pull out thread_notice events that haven't been delivered to the parent
   * agent yet, mark them delivered, and return them so the directive can
   * inline them as `<async_thread_context>`. Mirrors simp's
   * `consumePendingThreadNotices` pattern.
   */
  consumePendingNotices(slug: string | null): Array<Extract<ChatEvent, { kind: 'thread_notice' }>> {
    if (!slug) return [];
    const s = this.ensure(slug);
    const cutoff = s.lastNoticeDeliveredTs;
    const pending = s.events
      .filter((e): e is Extract<ChatEvent, { kind: 'thread_notice' }> => e.kind === 'thread_notice')
      .filter((e) => e.ts > cutoff);
    if (pending.length > 0) {
      s.lastNoticeDeliveredTs = Math.max(...pending.map((e) => e.ts));
    }
    return pending;
  }

  private ensure(slug: string | null): Session {
    let s = this.sessions.get(slug);
    if (!s) {
      // Hydrate from disk on first touch — this is what restores chat
      // history (and the Claude --resume sessionId) across server restarts.
      // For slug=null there's no folder, so events stay in-memory.
      const loaded = slug ? loadChatHistory(slug) : { events: [], sessionId: null };
      s = {
        slug,
        events: loaded.events,
        sessionId: loaded.sessionId,
        inFlight: null,
        subscribers: new Set(),
        // Start the cursor at 0 so any notices already in history (loaded
        // from disk) get delivered to the parent on its next turn after
        // the server restart.
        lastNoticeDeliveredTs: 0,
        queue: [],
      };
      this.sessions.set(slug, s);
    }
    return s;
  }

  private emitInFlight(slug: string | null, inFlight: boolean): void {
    for (const fn of this.inFlightListeners) fn(slug, inFlight);
  }
}

export const chatStore = new ChatStore();
