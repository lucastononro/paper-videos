import React from 'react';
import { useChatStore, useWsBindings } from './useChatStream';
import { MessageList } from './MessageList';
import { ws } from '../ws/client';
import './chat.css';

const EMPTY_ITEMS: never[] = [];
const EMPTY_QUEUE: never[] = [];

export const ChatPanel: React.FC<{
  slug: string;
  draft: string;
  setDraft: (v: string) => void;
  inputRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  emptyHint?: React.ReactNode;
}> = ({ slug, draft, setDraft, inputRef, emptyHint }) => {
  useWsBindings(slug);
  // zustand 5 uses Object.is by default, so `?? []` would yield a fresh
  // reference every render → infinite re-renders. Use a stable EMPTY sentinel
  // (and `useShallow` if/when we need element-wise equality).
  const items = useChatStore((s) => s.itemsBySlug[slug] ?? EMPTY_ITEMS);
  const inFlight = useChatStore((s) => Boolean(s.inFlightBySlug[slug]));
  const queue = useChatStore((s) => s.queueBySlug[slug] ?? EMPTY_QUEUE);
  const cancel = useChatStore((s) => s.cancel);
  const cancelQueued = useChatStore((s) => s.cancelQueued);
  const localRef = React.useRef<HTMLTextAreaElement | null>(null);
  const ref = inputRef ?? localRef;

  const send = React.useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    // The server echoes the user message back as a `user_text` event, so we
    // do not append a local copy here. That keeps the timeline replay-stable
    // across page refreshes. The server queues this message instead of
    // interrupting if a turn is already in flight (Cursor-style); the user
    // sees it as a "queued" bubble immediately via the `chat:queue` event.
    ws.send({ kind: 'chat:turn', slug, sessionId: null, text });
    setDraft('');
    autosize(ref.current);
  }, [draft, ref, setDraft, slug]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Auto-grow the textarea up to ~10 lines, then scroll inside.
  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.currentTarget.value);
    autosize(e.currentTarget);
  };

  return (
    <div
      className="chat-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-elev)',
        borderRight: '1px solid var(--border)',
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text-mute)',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>chat — {slug}</span>
      </div>

      <MessageList
        items={items}
        inFlight={inFlight}
        emptyHint={emptyHint}
        slug={slug}
        queued={queue}
        onCancelQueued={(id) => cancelQueued(slug, id)}
      />

      <div className="chat-input-wrap">
        {queue.length > 0 && (
          <div className="chat-queue-strip" title="Messages queued — will run after the active turn completes.">
            <span className="chat-queue-icon">⌚</span>
            <span className="chat-queue-label">
              {queue.length} message{queue.length === 1 ? '' : 's'} queued · runs after current turn
            </span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="chat-queue-clear"
              onClick={() => cancelQueued(slug)}
              title="Discard all queued messages"
            >
              clear
            </button>
          </div>
        )}
        <div className={`chat-input-area ${inFlight ? 'is-running' : ''}`}>
          <textarea
            ref={ref}
            className="chat-input-textarea"
            value={draft}
            placeholder={
              inFlight
                ? 'Type to queue — sends after the current turn finishes…'
                : 'Tell claude what to do · Enter to send · Shift+Enter for newline'
            }
            onChange={onChange}
            onKeyDown={onKeyDown}
            rows={1}
          />
          <div className="chat-input-actions">
            {inFlight && (
              <button
                type="button"
                className="chat-pill chat-pill-stop"
                onClick={() => cancel(slug)}
                title="Stop the current turn (does not affect queued messages)"
              >
                ■ Stop
              </button>
            )}
            <button
              type="button"
              className={`chat-pill chat-pill-send ${inFlight ? 'is-queue' : ''}`}
              onClick={send}
              disabled={!draft.trim()}
              title={inFlight ? 'Queue — runs after the current turn' : 'Send'}
            >
              {inFlight ? 'Queue ↵' : 'Send ↵'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function autosize(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  const max = 240; // matches the CSS max-height
  el.style.height = `${Math.min(el.scrollHeight, max)}px`;
}
