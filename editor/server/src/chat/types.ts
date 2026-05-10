// Shared event shapes between the spawn/parser and the WS hub.

export type ChatEvent =
  | { kind: 'session_started'; sessionId: string }
  | { kind: 'rate_limit'; status: string; resetsAt?: number }
  | { kind: 'text'; messageId: string; text: string }
  | { kind: 'tool_use'; messageId: string; toolUseId: string; name: string; input: unknown }
  | { kind: 'tool_result'; toolUseId: string; content: string; isError?: boolean }
  | { kind: 'system_raw'; raw: unknown }
  | { kind: 'error'; message: string }
  | { kind: 'done'; stopReason?: string; durationMs?: number; costUsd?: number }
  | { kind: 'preview:reload'; slug: string };

export type ClientFrame =
  | { kind: 'chat:turn'; slug: string | null; sessionId: string | null; text: string }
  | { kind: 'chat:cancel' }
  | { kind: 'subscribe:slug'; slug: string };
