import React from 'react';
import { create } from 'zustand';
import { ws } from '../ws/client';
import type { ServerEvent } from '../ws/types';

export type RenderStatus = {
  running: boolean;
  percent: number;
  startedAt: number | null;
  /** Most-recent log line from the render-remotion subprocess; resets on next start. */
  lastLine: string | null;
  /** Set after the latest render finished — { ok, durationMs, tailLog }. */
  lastResult: { ok: boolean; durationMs: number; tailLog: string } | null;
};

type State = {
  byslug: Record<string, RenderStatus>;
  ingest: (e: ServerEvent) => void;
  /** Optimistically mark a slug as starting (before the WS state event lands). */
  markStarting: (slug: string) => void;
};

const EMPTY: RenderStatus = {
  running: false,
  percent: 0,
  startedAt: null,
  lastLine: null,
  lastResult: null,
};

export const useRenderStore = create<State>((set) => ({
  byslug: {},
  ingest: (e) => {
    if (e.kind === 'render:state') {
      set((s) => ({
        byslug: {
          ...s.byslug,
          [e.slug]: {
            ...(s.byslug[e.slug] ?? EMPTY),
            running: e.running,
            percent: e.percent,
            startedAt: e.startedAt,
            lastResult: e.running ? null : (s.byslug[e.slug]?.lastResult ?? null),
          },
        },
      }));
    } else if (e.kind === 'render:progress') {
      set((s) => ({
        byslug: {
          ...s.byslug,
          [e.slug]: {
            ...(s.byslug[e.slug] ?? EMPTY),
            running: true,
            percent: e.percent,
            lastLine: e.line ?? s.byslug[e.slug]?.lastLine ?? null,
          },
        },
      }));
    } else if (e.kind === 'render:done') {
      set((s) => ({
        byslug: {
          ...s.byslug,
          [e.slug]: {
            ...(s.byslug[e.slug] ?? EMPTY),
            running: false,
            percent: e.ok ? 100 : 0,
            lastResult: { ok: e.ok, durationMs: e.durationMs, tailLog: e.tailLog },
          },
        },
      }));
    }
  },
  markStarting: (slug) =>
    set((s) => ({
      byslug: {
        ...s.byslug,
        [slug]: { ...EMPTY, running: true, startedAt: Date.now() },
      },
    })),
}));

export function useRenderBindings(): void {
  React.useEffect(() => {
    return ws.on((e: ServerEvent) => {
      if (e.kind === 'render:state' || e.kind === 'render:progress' || e.kind === 'render:done') {
        useRenderStore.getState().ingest(e);
      }
    });
  }, []);
}
