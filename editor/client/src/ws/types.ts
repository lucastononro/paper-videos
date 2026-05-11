// Mirrors editor/server/src/chat/types.ts. Don't import across roots — Vite
// + tsc resolution is happier with local types here.

export type ChatEvent =
  | { kind: 'user_text'; text: string; ts: number }
  | { kind: 'session_started'; sessionId: string }
  | { kind: 'rate_limit'; status: string; resetsAt?: number }
  | { kind: 'text'; messageId: string; text: string }
  | { kind: 'tool_use'; messageId: string; toolUseId: string; name: string; input: unknown }
  | { kind: 'tool_result'; toolUseId: string; content: string; isError?: boolean }
  | { kind: 'system_raw'; raw: unknown }
  | { kind: 'error'; message: string }
  | { kind: 'done'; stopReason?: string; durationMs?: number; costUsd?: number }
  | {
      kind: 'thread_notice';
      threadId: string;
      scopeLabel: string;
      summary: string;
      status: 'started' | 'continued' | 'completed' | 'failed' | 'ended';
      ts: number;
    }
  | {
      kind: 'chat:queue';
      slug: string | null;
      queue: Array<{ id: string; text: string; ts: number }>;
    };

export type ThreadStatus =
  | 'ready'
  | 'running'
  | 'awaiting_finish'
  | 'completed'
  | 'failed'
  | 'ended';

export type ThreadScope = {
  /** Frame range the user selected on the filmstrip. */
  startFrame?: number;
  endFrame?: number;
  /** Beats / blocks overlapping the range — derived; agent's finding aid. */
  beatIds: string[];
  blockIds: string[];
  label?: string;
};

export type ThreadSummary = {
  id: string;
  parentConnId: string;
  slug: string;
  scope: ThreadScope;
  status: ThreadStatus;
  initialAsk: string;
  sessionId: string | null;
  events: ChatEvent[];
  summary: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ServerEvent =
  | ChatEvent
  | { kind: 'preview:reload'; slug: string }
  | { kind: 'chat:replay'; slug: string | null; events: ChatEvent[] }
  | { kind: 'inflight:changed'; slug: string; inFlight: boolean }
  | { kind: 'thread:created'; thread: ThreadSummary }
  | { kind: 'thread:status'; threadId: string; status: ThreadStatus; summary?: string }
  | { kind: 'thread:event'; threadId: string; event: ChatEvent }
  | {
      kind: 'thread:notice';
      slug: string;
      threadId: string;
      status: ThreadStatus;
      scope: ThreadScope;
      summary: string;
    }
  // Button-driven Remotion render — broadcast to every conn so the gallery
  // and the editor can reflect the running state.
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
    }
  | {
      kind: 'qa:updated';
      slug: string;
      generatedAt: string;
      bySeverity: { error: number; warning: number; info: number };
      total: number;
    };

export type ClientFrame =
  | { kind: 'chat:turn'; slug: string | null; sessionId: string | null; text: string }
  | { kind: 'chat:cancel' }
  | { kind: 'chat:reset'; slug: string | null }
  | { kind: 'chat:cancel-queued'; slug: string | null; id?: string }
  | { kind: 'subscribe:slug'; slug: string }
  | { kind: 'thread:create'; slug: string; scope: ThreadScope; initialAsk: string }
  | { kind: 'thread:turn'; threadId: string; text: string }
  | { kind: 'thread:cancel'; threadId: string }
  | { kind: 'thread:finish'; threadId: string }
  | { kind: 'thread:end'; threadId: string }
  | { kind: 'thread:delete'; threadId: string };
