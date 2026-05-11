// Shared event shapes between the spawn/parser and the WS hub.

/**
 * Metadata captured when the user crops a region from the player (Crop-to-chat).
 *
 * Drag-drop and paste attachments don't carry this — they're arbitrary image
 * files from elsewhere. Crops do: they know exactly which frame / beat /
 * block the user pointed at, and the agent NEEDS that to edit the right thing
 * (manifest mutations are beat-id / block-id keyed, not pixel-keyed).
 */
export type CropMetadata = {
  /** Current frame the player was on when the user dragged the rect. */
  frame: number;
  /** Composition fps from the manifest. `timeSeconds = frame / fps`. */
  fps: number;
  /** Human-readable timestamp ("1:47.3") for the directive + UI badge. */
  timeLabel: string;
  /** Voice beat id whose frame range contains `frame`, when one exists. */
  voiceBeatId?: string;
  /** Visual block id whose frame range contains `frame`, when one exists. */
  visualBlockId?: string;
  /**
   * Bbox normalized to 0..1 relative to the rendered video frame area
   * (player container has the composition's aspect ratio, so this maps 1:1
   * to composition coords). Lets the agent describe the spatial region:
   * "the bottom-right quadrant" / "0.28,0.42,0.43,0.46 of the frame".
   */
  bbox: { x: number; y: number; w: number; h: number };
};

/**
 * Image the user attached to a chat turn (drag-drop, paste, or cropped from
 * the player). The agent receives `path` (absolute fs path) so it can Read
 * the image; the UI uses `url` to render a thumbnail back to the user.
 */
export type AttachedImage = {
  id: string;
  /** Absolute filesystem path the chat directive embeds for the agent. */
  path: string;
  /** Editor-server URL the React UI uses for the thumbnail. */
  url: string;
  /** Bytes — informational, lets the UI show "180 KB" tooltips. */
  bytes?: number;
  /** Source hint — informational, e.g. `'drop' | 'paste' | 'crop'`. */
  source?: 'drop' | 'paste' | 'crop';
  /** Present iff source === 'crop'. See `CropMetadata` doc. */
  crop?: CropMetadata;
};

export type ChatEvent =
  /** What the user typed. Stored in the slug's history so refreshes replay it. */
  | { kind: 'user_text'; text: string; ts: number; attachedImages?: AttachedImage[] }
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
   * timeline ("Spot edit on 00:14→00:23 — completed: ..."). Persisted in
   * the slug's chatStore history so navigating away & back still shows it.
   *
   * Two lifecycle moments: `started` (right after the thread spawns; the
   * `summary` field carries the user's initial ask) and `completed` /
   * `failed` / `ended` (after the finish protocol). Both go through the
   * parent chat so the main agent sees both events.
   */
  | {
      kind: 'thread_notice';
      threadId: string;
      scopeLabel: string;
      summary: string;
      status: 'started' | 'continued' | 'completed' | 'failed' | 'ended';
      ts: number;
    }
  /** Sent on (re)subscribe so the client can rebuild the chat from scratch. */
  | { kind: 'chat:replay'; slug: string | null; events: ChatEvent[] }
  /** Tells the gallery which slug is currently running a turn. */
  | { kind: 'inflight:changed'; slug: string; inFlight: boolean }
  /**
   * Cursor-style outgoing-message queue for a slug. Broadcast whenever the
   * queue mutates (message enqueued, dequeued by drain, or canceled). The
   * client renders queued items as "queued" bubbles below the active chat
   * + a queue-state strip above the input. In-memory only on the server.
   */
  | {
      kind: 'chat:queue';
      slug: string | null;
      queue: Array<{ id: string; text: string; ts: number }>;
    }
  /** Render-button progress for a button-driven Remotion render (no agent). */
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
  /**
   * Auto-QA finished a fresh run for a slug. Editor banners refetch the
   * report when this lands; gallery cards can show issue counts. The full
   * report stays on disk at `videos/<slug>/qa-report.json`.
   */
  | {
      kind: 'qa:updated';
      slug: string;
      generatedAt: string;
      bySeverity: { error: number; warning: number; info: number };
      total: number;
    };

export type ClientFrame =
  | {
      kind: 'chat:turn';
      slug: string | null;
      sessionId: string | null;
      text: string;
      attachedImages?: AttachedImage[];
    }
  | { kind: 'chat:cancel' }
  | { kind: 'chat:reset'; slug: string | null }
  | {
      /** Remove a queued message (or all of them when `id` is omitted). Does
       *  NOT touch the currently-running turn. */
      kind: 'chat:cancel-queued';
      slug: string | null;
      id?: string;
    }
  | { kind: 'subscribe:slug'; slug: string };
