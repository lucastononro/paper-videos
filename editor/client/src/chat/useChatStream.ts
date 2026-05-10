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
  appendUser: (slug: string, text: string) => void;
  ingest: (slug: string, e: ServerEvent) => void;
  setInFlight: (slug: string, v: boolean) => void;
  cancel: (slug: string) => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  itemsBySlug: {},
  inFlightBySlug: {},
  appendUser: (slug, text) => {
    set((s) => {
      const items = s.itemsBySlug[slug] ?? [];
      const next = [
        ...items,
        { kind: 'user' as const, id: `u-${Date.now()}-${Math.random()}`, text, ts: Date.now() },
      ];
      return {
        itemsBySlug: { ...s.itemsBySlug, [slug]: next },
        inFlightBySlug: { ...s.inFlightBySlug, [slug]: true },
      };
    });
  },
  ingest: (slug, e) => {
    set((s) => {
      const items = s.itemsBySlug[slug] ?? [];
      const next = applyEvent(items, e);
      const inFlight = { ...s.inFlightBySlug };
      if (e.kind === 'done' || e.kind === 'error') inFlight[slug] = false;
      return { itemsBySlug: { ...s.itemsBySlug, [slug]: next }, inFlightBySlug: inFlight };
    });
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
}));

function applyEvent(items: ChatItem[], e: ServerEvent): ChatItem[] {
  switch (e.kind) {
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
    case 'error':
      return [...items, { kind: 'system', id: `err-${Date.now()}`, ts: Date.now(), text: `error: ${e.message}` }];
    case 'done':
    case 'preview:reload':
    case 'system_raw':
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
 * Subscribes to `subscribe:slug` so the server can scope `preview:reload`.
 */
export function useWsBindings(slug: string): void {
  React.useEffect(() => {
    ws.start();
    ws.send({ kind: 'subscribe:slug', slug });
    const off = ws.on((e) => {
      if (e.kind === 'preview:reload') {
        // Phase E hooks this in EditorPage.
        window.dispatchEvent(new CustomEvent('preview:reload', { detail: e }));
        return;
      }
      useChatStore.getState().ingest(slug, e);
    });
    return () => {
      off();
    };
  }, [slug]);
}
