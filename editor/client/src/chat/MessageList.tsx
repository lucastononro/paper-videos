import React from 'react';
import type { ChatItem } from './useChatStream';
import { ToolCallCard } from './ToolCallCard';

export const MessageList: React.FC<{
  items: ChatItem[];
  inFlight: boolean;
  emptyHint?: React.ReactNode;
}> = ({ items, inFlight, emptyHint }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [items, inFlight]);

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
      {items.length === 0 && !inFlight && emptyHint}
      {items.map((it) => (
        <Item key={it.id} item={it} />
      ))}
      {(lastVisibleIsUser || lastIsAssistantToolOnly) && <ThinkingDots />}
    </div>
  );
};

const ThinkingDots: React.FC = () => (
  <div className="chat-thinking" aria-label="thinking">
    <span className="chat-thinking-dot" />
    <span className="chat-thinking-dot" />
    <span className="chat-thinking-dot" />
  </div>
);

const Item: React.FC<{ item: ChatItem }> = ({ item }) => {
  if (item.kind === 'user') {
    return (
      <div className="chat-msg">
        <div className="chat-msg-label">you</div>
        <div className="chat-bubble-user">{item.text}</div>
      </div>
    );
  }
  if (item.kind === 'system') {
    return (
      <div className="chat-msg chat-msg-system">{item.text}</div>
    );
  }
  if (item.kind === 'notice') {
    return (
      <div className={`chat-msg chat-notice chat-notice-${item.tone}`}>
        <span className="chat-notice-dot" />
        <span className="chat-notice-text">{item.text}</span>
      </div>
    );
  }
  return (
    <div className="chat-msg">
      <div className="chat-msg-label">claude</div>
      {item.chunks.map((c, i) =>
        c.kind === 'text' ? (
          <div key={i} className="chat-text-assistant">
            {c.text}
          </div>
        ) : (
          <ToolCallCard key={i} tool={c} />
        ),
      )}
    </div>
  );
};
