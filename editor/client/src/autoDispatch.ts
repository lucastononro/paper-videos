/**
 * One-shot dispatch buffer.
 *
 * When the NewProjectDialog creates a project (source or PDF upload), it
 * stores a `{ slug, prompt }` here before navigating to the editor. The
 * ChatPanel consumes it on mount and fires it as the first chat turn,
 * so the pipeline starts automatically without the user having to type.
 *
 * Module-level state — intentionally NOT in a Zustand store because it's
 * consumed once and discarded. A store would needlessly persist it across
 * renders and complicate cleanup.
 */

let pending: { slug: string; prompt: string } | null = null;

export function setAutoDispatch(slug: string, prompt: string): void {
  pending = { slug, prompt };
}

export function consumeAutoDispatch(slug: string): string | null {
  if (pending && pending.slug === slug) {
    const p = pending.prompt;
    pending = null;
    return p;
  }
  return null;
}
