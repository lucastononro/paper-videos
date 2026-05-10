import React from 'react';
import { create } from 'zustand';
import { ws } from '../ws/client';
import type {
  ChatEvent,
  ServerEvent,
  ThreadScope,
  ThreadStatus,
  ThreadSummary,
} from '../ws/types';
import type { ChatItem } from '../chat/useChatStream';
import { useChatStore } from '../chat/useChatStream';

export type ThreadView = ThreadSummary & {
  /** Materialized chat timeline derived from `events`. */
  items: ChatItem[];
  /** Locally-typed user messages waiting for echo. Visible immediately. */
  pendingUserText: string | null;
};

type ThreadState = {
  threadsBySlug: Record<string, ThreadView[]>;
  selectedByslug: Record<string, string | null>;
  /** Open / closed state of the right-side panel, per slug. */
  panelOpenBySlug: Record<string, boolean>;
  panelOpen: (slug: string) => boolean;
  setPanelOpen: (slug: string, open: boolean) => void;
  selectThread: (slug: string, threadId: string | null) => void;
  ingest: (e: ServerEvent) => void;
  /** Local-echo a user message under a thread. Server will reflect via events. */
  appendLocalUser: (threadId: string, text: string) => void;
  /** Find by id across all slugs. */
  findThread: (threadId: string) => ThreadView | null;
};

export const useThreadStore = create<ThreadState>((set, get) => ({
  threadsBySlug: {},
  selectedByslug: {},
  panelOpenBySlug: {},
  panelOpen: (slug) => Boolean(get().panelOpenBySlug[slug]),
  setPanelOpen: (slug, open) =>
    set((s) => ({ panelOpenBySlug: { ...s.panelOpenBySlug, [slug]: open } })),
  selectThread: (slug, threadId) =>
    set((s) => ({ selectedByslug: { ...s.selectedByslug, [slug]: threadId } })),
  ingest: (e) => {
    set((s) => applyEvent(s, e));
  },
  appendLocalUser: (threadId, text) => {
    set((s) => {
      const slug = findSlugForThread(s.threadsBySlug, threadId);
      if (!slug) return s;
      const list = s.threadsBySlug[slug] ?? [];
      const next = list.map((t) => {
        if (t.id !== threadId) return t;
        const newItem: ChatItem = {
          kind: 'user',
          id: `tu-${Date.now()}-${Math.random()}`,
          text,
          ts: Date.now(),
        };
        return { ...t, items: [...t.items, newItem], pendingUserText: text };
      });
      return { threadsBySlug: { ...s.threadsBySlug, [slug]: next } };
    });
  },
  findThread: (threadId) => {
    const all = get().threadsBySlug;
    for (const slug of Object.keys(all)) {
      const found = (all[slug] ?? []).find((t) => t.id === threadId);
      if (found) return found;
    }
    return null;
  },
}));

function findSlugForThread(
  threadsBySlug: Record<string, ThreadView[]>,
  threadId: string,
): string | null {
  for (const slug of Object.keys(threadsBySlug)) {
    const found = (threadsBySlug[slug] ?? []).find((t) => t.id === threadId);
    if (found) return slug;
  }
  return null;
}

