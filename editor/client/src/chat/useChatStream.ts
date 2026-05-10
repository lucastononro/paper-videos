import React from 'react';
import { create } from 'zustand';
import { ws } from '../ws/client';
import type { ServerEvent } from '../ws/types';

export type ChatTextItem = { kind: 'text'; messageId: string; text: string };
export type ChatToolItem = {
  kind: 'tool';
  toolUseId: string;
  messageId: string;
  name: string;
  input: unknown;
  status: 'running' | 'done' | 'error';
  result: string | null;
};

export type ChatItem =
  | { kind: 'user'; id: string; text: string; ts: number }
  | { kind: 'assistant'; id: string; ts: number; chunks: Array<ChatTextItem | ChatToolItem> }
  | { kind: 'system'; id: string; ts: number; text: string }
  | { kind: 'notice'; id: string; ts: number; text: string; tone: 'success' | 'info' };

type ChatState = {
  itemsBySlug: Record<string, ChatItem[]>;
  inFlightBySlug: Record<string, boolean>;
  /** True when the server has just confirmed a clean replay for this slug.
   *  Used to gate the "reset on send" behavior; user echo is skipped while
   *  the server hasn't sent its first replay yet. */
  hydratedBySlug: Record<string, boolean>;
  ingest: (slug: string, e: ServerEvent) => void;
  /** Server-driven replay (called on (re)subscribe). Resets the slug's buffer. */
  replay: (slug: string, events: ServerEvent[]) => void;
  setInFlight: (slug: string, v: boolean) => void;
  cancel: (slug: string) => void;
  /** Local-only — clears the visible chat without telling the server. Use the
   *  ChatPanel reset button (which fires `chat:reset` over WS) for a real reset. */
  clearLocal: (slug: string) => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  itemsBySlug: {},
  inFlightBySlug: {},
  hydratedBySlug: {},
  ingest: (slug, e) => {
    set((s) => {
      const items = s.itemsBySlug[slug] ?? [];
      const next = applyEvent(items, e);
      const inFlight = { ...s.inFlightBySlug };
      if (e.kind === 'done' || e.kind === 'error') inFlight[slug] = false;
      // user_text from server confirms our turn was accepted; mark in-flight.
      if (e.kind === 'user_text') inFlight[slug] = true;
      return { itemsBySlug: { ...s.itemsBySlug, [slug]: next }, inFlightBySlug: inFlight };
    });
  },
  replay: (slug, events) => {
    let items: ChatItem[] = [];
    let inFlight = false;
    for (const e of events) {
      items = applyEvent(items, e);
      if (e.kind === 'user_text') inFlight = true;
      if (e.kind === 'done' || e.kind === 'error') inFlight = false;
    }
    set((s) => ({
      itemsBySlug: { ...s.itemsBySlug, [slug]: items },
      inFlightBySlug: { ...s.inFlightBySlug, [slug]: inFlight },
      hydratedBySlug: { ...s.hydratedBySlug, [slug]: true },
    }));
  },
  setInFlight: (slug, v) =>
    set((s) => ({ inFlightBySlug: { ...s.inFlightBySlug, [slug]: v } })),
  cancel: (slug) => {
    ws.send({ kind: 'chat:cancel' });
    const items = get().itemsBySlug[slug] ?? [];
    const last = items[items.length - 1];
    if (last && last.kind === 'assistant') {
      const newChunks = last.chunks.map((c) =>
        c.kind === 'tool' && c.status === 'running' ? { ...c, status: 'error' as const, result: '(cancelled)' } : c,
      );
      const updated: ChatItem = { ...last, chunks: newChunks };
      set((s) => ({
        itemsBySlug: { ...s.itemsBySlug, [slug]: [...items.slice(0, -1), updated] },
        inFlightBySlug: { ...s.inFlightBySlug, [slug]: false },
      }));
    } else {
      set((s) => ({ inFlightBySlug: { ...s.inFlightBySlug, [slug]: false } }));
    }
  },
  clearLocal: (slug) =>
    set((s) => ({
      itemsBySlug: { ...s.itemsBySlug, [slug]: [] },
      inFlightBySlug: { ...s.inFlightBySlug, [slug]: false },
    })),
}));

