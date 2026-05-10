// Shared event shapes between the spawn/parser and the WS hub.

export type ChatEvent =
  /** What the user typed. Stored in the slug's history so refreshes replay it. */
  | { kind: 'user_text'; text: string; ts: number }
  | { kind: 'session_started'; sessionId: string }
  | { kind: 'rate_limit'; status: string; resetsAt?: number }
  | { kind: 'text'; messageId: string; text: string }
  | { kind: 'tool_use'; messageId: string; toolUseId: string; name: string; input: unknown }
  | { kind: 'tool_result'; toolUseId: string; content: string; isError?: boolean }
  | { kind: 'system_raw'; raw: unknown }
  | { kind: 'error'; message: string }
  | { kind: 'done'; stopReason?: string; durationMs?: number; costUsd?: number }
  | { kind: 'preview:reload'; slug: string }
  /**
   * Notice from a forked spot-edit thread injected into the parent chat
   * timeline ("Spot edit on #beat-005 — completed: ..."). Persisted in the
   * slug's chatStore history so navigating away & back still shows it.
   */
  | {
      kind: 'thread_notice';
      threadId: string;
      scopeLabel: string;
      summary: string;
      status: 'completed' | 'failed' | 'ended';
      ts: number;
    }
  /** Sent on (re)subscribe so the client can rebuild the chat from scratch. */
  | { kind: 'chat:replay'; slug: string | null; events: ChatEvent[] }
  /** Tells the gallery which slug is currently running a turn. */
  | { kind: 'inflight:changed'; slug: string; inFlight: boolean }
  /** Render-button progress for a button-driven Remotion render (no agent). */
  | { kind: 'render:state'; slug: string; running: boolean; percent: number; startedAt: number | null }
  | { kind: 'render:progress'; slug: string; percent: number; line?: string }
  | { kind: 'render:done'; slug: string; ok: boolean; code: number | null; durationMs: number; tailLog: string };

export type ClientFrame =
  | { kind: 'chat:turn'; slug: string | null; sessionId: string | null; text: string }
  | { kind: 'chat:cancel' }
  | { kind: 'chat:reset'; slug: string | null }
  | { kind: 'subscribe:slug'; slug: string };
