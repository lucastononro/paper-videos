import React from 'react';
import { useChatStore, useWsBindings } from './useChatStream';
import { MessageList } from './MessageList';
import { ws } from '../ws/client';
import './chat.css';

const EMPTY_ITEMS: never[] = [];

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
  const appendUser = useChatStore((s) => s.appendUser);
  const cancel = useChatStore((s) => s.cancel);
  const localRef = React.useRef<HTMLTextAreaElement | null>(null);
  const ref = inputRef ?? localRef;

  const send = React.useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    // Server interrupts the in-flight turn automatically when a new chat:turn
    // arrives — that's the simp "send to interrupt & redirect" pattern.
    appendUser(slug, text);
    ws.send({ kind: 'chat:turn', slug, sessionId: null, text });
    setDraft('');
    autosize(ref.current);
  }, [appendUser, draft, ref, setDraft, slug]);

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

      <MessageList items={items} inFlight={inFlight} emptyHint={emptyHint} />

      <div className="chat-input-wrap">
        <div className={`chat-input-area ${inFlight ? 'is-running' : ''}`}>
          <textarea
            ref={ref}
            className="chat-input-textarea"
            value={draft}
            placeholder={
              inFlight
                ? 'Send to interrupt & redirect…'
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
                title="Stop"
              >
                ■ Stop
              </button>
            )}
            <button
              type="button"
              className={`chat-pill chat-pill-send ${inFlight ? 'is-redirect' : ''}`}
              onClick={send}
              disabled={!draft.trim()}
              title={inFlight ? 'Interrupt & redirect' : 'Send'}
            >
              {inFlight ? 'Redirect ↵' : 'Send ↵'}
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
