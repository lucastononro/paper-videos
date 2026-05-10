import type { ChatEvent } from '../chat/types.js';

export type ThreadStatus = 'ready' | 'running' | 'awaiting_finish' | 'completed' | 'failed' | 'ended';

export type ThreadScope = {
  beatIds: string[];
  blockIds: string[];
  /** Optional human-readable label (e.g. "00:14→00:23") for display. */
  label?: string;
};

export type Thread = {
  id: string;
  parentConnId: string;
  slug: string;
  scope: ThreadScope;
  status: ThreadStatus;
  /** Initial ask the user typed when starting the thread. */
  initialAsk: string;
  /** Most recent claude session id (for --resume on subsequent turns). */
  sessionId: string | null;
  /** Buffered events scoped to this thread (for late-joining clients). */
  events: ChatEvent[];
  /** Final summary text captured from the agent on finish. */
  summary: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ThreadEvent =
  | { kind: 'thread:created'; thread: Thread }
  | { kind: 'thread:status'; threadId: string; status: ThreadStatus; summary?: string }
  | { kind: 'thread:event'; threadId: string; event: ChatEvent }
  /** Posted to the parent chat: "Spot edit on #beat-005 completed: <summary>". */
  | { kind: 'thread:notice'; slug: string; threadId: string; status: ThreadStatus; scope: ThreadScope; summary: string };

export type ThreadClientFrame =
  | { kind: 'thread:create'; slug: string; scope: ThreadScope; initialAsk: string }
  | { kind: 'thread:turn'; threadId: string; text: string }
  | { kind: 'thread:cancel'; threadId: string }
  | { kind: 'thread:finish'; threadId: string }
  | { kind: 'thread:end'; threadId: string }
  | { kind: 'thread:delete'; threadId: string };