function applyEvent(items: ChatItem[], e: ServerEvent): ChatItem[] {
  switch (e.kind) {
    case 'user_text':
      return [
        ...items,
        { kind: 'user', id: `u-${e.ts}-${Math.random()}`, text: e.text, ts: e.ts },
      ];
    case 'text': {
      const last = items[items.length - 1];
      if (last && last.kind === 'assistant' && last.id === e.messageId) {
        return [
          ...items.slice(0, -1),
          { ...last, chunks: [...last.chunks, { kind: 'text', messageId: e.messageId, text: e.text }] },
        ];
      }
      return [
        ...items,
        {
          kind: 'assistant',
          id: e.messageId,
          ts: Date.now(),
          chunks: [{ kind: 'text', messageId: e.messageId, text: e.text }],
        },
      ];
    }
    case 'tool_use': {
      const last = items[items.length - 1];
      const newChunk: ChatToolItem = {
        kind: 'tool',
        toolUseId: e.toolUseId,
        messageId: e.messageId,
        name: e.name,
        input: e.input,
        status: 'running',
        result: null,
      };
      if (last && last.kind === 'assistant' && last.id === e.messageId) {
        return [...items.slice(0, -1), { ...last, chunks: [...last.chunks, newChunk] }];
      }
      return [
        ...items,
        { kind: 'assistant', id: e.messageId, ts: Date.now(), chunks: [newChunk] },
      ];
    }
    case 'tool_result': {
      // Find the tool chunk by toolUseId across all assistant items.
      const next = items.map((it) => {
        if (it.kind !== 'assistant') return it;
        const chunks = it.chunks.map((c) => {
          if (c.kind === 'tool' && c.toolUseId === e.toolUseId) {
            return {
              ...c,
              status: e.isError ? ('error' as const) : ('done' as const),
              result: e.content,
            };
          }
          return c;
        });
        return { ...it, chunks } as ChatItem;
      });
      return next;
    }
    case 'session_started':
      return items;
    case 'rate_limit':
      return items;
    case 'thread_notice': {
      // Persisted notice from a forked spot-edit thread. Server pushes this
      // into the slug's history so refresh / navigate-back replays it.
      // Dedup on threadId so a live event + replay can't double-add.
      if (items.some((it) => it.kind === 'notice' && it.id === `tn-${e.threadId}`)) return items;
      return [
        ...items,
        {
          kind: 'notice',
          id: `tn-${e.threadId}`,
          ts: e.ts,
          text: `Spot edit on ${e.scopeLabel} — ${e.summary}`,
          tone: e.status === 'completed' ? 'success' : 'info',
        },
      ];
    }
    case 'error':
      return [...items, { kind: 'system', id: `err-${Date.now()}`, ts: Date.now(), text: `error: ${e.message}` }];
    case 'done':
    case 'preview:reload':
    case 'system_raw':
    case 'chat:replay':
    case 'inflight:changed':
    case 'render:state':
    case 'render:progress':
    case 'render:done':
      return items;
    // Thread events are handled by the threads store, not the parent chat.
    case 'thread:created':
    case 'thread:status':
    case 'thread:event':
    case 'thread:notice':
      return items;
  }
}

/**
 * Hook that wires the WS singleton into the chat store for one slug.
 *
 * The server replays the slug's full event history on every (re)subscribe via
 * a `chat:replay` event — that's how a page refresh / tab navigation rebuilds
 * the chat without losing context. The chat subprocess on the server keeps
 * running across WS disconnects so events accumulate in the slug's history.
 */
export function useWsBindings(slug: string): void {
  React.useEffect(() => {
    ws.start();
    ws.send({ kind: 'subscribe:slug', slug });
    const off = ws.on((e) => {
      if (e.kind === 'preview:reload') {
        window.dispatchEvent(new CustomEvent('preview:reload', { detail: e }));
        return;
      }
      if (e.kind === 'chat:replay' && (e.slug === slug || e.slug === null)) {
        useChatStore.getState().replay(slug, e.events);
        return;
      }
      if (e.kind === 'inflight:changed' && e.slug === slug) {
        useChatStore.getState().setInFlight(slug, e.inFlight);
        return;
      }
      useChatStore.getState().ingest(slug, e);
    });
    return () => {
      off();
    };
  }, [slug]);
}
