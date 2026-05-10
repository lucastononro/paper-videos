/**
 * Automatic QA runner.
 *
 * Subscribes to file-watcher events: every time something important changes
 * for a slug (manifest.json, narration mp3/timestamps, Manim mp4), schedule
 * a QA run for that slug. Debounce per-slug so a producer/visualizer that
 * touches a dozen files in a row triggers one run, not a dozen.
 *
 * Replaces the old "Run QA" button — QA now happens continuously as part of
 * the editing loop. The user just reads the banner and acts on issues.
 *
 * Idempotent and side-effect-bounded:
 *   - One pending timer per slug.
 *   - QA is sync (deterministic, no network), so we run it inline on the timer.
 *   - We don't watch `qa-report.json` itself for triggers (would loop) — the
 *     watcher caller filters that out.
 */

import { runQa, writeQaReport } from '../../../../src/lib/qa.js';

const DEBOUNCE_MS = 1500;

type QaUpdatedEvent = {
  kind: 'qa:updated';
  slug: string;
  generatedAt: string;
  bySeverity: { error: number; warning: number; info: number };
  total: number;
};

type Subscriber = (e: QaUpdatedEvent) => void;

class QaAutoRunner {
  private timers = new Map<string, NodeJS.Timeout>();
  private subscribers = new Set<Subscriber>();

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  /**
   * Tell the runner that an interesting file changed. The runner debounces
   * per-slug and runs QA when the storm settles.
   */
  schedule(slug: string): void {
    const existing = this.timers.get(slug);
    if (existing) clearTimeout(existing);
    this.timers.set(
      slug,
      setTimeout(() => {
        this.timers.delete(slug);
        this.run(slug);
      }, DEBOUNCE_MS),
    );
  }

  private run(slug: string): void {
    let report;
    try {
      report = runQa(slug);
    } catch (err) {
      // QA failures aren't fatal — a half-built video may not pass schema
      // checks. Surface to server stderr; emit nothing to clients.
      // eslint-disable-next-line no-console
      console.warn(`[qa] auto-run failed for "${slug}": ${(err as Error).message}`);
      return;
    }
    try {
      writeQaReport(slug, report);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[qa] writeQaReport failed for "${slug}": ${(err as Error).message}`);
      return;
    }
    const total = report.issues.length;
    const evt: QaUpdatedEvent = {
      kind: 'qa:updated',
      slug,
      generatedAt: report.generatedAt,
      bySeverity: report.bySeverity,
      total,
    };
    for (const fn of this.subscribers) {
      try {
        fn(evt);
      } catch {
        /* ignore subscriber errors */
      }
    }
  }
}

export const qaAutoRunner = new QaAutoRunner();
export type { QaUpdatedEvent };
