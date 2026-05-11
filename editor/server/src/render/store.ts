/**
 * Render manager: button-driven Remotion renders, no agent involved.
 *
 * Spawns `npm run render-remotion -- <slug>` from the repo root, streams the
 * tool's stdout/stderr to subscribers as `render:progress` events, and emits
 * a `render:done` when the process exits. One in-flight render per slug.
 *
 * The render-remotion tool writes a self-overwriting `rendering 12.3%` line
 * via `\r`; we tail those into a single `percent` field that the UI shows
 * as a progress bar without flooding the WS with one event per frame.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { REPO_ROOT } from '../paths.js';

export type RenderEvent =
  | {
      kind: 'render:state';
      slug: string;
      running: boolean;
      percent: number;
      startedAt: number | null;
    }
  | { kind: 'render:progress'; slug: string; percent: number; line?: string }
  | {
      kind: 'render:done';
      slug: string;
      ok: boolean;
      code: number | null;
      durationMs: number;
      tailLog: string;
    };

type RenderRecord = {
  slug: string;
  proc: ChildProcess;
  startedAt: number;
  percent: number;
  /** Rolling tail of the most recent log lines — surfaced on failure. */
  log: string[];
};

type Subscriber = (e: RenderEvent) => void;

const PERCENT_RE = /rendering\s+([\d.]+)\s*%/i;
const TAIL_LINES = 40;

class RenderStore {
  private byslug = new Map<string, RenderRecord>();
  private subs = new Set<Subscriber>();

  subscribe(fn: Subscriber): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  isRunning(slug: string): boolean {
    return this.byslug.has(slug);
  }

  state(slug: string): { running: boolean; percent: number; startedAt: number | null } {
    const r = this.byslug.get(slug);
    if (!r) return { running: false, percent: 0, startedAt: null };
    return { running: true, percent: r.percent, startedAt: r.startedAt };
  }

  /** Start a new render. Returns false if one is already running for this slug. */
  start(slug: string): boolean {
    if (this.byslug.has(slug)) return false;
    const proc = spawn('npm', ['run', 'render-remotion', '--', slug], {
      cwd: REPO_ROOT,
      env: process.env,
      shell: false,
    });
    const rec: RenderRecord = {
      slug,
      proc,
      startedAt: Date.now(),
      percent: 0,
      log: [],
    };
    this.byslug.set(slug, rec);

    const onChunk = (buf: Buffer) => {
      const text = buf.toString('utf8');
      // Split on \r and \n so the carriage-returned progress lines surface.
      for (const raw of text.split(/[\r\n]+/)) {
        const line = raw.trim();
        if (!line) continue;
        rec.log.push(line);
        if (rec.log.length > TAIL_LINES) rec.log.shift();
        const m = line.match(PERCENT_RE);
        if (m) {
          const p = Math.max(0, Math.min(100, Number(m[1])));
          // Only emit if the percent advanced — keeps the WS chatter sane.
          if (Math.floor(p) !== Math.floor(rec.percent)) {
            rec.percent = p;
            this.emit({ kind: 'render:progress', slug, percent: p });
          } else {
            rec.percent = p;
          }
        } else {
          // Non-progress log line — broadcast so the UI can show what's
          // happening (Bundling…, Selecting composition…, final size, etc).
          this.emit({ kind: 'render:progress', slug, percent: rec.percent, line });
        }
      }
    };
    proc.stdout?.on('data', onChunk);
    proc.stderr?.on('data', onChunk);

    proc.on('exit', (code) => {
      const ok = code === 0;
      const durationMs = Date.now() - rec.startedAt;
      this.byslug.delete(slug);
      this.emit({
        kind: 'render:done',
        slug,
        ok,
        code,
        durationMs,
        tailLog: rec.log.slice(-TAIL_LINES).join('\n'),
      });
    });

    this.emit({ kind: 'render:state', slug, running: true, percent: 0, startedAt: rec.startedAt });
    return true;
  }

  /** Stop a running render. SIGTERM first; the process exit handler emits done. */
  cancel(slug: string): boolean {
    const rec = this.byslug.get(slug);
    if (!rec) return false;
    try {
      rec.proc.kill('SIGTERM');
    } catch {
      /* already gone */
    }
    return true;
  }

  private emit(e: RenderEvent): void {
    for (const fn of this.subs) {
      try {
        fn(e);
      } catch {
        /* noop */
      }
    }
  }
}

export const renderStore = new RenderStore();
