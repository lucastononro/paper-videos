import { create } from 'zustand';
import type { Manifest } from '../api';

export type SelectionRange =
  | { kind: 'beat'; beatId: string }
  | { kind: 'block'; blockId: string }
  | { kind: 'range'; startFrame: number; endFrame: number };

type SelectionState = {
  current: SelectionRange | null;
  set: (s: SelectionRange | null) => void;
};

export const useSelection = create<SelectionState>((set) => ({
  current: null,
  set: (s) => set({ current: s }),
}));

export function formatTimecode(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Serialize a selection into a Claude-readable token. */
export function selectionToToken(sel: SelectionRange, manifest: Manifest): string {
  switch (sel.kind) {
    case 'beat':
      return `#${sel.beatId}`;
    case 'block':
      return `#${sel.blockId}`;
    case 'range': {
      const startSec = sel.startFrame / manifest.fps;
      const endSec = sel.endFrame / manifest.fps;
      return `[selection ${formatTimecode(startSec)}→${formatTimecode(endSec)}]`;
    }
  }
}

/** Resolve a selection to overlapping beat / block ids (for chat tooltips, etc). */
export function resolveSelection(
  sel: SelectionRange,
  manifest: Manifest,
): { beatIds: string[]; blockIds: string[] } {
  const startFrame = sel.kind === 'range' ? sel.startFrame : -1;
  const endFrame = sel.kind === 'range' ? sel.endFrame : -1;
  if (sel.kind === 'beat') return { beatIds: [sel.beatId], blockIds: [] };
  if (sel.kind === 'block') return { beatIds: [], blockIds: [sel.blockId] };
  const overlaps = (s: number, d: number) => s + d > startFrame && s < endFrame;
  return {
    beatIds: manifest.voice
      .filter((b) => overlaps(b.startFrame, b.durationFrames))
      .map((b) => b.id),
    blockIds: manifest.visualBlocks
      .filter((b) => overlaps(b.startFrame, b.durationFrames))
      .map((b) => b.id),
  };
}
