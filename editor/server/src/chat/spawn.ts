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
 * `--allowedTools` pre-approves the tools the pipeline needs so the user
 * isn't blocked by interactive permission prompts (which can't work from a
 * browser UI). We avoid `--dangerously-skip-permissions` because it's
 * restricted to sandboxed environments and is SIGKILL'd by the CLI on
 * standard OAuth subscriptions.
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
    '--allowedTools',
    'Bash',
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'WebSearch',
    'WebFetch',
    'Skill',
    'Agent',
    'TaskCreate',
    'TaskUpdate',
    'TaskGet',
    'TaskList',
    'TodoWrite',
    'NotebookEdit',
    '-p',
    opts.text,
  ];
  if (opts.resumeSessionId) {
    args.push('--resume', opts.resumeSessionId);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[chat] spawning: claude ${args.map((a, i) => (i === args.indexOf('-p') + 1 ? `"<prompt ${a.length} chars>"` : a)).join(' ')}`,
  );

  const child = spawn('claude', args, {
    cwd: REPO_ROOT,
    env: { ...process.env, FORCE_COLOR: '0', CLICOLOR: '0' },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!child.stdout || !child.stderr) {
    throw new Error('spawn(claude) did not produce stdout/stderr pipes');
  }

  let gotAnyEvent = false;
  let stdoutTotal = 0;
  const onStdout = makeStreamParser((e) => {
    gotAnyEvent = true;
    opts.onEvent(e);
  });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdoutTotal += chunk.length;
    onStdout(chunk);
  });

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
      } else if (!wasOperatorKill && !gotAnyEvent) {
        // Claude exited (code 0 or null) without producing any stream-json
        // output. This usually means an auth issue, a version mismatch, or
        // the CLI silently rejected a flag. Surface it so the user doesn't
        // stare at a dead chat.
        const hint = stderrBuf.trim()
          ? stderrBuf.trim().slice(-400)
          : 'no output received — check that `claude` is authenticated (`claude /login`) and up to date';
        // eslint-disable-next-line no-console
        console.error(
          `[chat] claude exited code=${code} signal=${signal} with zero events.`,
          `\n  stdout bytes received: ${stdoutTotal}`,
          `\n  stderr: ${stderrBuf.trim().slice(-500) || '(empty)'}`,
        );
        opts.onEvent({ kind: 'error', message: `claude produced no output: ${hint}` });
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
