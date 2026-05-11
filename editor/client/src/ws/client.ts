// Singleton WebSocket client. Emits typed events to subscribers.

import type { ServerEvent, ClientFrame } from './types';

type Listener = (e: ServerEvent) => void;

class WsClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private outbox: ClientFrame[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelayMs = 800;
  private connected = false;

  start(): void {
    if (this.socket) return;
    this.dial();
  }

  send(frame: ClientFrame): void {
    if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(frame));
    } else {
      this.outbox.push(frame);
      this.start();
    }
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private dial() {
    const url =
      (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws';
    const sock = new WebSocket(url);
    this.socket = sock;
    sock.onopen = () => {
      this.connected = true;
      this.reconnectDelayMs = 800;
      const queue = this.outbox.slice();
      this.outbox = [];
      for (const f of queue) sock.send(JSON.stringify(f));
    };
    sock.onmessage = (evt) => {
      try {
        const e = JSON.parse(String(evt.data)) as ServerEvent;
        for (const l of this.listeners) l(e);
      } catch {
        /* ignore */
      }
    };
    sock.onclose = () => {
      this.connected = false;
      this.socket = null;
      this.scheduleReconnect();
    };
    sock.onerror = () => {
      // onclose will fire next; let the reconnect path handle it.
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 5000);
      this.dial();
    }, this.reconnectDelayMs);
  }
}

export const ws = new WsClient();