function applyEvent(state: ThreadState, e: ServerEvent): Partial<ThreadState> {
  switch (e.kind) {
    case 'thread:created': {
      const slug = e.thread.slug;
      const list = state.threadsBySlug[slug] ?? [];
      // De-dupe (replay can re-emit `thread:created`).
      if (list.some((t) => t.id === e.thread.id)) return {};
      const view: ThreadView = {
        ...e.thread,
        items: eventsToItems(e.thread.events),
        pendingUserText: null,
      };
      return {
        threadsBySlug: { ...state.threadsBySlug, [slug]: [...list, view] },
        selectedByslug: { ...state.selectedByslug, [slug]: e.thread.id },
        panelOpenBySlug: { ...state.panelOpenBySlug, [slug]: true },
      };
    }
    case 'thread:status': {
      const slug = state.threadsBySlug
        ? findSlugForThread(state.threadsBySlug, e.threadId)
        : null;
      if (!slug) return {};
      const list = state.threadsBySlug[slug] ?? [];
      const next = list.map((t) =>
        t.id === e.threadId
          ? { ...t, status: e.status as ThreadStatus, summary: e.summary ?? t.summary }
          : t,
      );
      return { threadsBySlug: { ...state.threadsBySlug, [slug]: next } };
    }
    case 'thread:event': {
      const slug = findSlugForThread(state.threadsBySlug, e.threadId);
      if (!slug) return {};
      const list = state.threadsBySlug[slug] ?? [];
      const next = list.map((t) => {
        if (t.id !== e.threadId) return t;
        const events = [...t.events, e.event];
        return {
          ...t,
          events,
          items: applyChatEventToItems(t.items, e.event),
          pendingUserText: null,
        };
      });
      return { threadsBySlug: { ...state.threadsBySlug, [slug]: next } };
    }
    case 'thread:notice': {
      // Inject a notice into the parent chat ("Spot edit … completed: …").
      const scopeStr = scopeToShortLabel(e.scope);
      const text = `Spot edit on ${scopeStr} — ${e.summary}`;
      Promise.resolve().then(() => {
        useChatStore.setState((cs) => {
          const items = cs.itemsBySlug[e.slug] ?? [];
          const newItem: ChatItem = {
            kind: 'notice',
            id: `tn-${e.threadId}-${Date.now()}`,
            ts: Date.now(),
            text,
            tone: e.status === 'completed' ? 'success' : 'info',
          };
          return { itemsBySlug: { ...cs.itemsBySlug, [e.slug]: [...items, newItem] } };
        });
      });
      return {};
    }
    default:
      return {};
  }
}

function scopeToShortLabel(s: ThreadScope): string {
  if (s.label) return s.label;
  const parts: string[] = [];
  if (s.beatIds.length) parts.push(s.beatIds.join(', '));
  if (s.blockIds.length) parts.push(s.blockIds.join(', '));
  return parts.join(' + ') || 'video';
}

function eventsToItems(events: ChatEvent[]): ChatItem[] {
  let items: ChatItem[] = [];
  for (const e of events) items = applyChatEventToItems(items, e);
  return items;
}

function applyChatEventToItems(items: ChatItem[], e: ChatEvent): ChatItem[] {
  // Mirrors logic in chat/useChatStream.ts:applyEvent. Kept local so we don't
  // accidentally cross-mutate the parent chat store.
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
      const newChunk = {
        kind: 'tool' as const,
        toolUseId: e.toolUseId,
        messageId: e.messageId,
        name: e.name,
        input: e.input,
        status: 'running' as const,
        result: null as string | null,
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
      return items.map((it) => {
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
        return { ...it, chunks };
      });
    }
    case 'error':
      return [
        ...items,
        { kind: 'system', id: `err-${Date.now()}`, ts: Date.now(), text: `error: ${e.message}` },
      ];
    default:
      return items;
  }
}

/** Subscribe to ws events and route thread-related ones into the store. */
export function useThreadsBindings(): void {
  React.useEffect(() => {
    return ws.on((e: ServerEvent) => {
      if (
        e.kind === 'thread:created' ||
        e.kind === 'thread:status' ||
        e.kind === 'thread:event' ||
        e.kind === 'thread:notice'
      ) {
        useThreadStore.getState().ingest(e);
      }
    });
  }, []);
}

export function isThreadActive(t: ThreadSummary): boolean {
  return t.status === 'ready' || t.status === 'running' || t.status === 'awaiting_finish';
}

export function isThreadDone(t: ThreadSummary): boolean {
  return t.status === 'completed' || t.status === 'failed' || t.status === 'ended';
}
