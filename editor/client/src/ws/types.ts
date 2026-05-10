// Mirrors editor/server/src/chat/types.ts. Don't import across roots — Vite
// + tsc resolution is happier with local types here.

export type ChatEvent =
  | { kind: 'session_started'; sessionId: string }
  | { kind: 'rate_limit'; status: string; resetsAt?: number }
  | { kind: 'text'; messageId: string; text: string }
  | { kind: 'tool_use'; messageId: string; toolUseId: string; name: string; input: unknown }
  | { kind: 'tool_result'; toolUseId: string; content: string; isError?: boolean }
  | { kind: 'system_raw'; raw: unknown }
  | { kind: 'error'; message: string }
  | { kind: 'done'; stopReason?: string; durationMs?: number; costUsd?: number };

export type ThreadStatus =
  | 'ready'
  | 'running'
  | 'awaiting_finish'
  | 'completed'
  | 'failed'
  | 'ended';

export type ThreadScope = {
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
    };

export type ClientFrame =
  | { kind: 'chat:turn'; slug: string | null; sessionId: string | null; text: string }
  | { kind: 'chat:cancel' }
  | { kind: 'subscribe:slug'; slug: string }
  | { kind: 'thread:create'; slug: string; scope: ThreadScope; initialAsk: string }
  | { kind: 'thread:turn'; threadId: string; text: string }
  | { kind: 'thread:cancel'; threadId: string }
  | { kind: 'thread:finish'; threadId: string }
  | { kind: 'thread:end'; threadId: string }
  | { kind: 'thread:delete'; threadId: string };
