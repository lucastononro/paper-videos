import { spawn, type ChildProcess } from 'node:child_process';
import { REPO_ROOT } from '../paths.js';
import { makeStreamParser } from './stream-parser.js';
import type { ChatEvent } from './types.js';

export type ClaudeRunHandle = {
  child: ChildProcess;
  cancel: () => void;
  wait: Promise<{ code: number; signal: NodeJS.Signals | null }>;
};

/**
 * Spawn a `claude` subprocess for one chat turn. Streams parsed events to
 * `onEvent` as they arrive on stdout. Returns a handle the caller can use to
 * cancel mid-turn (SIGTERM) and to await final exit.
 *
 * - First turn: pass the user text via `-p`. No `--resume`.
 * - Follow-ups: pass `--resume <sessionId>` so the agent has continuity.
 *
 * The subprocess inherits the editor's environment (so OAuth / .env carry
 * through) and runs with `cwd = REPO_ROOT` so CLAUDE.md, .claude/, and npm
 * scripts all resolve.
 */
export function spawnClaudeTurn(opts: {
  text: string;
  resumeSessionId: string | null;
  onEvent: (e: ChatEvent) => void;
}): ClaudeRunHandle {
  const args = [
    '--output-format=stream-json',
    '--verbose',
    '-p',
    opts.text,
  ];
  if (opts.resumeSessionId) {
    args.push('--resume', opts.resumeSessionId);
  }

  const child = spawn('claude', args, {
    cwd: REPO_ROOT,
    env: { ...process.env, FORCE_COLOR: '0', CLICOLOR: '0' },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!child.stdout || !child.stderr) {
    throw new Error('spawn(claude) did not produce stdout/stderr pipes');
  }

  const onStdout = makeStreamParser(opts.onEvent);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', onStdout);

  // stderr is mostly noise (e.g., the "no stdin data received" warning we
  // already suppress with stdio:'ignore' on stdin). Forward genuine errors
  // back over the chat channel for visibility.
  let stderrBuf = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderrBuf += chunk;
    if (stderrBuf.length > 4000) stderrBuf = stderrBuf.slice(-4000);
  });

  let cancelled = false;
  const wait = new Promise<{ code: number; signal: NodeJS.Signals | null }>((resolve) => {
    child.on('close', (code, signal) => {
      // SIGTERM (or exit 143) is the operator-cancelled path — that's expected
      // when the user interrupts via "send to redirect" or the Stop button.
      // Don't surface it as an error to the chat UI.
      const wasOperatorKill =
        cancelled || signal === 'SIGTERM' || signal === 'SIGINT' || code === 143 || code === 130;
      if (!wasOperatorKill && code !== 0 && code !== null) {
        opts.onEvent({
          kind: 'error',
          message: `claude exited ${code}${stderrBuf ? `: ${stderrBuf.trim().slice(-400)}` : ''}`,
        });
      }
      resolve({ code: code ?? -1, signal });
    });
    child.on('error', (err) => {
      opts.onEvent({ kind: 'error', message: `spawn error: ${err.message}` });
      resolve({ code: -1, signal: null });
    });
  });

  return {
    child,
    cancel: () => {
      cancelled = true;
      try {
        child.kill('SIGTERM');
      } catch {
        /* already gone */
      }
    },
    wait,
  };
}
