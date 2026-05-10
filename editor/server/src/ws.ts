import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import type http from 'node:http';
import { chatStore } from './chat/store.js';
import type { ChatEvent, ClientFrame } from './chat/types.js';
import { threadStore } from './threads/store.js';
import type { ThreadClientFrame, ThreadEvent } from './threads/types.js';
import { renderStore } from './render/store.js';

type AnyClientFrame = ClientFrame | ThreadClientFrame;

type Conn = {
  id: string;
  socket: WebSocket;
  subscribedSlug: string | null;
};

const conns = new Map<string, Conn>();

// Forward chat events to every connection currently subscribed to the slug.
chatStore.onEvent((slug, e) => {
  for (const conn of conns.values()) {
    if (conn.subscribedSlug === slug) sendRaw(conn, e);
  }
});

// Broadcast in-flight transitions globally so the gallery can show running
// indicators on cards even when not in the editor view.
chatStore.onInFlightChange((slug, inFlight) => {
  if (slug === null) return;
  for (const conn of conns.values()) {
    sendRaw(conn, { kind: 'inflight:changed', slug, inFlight });
  }
});

// Render-button events go to every conn subscribed to the slug AND to every
// gallery viewer (so cards can show "rendering" too — no slug filter for
// global state events). render:done also triggers a preview:reload so the
// player picks up the new output.mp4 / regenerated thumbnails.
renderStore.subscribe((e) => {
  for (const conn of conns.values()) {
    sendRaw(conn, e);
  }
  if (e.kind === 'render:done' && e.ok) {
    for (const conn of conns.values()) {
      if (conn.subscribedSlug === e.slug) {
        sendRaw(conn, { kind: 'preview:reload', slug: e.slug });
      }
    }
  }
});

// Forward thread events: thread:created/status/event to the connection that
// is subscribed to the thread's slug; thread:notice to every conn subscribed
// to the slug.
threadStore.subscribe((e: ThreadEvent) => {
  switch (e.kind) {
    case 'thread:created': {
      const slug = e.thread.slug;
      for (const conn of conns.values()) {
        if (conn.subscribedSlug === slug) sendRaw(conn, e);
      }
      return;
    }
    case 'thread:status':
    case 'thread:event': {
      const t = threadStore.get(e.threadId);
      if (!t) return;
      for (const conn of conns.values()) {
        if (conn.subscribedSlug === t.slug) sendRaw(conn, e);
      }
      return;
    }
    case 'thread:notice': {
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
    const conn: Conn = { id: randomUUID(), socket, subscribedSlug: null };
    conns.set(conn.id, conn);
    sendRaw(conn, { kind: 'system_raw', raw: { hello: true, connId: conn.id } });

    socket.on('message', (raw) => {
      let msg: AnyClientFrame | null = null;
      try {
        msg = JSON.parse(String(raw)) as AnyClientFrame;
      } catch {
        sendRaw(conn, { kind: 'error', message: 'invalid json' });
        return;
      }
      handleClientFrame(conn, msg).catch((err) => {
        sendRaw(conn, { kind: 'error', message: `handler error: ${(err as Error).message}` });
      });
    });

    socket.on('close', () => {
      // IMPORTANT: do NOT cancel running chat / threads. They stay alive on the
      // server so the user can reconnect (refresh, navigate away+back) and
      // pick up where they left off via the replay path.
      if (conn.subscribedSlug !== null) chatStore.detach(conn.id, conn.subscribedSlug);
      chatStore.detachAll(conn.id);
      threadStore.detachConn(conn.id);
      conns.delete(conn.id);
    });
  });
  return wss;
}

async function handleClientFrame(conn: Conn, msg: AnyClientFrame): Promise<void> {
  switch (msg.kind) {
    // ---- subscription / replay ----
    case 'subscribe:slug': {
      // Detach from the previous slug so we stop receiving its broadcasts.
      if (conn.subscribedSlug !== null && conn.subscribedSlug !== msg.slug) {
        chatStore.detach(conn.id, conn.subscribedSlug);
      }
      conn.subscribedSlug = msg.slug;
      chatStore.attach(conn.id, msg.slug);

      // Replay history for this slug so a refresh or a new tab rebuilds the
      // chat exactly. We mark it explicitly so the client knows to reset its
      // local message buffer before ingesting.
      const history = chatStore.history(msg.slug);
      sendRaw(conn, { kind: 'chat:replay', slug: msg.slug, events: history });

      // Replay any threads belonging to this slug.
      for (const t of threadStore.list(msg.slug)) {
        sendRaw(conn, { kind: 'thread:created', thread: t });
        for (const e of t.events) sendRaw(conn, { kind: 'thread:event', threadId: t.id, event: e });
        sendRaw(conn, {
          kind: 'thread:status',
          threadId: t.id,
          status: t.status,
          summary: t.summary ?? undefined,
        });
      }

      // Tell the client whether a turn is in flight so the UI can reflect it.
      sendRaw(conn, {
        kind: 'inflight:changed',
        slug: msg.slug ?? '',
        inFlight: chatStore.isInFlight(msg.slug),
      });

      // Render state — so reconnecting mid-render picks up the running flag.
      if (msg.slug) {
        const r = renderStore.state(msg.slug);
        sendRaw(conn, {
          kind: 'render:state',
          slug: msg.slug,
          running: r.running,
          percent: r.percent,
          startedAt: r.startedAt,
        });
      }
      return;
    }

    // ---- main chat ----
    case 'chat:cancel':
      chatStore.cancel(conn.subscribedSlug);
      return;

    case 'chat:turn':
      void chatStore.turn(msg.slug, msg.text);
      return;

    case 'chat:reset':
      chatStore.reset(msg.slug);
      // Send a fresh empty replay so the client clears its buffer.
      for (const c of conns.values()) {
        if (c.subscribedSlug === msg.slug) {
          sendRaw(c, { kind: 'chat:replay', slug: msg.slug, events: [] });
        }
      }
      return;

    // ---- threads (forked spot-edit sessions) ----
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

function sendRaw(conn: Conn, e: unknown): void {
  if (conn.socket.readyState !== conn.socket.OPEN) return;
  conn.socket.send(JSON.stringify(e));
}

/** Broadcast `preview:reload` to every connection currently subscribed to a slug. */
export function broadcastReload(slug: string): void {
  for (const conn of conns.values()) {
    if (conn.subscribedSlug === slug) {
      sendRaw(conn, { kind: 'preview:reload', slug });
    }
  }
}

/** Snapshot of slugs with a running chat turn or active thread. */
export function inFlightSnapshot(): Set<string> {
  const out = chatStore.inFlightSlugs();
  for (const t of threadStore.list()) {
    if (t.status === 'running' || t.status === 'awaiting_finish') out.add(t.slug);
  }
  return out;
}
