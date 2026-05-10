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
   * Send a turn into the slug's chat. If a turn is already in flight, kill it
   * and start the new one (interrupt-and-redirect, same as before). The raw
   * user text is recorded as a `user_text` event so replays show it without
   * needing the client to keep its own copy.
   */
  async turn(slug: string | null, userText: string): Promise<void> {
    const s = this.ensure(slug);
    if (s.inFlight) {
      s.inFlight.cancel();
      try {
        await s.inFlight.wait;
      } catch {
        /* gone */
      }
      s.inFlight = null;
    }

    const userEvent: ChatEvent = { kind: 'user_text', text: userText, ts: Date.now() };
    s.events.push(userEvent);
    if (slug) appendChatEvent(slug, userEvent);
    for (const fn of this.listeners) fn(slug, userEvent);

    const directive = buildDirective(slug, userText);
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

    // Don't await here — caller (WS handler) returns immediately so the
    // socket can keep handling other frames while the turn runs.
    void handle.wait.finally(() => {
      if (s.inFlight === handle) s.inFlight = null;
      this.emitInFlight(slug, false);
    });
  }

  /** Stop the current turn without sending another. */
  cancel(slug: string | null): void {
    const s = this.sessions.get(slug);
    if (!s || !s.inFlight) return;
    s.inFlight.cancel();
  }

  /** Wipe a slug's chat (forget session, clear history). Used by reset/clear. */
  reset(slug: string | null): void {
    const s = this.sessions.get(slug);
    if (!s) return;
    if (s.inFlight) s.inFlight.cancel();
    s.events = [];
    s.sessionId = null;
    s.inFlight = null;
    if (slug) clearChatHistory(slug);
    this.emitInFlight(slug, false);
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
