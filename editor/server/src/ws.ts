import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import type http from 'node:http';
import { spawnClaudeTurn, type ClaudeRunHandle } from './chat/spawn.js';
import { buildDirective } from './chat/directive.js';
import { SessionStore } from './chat/session-store.js';
import type { ChatEvent, ClientFrame } from './chat/types.js';
import { threadStore } from './threads/store.js';
import type { ThreadClientFrame, ThreadEvent } from './threads/types.js';

type AnyClientFrame = ClientFrame | ThreadClientFrame;

type Conn = {
  id: string;
  socket: WebSocket;
  subscribedSlug: string | null;
  inFlight: ClaudeRunHandle | null;
};

const conns = new Map<string, Conn>();
const sessions = new SessionStore();

// Subscribe once to the thread store; route events back to the connection that
// owns them (parentConnId), and route `thread:notice` to whichever connection
// is currently subscribed to the slug (so the parent chat sees the handoff).
threadStore.subscribe((e: ThreadEvent) => {
  switch (e.kind) {
    case 'thread:created':
    case 'thread:status':
    case 'thread:event': {
      const thread =
        e.kind === 'thread:created'
          ? e.thread
          : threadStore.get(e.threadId);
      if (!thread) return;
      const conn = conns.get(thread.parentConnId);
      if (conn) sendRaw(conn, e);
      return;
    }
    case 'thread:notice': {
      // Broadcast to every connection currently viewing this slug — so the
      // main chat shows the notice regardless of which conn started the thread.
      for (const conn of conns.values()) {
        if (conn.subscribedSlug === e.slug) sendRaw(conn, e);
      }
      return;
    }
  }
});

export function attachWs(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (socket) => {
    const conn: Conn = { id: randomUUID(), socket, subscribedSlug: null, inFlight: null };
    conns.set(conn.id, conn);
    sendChat(conn, { kind: 'system_raw', raw: { hello: true, connId: conn.id } });

    socket.on('message', (raw) => {
      let msg: AnyClientFrame | null = null;
      try {
        msg = JSON.parse(String(raw)) as AnyClientFrame;
      } catch {
        sendChat(conn, { kind: 'error', message: 'invalid json' });
        return;
      }
      handleClientFrame(conn, msg).catch((err) => {
        sendChat(conn, { kind: 'error', message: `handler error: ${(err as Error).message}` });
      });
    });

    socket.on('close', () => {
      if (conn.inFlight) conn.inFlight.cancel();
      sessions.clearForConn(conn.id);
      threadStore.clearForConn(conn.id);
      conns.delete(conn.id);
    });
  });
  return wss;
}

async function handleClientFrame(conn: Conn, msg: AnyClientFrame): Promise<void> {
  switch (msg.kind) {
    // ---- chat (parent) ----
    case 'subscribe:slug':
      conn.subscribedSlug = msg.slug;
      // Replay any in-flight thread state for this slug so the panel hydrates
      // even when the user reloads the page mid-edit.
      for (const t of threadStore.list(msg.slug)) {
        if (t.parentConnId !== conn.id) continue;
        sendRaw(conn, { kind: 'thread:created', thread: t });
        for (const e of t.events) sendRaw(conn, { kind: 'thread:event', threadId: t.id, event: e });
        sendRaw(conn, {
          kind: 'thread:status',
          threadId: t.id,
          status: t.status,
          summary: t.summary ?? undefined,
        });
      }
      return;

    case 'chat:cancel':
      if (conn.inFlight) {
        conn.inFlight.cancel();
        conn.inFlight = null;
      }
      return;

    case 'chat:turn': {
      if (conn.inFlight) {
        conn.inFlight.cancel();
        try {
          await conn.inFlight.wait;
        } catch {
          /* gone */
        }
        conn.inFlight = null;
      }
      const directive = buildDirective(msg.slug, msg.text);
      const resumeId = msg.sessionId ?? sessions.get(conn.id, msg.slug);
      const handle = spawnClaudeTurn({
        text: directive,
        resumeSessionId: resumeId,
        onEvent: (e: ChatEvent) => {
          if (e.kind === 'session_started') sessions.set(conn.id, msg.slug, e.sessionId);
          sendChat(conn, e);
        },
      });
      conn.inFlight = handle;
      try {
        await handle.wait;
      } finally {
        if (conn.inFlight === handle) conn.inFlight = null;
      }
      return;
    }

    // ---- threads (forked child sessions) ----
    case 'thread:create':
      threadStore.create({
        parentConnId: conn.id,
        slug: msg.slug,
        scope: msg.scope,
        initialAsk: msg.initialAsk,
      });
      return;

    case 'thread:turn':
      threadStore.turn(msg.threadId, msg.text);
      return;

    case 'thread:cancel':
      threadStore.cancel(msg.threadId);
      return;

    case 'thread:finish':
      threadStore.finish(msg.threadId);
      return;

    case 'thread:end':
      threadStore.end(msg.threadId);
      return;

    case 'thread:delete':
      threadStore.delete(msg.threadId);
      return;
  }
}

function sendChat(conn: Conn, e: ChatEvent): void {
  sendRaw(conn, e);
}

function sendRaw(conn: Conn, e: ChatEvent | ThreadEvent): void {
  if (conn.socket.readyState !== conn.socket.OPEN) return;
  conn.socket.send(JSON.stringify(e));
}

/** Broadcast `preview:reload` to every connection currently subscribed to a slug. */
export function broadcastReload(slug: string): void {
  for (const conn of conns.values()) {
    if (conn.subscribedSlug === slug) {
      sendChat(conn, { kind: 'preview:reload', slug });
    }
  }
}
