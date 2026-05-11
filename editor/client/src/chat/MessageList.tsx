import React from 'react';
import type { ChatItem, ChatTextItem, ChatToolItem } from './useChatStream';
import { ToolCallCard } from './ToolCallCard';
import { AskUserQuestionCard } from './AskUserQuestionCard';
import { Markdown } from './Markdown';

/**
 * `onAnswer` is the callback used when the user picks an option on an
 * `AskUserQuestion` card. It routes the answer back to whichever target the
 * parent owns: a parent-chat instance forwards it as `chat:turn`, a thread
 * detail forwards it as `thread:turn`. When omitted the card falls back to
 * a chat:turn against `slug`.
 *
 * `queued` is the Cursor-style outgoing-message queue: each entry renders
 * as a "queued" bubble after the live items so the user sees the message
 * landed even though it hasn't been sent to the agent yet (the server
 * dequeues it FIFO when the active turn finishes). `onCancelQueued` lets
 * the user remove a single queued item.
 */
export const MessageList: React.FC<{
  items: ChatItem[];
  inFlight: boolean;
  emptyHint?: React.ReactNode;
  slug?: string | null;
  onAnswer?: (text: string) => void;
  queued?: Array<{ id: string; text: string; ts: number }>;
  onCancelQueued?: (id: string) => void;
}> = ({ items, inFlight, emptyHint, slug, onAnswer, queued, onCancelQueued }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const queuedKey = (queued ?? []).map((q) => q.id).join(',');
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [items, inFlight, queuedKey]);

  // The "thinking" dots show only when the most recent activity is the user
  // (or a finished tool with no follow-up text yet) — i.e. claude has nothing
  // visible on screen yet but the turn is in flight.
  const lastVisibleIsUser =
    inFlight && (items.length === 0 || items[items.length - 1]?.kind === 'user');
  const lastIsAssistantToolOnly =
    inFlight &&
    items.length > 0 &&
    items[items.length - 1]?.kind === 'assistant' &&
    !(items[items.length - 1] as Extract<ChatItem, { kind: 'assistant' }>).chunks.some(
      (c) => c.kind === 'text' && c.text.trim().length > 0,
    );

  return (
    <div
      ref={ref}
      style={{
        flex: 1,
        minHeight: 0,
        padding: '14px 16px',
        overflowY: 'auto',
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      {items.length === 0 && !inFlight && (queued?.length ?? 0) === 0 && emptyHint}
      {items.map((it) => (
        <Item key={it.id} item={it} slug={slug ?? null} onAnswer={onAnswer} />
      ))}
      {(lastVisibleIsUser || lastIsAssistantToolOnly) && <ThinkingDots />}
      {(queued ?? []).map((q) => (
        <QueuedItem key={q.id} text={q.text} onCancel={() => onCancelQueued?.(q.id)} />
      ))}
    </div>
  );
};

const QueuedItem: React.FC<{ text: string; onCancel: () => void }> = ({ text, onCancel }) => (
  <div className="chat-msg">
    <div className="chat-msg-label">queued</div>
    <div className="chat-bubble-user is-queued" title="Will run after the current turn finishes.">
      <div className="chat-queued-text">{text}</div>
      <button
        type="button"
        className="chat-queued-cancel"
        onClick={onCancel}
        title="Discard this queued message"
      >
        ✕
      </button>
    </div>
  </div>
);

const ThinkingDots: React.FC = () => (
  <div className="chat-thinking" aria-label="thinking">
    <span className="chat-thinking-dot" />
    <span className="chat-thinking-dot" />
    <span className="chat-thinking-dot" />
  </div>
);

const Item: React.FC<{
  item: ChatItem;
  slug: string | null;
  onAnswer?: (text: string) => void;
}> = ({ item, slug, onAnswer }) => {
  if (item.kind === 'user') {
    return (
      <div className="chat-msg">
        <div className="chat-msg-label">you</div>
        <div className="chat-bubble-user">
          <Markdown source={item.text} />
        </div>
      </div>
    );
  }
  if (item.kind === 'system') {
    return <div className="chat-msg chat-msg-system">{item.text}</div>;
  }
  if (item.kind === 'notice') {
    return (
      <div className={`chat-msg chat-notice chat-notice-${item.tone}`}>
        <span className="chat-notice-dot" />
        <span className="chat-notice-text">{item.text}</span>
      </div>
    );
  }
  // Group runs of adjacent text chunks so markdown spans (paragraphs,
  // tables, lists) survive the streamed event boundaries.
  const groups = groupChunks(item.chunks);
  return (
    <div className="chat-msg">
      <div className="chat-msg-label">claude</div>
      {groups.map((g, i) =>
        g.kind === 'text-run' ? (
          <div key={i} className="chat-text-assistant">
            <Markdown source={g.text} />
          </div>
        ) : g.tool.name === 'AskUserQuestion' ? (
          <AskUserQuestionCard key={i} tool={g.tool} slug={slug} onAnswer={onAnswer} />
        ) : (
          <ToolCallCard key={i} tool={g.tool} />
        ),
      )}
    </div>
  );
};

type ChunkGroup = { kind: 'text-run'; text: string } | { kind: 'tool'; tool: ChatToolItem };

function groupChunks(chunks: Array<ChatTextItem | ChatToolItem>): ChunkGroup[] {
  const out: ChunkGroup[] = [];
  for (const c of chunks) {
    if (c.kind === 'text') {
      const last = out[out.length - 1];
      if (last && last.kind === 'text-run') last.text += c.text;
      else out.push({ kind: 'text-run', text: c.text });
    } else {
      out.push({ kind: 'tool', tool: c });
    }
  }
  return out;
}
