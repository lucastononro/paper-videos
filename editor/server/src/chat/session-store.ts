/**
 * In-memory session-id store, keyed per-WS-connection per-slug.
 *
 * `claude` returns a `session_id` after the first turn; we stash it so the
 * NEXT turn from the same conversation can pass `--resume <id>` and pick up
 * mid-thought. Different slugs maintain different threads even on the same WS.
 */
export class SessionStore {
  private map = new Map<string, string>();

  private k(connId: string, slug: string | null): string {
    return `${connId}::${slug ?? ''}`;
  }

  get(connId: string, slug: string | null): string | null {
    return this.map.get(this.k(connId, slug)) ?? null;
  }

  set(connId: string, slug: string | null, sessionId: string): void {
    this.map.set(this.k(connId, slug), sessionId);
  }

  clearForConn(connId: string): void {
    for (const k of [...this.map.keys()]) {
      if (k.startsWith(`${connId}::`)) this.map.delete(k);
    }
  }
}
