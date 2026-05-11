import { create } from 'zustand';
import type { AttachedImage } from '../ws/types';

/**
 * Per-slug staging area for images the user has uploaded but not yet sent.
 *
 * Two producers:
 *   - ChatPanel — drag-and-drop / paste / file picker.
 *   - PlayerPanel CropOverlay — captured + cropped frames.
 *
 * One consumer: the send handler in ChatPanel reads + clears the list for
 * the slug when the user hits Send. The Zustand store keeps the two sides
 * decoupled so the crop overlay doesn't need a ref into the chat input.
 */
type PendingState = {
  bySlug: Record<string, AttachedImage[]>;
  add: (slug: string, img: AttachedImage) => void;
  remove: (slug: string, id: string) => void;
  clear: (slug: string) => void;
};

export const usePendingAttachments = create<PendingState>((set) => ({
  bySlug: {},
  add: (slug, img) =>
    set((s) => ({
      bySlug: { ...s.bySlug, [slug]: [...(s.bySlug[slug] ?? []), img] },
    })),
  remove: (slug, id) =>
    set((s) => ({
      bySlug: { ...s.bySlug, [slug]: (s.bySlug[slug] ?? []).filter((i) => i.id !== id) },
    })),
  clear: (slug) =>
    set((s) => {
      const next = { ...s.bySlug };
      delete next[slug];
      return { bySlug: next };
    }),
}));
