import type { ChatEvent } from './types.js';

/**
 * Parse the line-delimited JSON stream from `claude --output-format=stream-json --verbose`
 * and emit typed `ChatEvent`s. The schema is unversioned — anything the parser
 * doesn't recognize is forwarded as a `system_raw` event so the server log
 * keeps a record and the UI can debug if needed.
 */
export function makeStreamParser(emit: (e: ChatEvent) => void): (chunk: string) => void {
  let buf = '';
  return (chunk: string) => {
    buf += chunk;
    let idx: number;
    // eslint-disable-next-line no-cond-assign
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line.length === 0) continue;
      try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        for (const ev of classify(obj)) emit(ev);
      } catch (err) {
        emit({ kind: 'error', message: `parse error: ${(err as Error).message}` });
      }
    }
  };
}

function classify(o: Record<string, unknown>): ChatEvent[] {
  const type = o['type'];
  switch (type) {
    case 'rate_limit_event': {
      const info = (o['rate_limit_info'] as Record<string, unknown> | undefined) ?? {};
      return [
        {
          kind: 'rate_limit',
          status: String(info['status'] ?? 'unknown'),
          resetsAt: typeof info['resetsAt'] === 'number' ? (info['resetsAt'] as number) : undefined,
        },
      ];
    }
    case 'system': {
      const subtype = String(o['subtype'] ?? '');
      if (subtype === 'init') {
        const sid = String(o['session_id'] ?? '');
        return sid ? [{ kind: 'session_started', sessionId: sid }] : [];
      }
      return [{ kind: 'system_raw', raw: o }];
    }
    case 'assistant': {
      const message = (o['message'] as Record<string, unknown> | undefined) ?? {};
      const id = String(message['id'] ?? 'msg');
      const content = (message['content'] as Array<Record<string, unknown>> | undefined) ?? [];
      const out: ChatEvent[] = [];
      for (const item of content) {
        const t = item['type'];
        if (t === 'text') {
          out.push({ kind: 'text', messageId: id, text: String(item['text'] ?? '') });
        } else if (t === 'tool_use') {
          out.push({
            kind: 'tool_use',
            messageId: id,
            toolUseId: String(item['id'] ?? ''),
            name: String(item['name'] ?? ''),
            input: item['input'] ?? {},
          });
        } else {
          out.push({ kind: 'system_raw', raw: item });
        }
      }
      return out;
    }
    case 'user': {
      const message = (o['message'] as Record<string, unknown> | undefined) ?? {};
      const content = (message['content'] as Array<Record<string, unknown>> | undefined) ?? [];
      const out: ChatEvent[] = [];
      for (const item of content) {
        if (item['type'] === 'tool_result') {
          out.push({
            kind: 'tool_result',
            toolUseId: String(item['tool_use_id'] ?? ''),
            content: stringifyToolResult(item['content']),
            isError: Boolean(item['is_error'] ?? false),
          });
        } else {
          out.push({ kind: 'system_raw', raw: item });
        }
      }
      return out;
    }
    case 'result': {
      return [
        {
          kind: 'done',
          stopReason:
            typeof o['stop_reason'] === 'string' ? (o['stop_reason'] as string) : undefined,
          durationMs:
            typeof o['duration_ms'] === 'number' ? (o['duration_ms'] as number) : undefined,
          costUsd:
            typeof o['total_cost_usd'] === 'number' ? (o['total_cost_usd'] as number) : undefined,
        },
      ];
    }
    default:
      return [{ kind: 'system_raw', raw: o }];
  }
}

function stringifyToolResult(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object' && 'text' in c) return String((c as { text: unknown }).text);
        return JSON.stringify(c);
      })
      .join('\n');
  }
  return JSON.stringify(content);
}
