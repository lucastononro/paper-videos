import React from 'react';
import { useChatStore, useWsBindings } from './useChatStream';
import { MessageList } from './MessageList';
import { ws } from '../ws/client';
import { usePendingAttachments } from './pendingAttachments';
import { hasImageFiles, imageFilesFrom, uploadChatImage } from './uploadImage';
import type { AttachedImage } from '../ws/types';
import './chat.css';

const EMPTY_ITEMS: never[] = [];
const EMPTY_QUEUE: never[] = [];
const EMPTY_PENDING: AttachedImage[] = [];

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
  const pending = usePendingAttachments((s) => s.bySlug[slug] ?? EMPTY_PENDING);
  const addPending = usePendingAttachments((s) => s.add);
  const removePending = usePendingAttachments((s) => s.remove);
  const clearPending = usePendingAttachments((s) => s.clear);
  const localRef = React.useRef<HTMLTextAreaElement | null>(null);
  const ref = inputRef ?? localRef;
  const [dragOver, setDragOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const ingestFiles = React.useCallback(
    async (files: File[], source: 'drop' | 'paste') => {
      if (files.length === 0) return;
      setUploading(true);
      try {
        for (const f of files) {
          try {
            const att = await uploadChatImage(slug, f, source);
            addPending(slug, att);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[chat] image upload failed', err);
          }
        }
      } finally {
        setUploading(false);
      }
    },
    [slug, addPending],
  );

  const send = React.useCallback(() => {
    const text = draft.trim();
    if (!text && pending.length === 0) return;
    // The server echoes the user message back as a `user_text` event, so we
    // do not append a local copy here. That keeps the timeline replay-stable
    // across page refreshes. The server queues this message instead of
    // interrupting if a turn is already in flight (Cursor-style); the user
    // sees it as a "queued" bubble immediately via the `chat:queue` event.
    ws.send({
      kind: 'chat:turn',
      slug,
      sessionId: null,
      text,
      ...(pending.length > 0 ? { attachedImages: pending } : {}),
    });
    setDraft('');
    clearPending(slug);
    autosize(ref.current);
  }, [draft, pending, ref, setDraft, slug, clearPending]);

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

  // Drag-and-drop: scoped to the whole chat panel so users can drop on the
  // message list or the input. We only react if at least one image file is
  // in the payload — text drags pass through.
  const onDragOver = (e: React.DragEvent) => {
    if (!hasImageFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragOver) setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    // Leaving outside the panel boundary; ignore intra-element transitions.
    if (e.currentTarget === e.target) setDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!hasImageFiles(e.dataTransfer)) return;
    e.preventDefault();
    setDragOver(false);
    void ingestFiles(imageFilesFrom(e.dataTransfer), 'drop');
  };

  // Paste from clipboard (cmd-v with an image on the clipboard, e.g. after a
  // screenshot). Only fires when the textarea is focused, which is the
  // natural ergonomics.
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const dt = e.clipboardData;
    if (!dt || !hasImageFiles(dt)) return;
    e.preventDefault();
    void ingestFiles(imageFilesFrom(dt), 'paste');
  };

  return (
    <div
      className={`chat-panel ${dragOver ? 'chat-panel-dragover' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-elev)',
        borderRight: '1px solid var(--border)',
        minWidth: 0,
      }}
    >
      {dragOver && (
        <div className="chat-dropzone-overlay">
          <div className="chat-dropzone-card">Drop image to attach to chat</div>
        </div>
      )}
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
          <div
            className="chat-queue-strip"
            title="Messages queued — will run after the active turn completes."
          >
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
        {pending.length > 0 && (
          <div className="chat-pending-strip" title="Will attach to your next message">
            {pending.map((p) => {
              const beat = p.crop?.voiceBeatId;
              const block = p.crop?.visualBlockId;
              const tip = p.crop
                ? `crop at ${p.crop.timeLabel}${beat ? ` · ${beat}` : ''}${block ? ` · ${block}` : ''}`
                : (p.source ?? 'attachment');
              return (
                <div key={p.id} className="chat-pending-thumb" title={tip}>
                  <img src={p.url} alt={p.source ?? 'attachment'} />
                  <button
                    type="button"
                    className="chat-pending-remove"
                    onClick={() => removePending(slug, p.id)}
                    aria-label="Remove attachment"
                    title="Remove"
                  >
                    ×
                  </button>
                  {p.crop ? (
                    <span className="chat-pending-tag chat-pending-tag-time">
                      🕐 {p.crop.timeLabel}
                    </span>
                  ) : (
                    p.source && <span className="chat-pending-tag">{p.source}</span>
                  )}
                </div>
              );
            })}
            {uploading && <span className="chat-pending-uploading">uploading…</span>}
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
                : 'Tell claude what to do · drag/paste images · Enter to send · Shift+Enter for newline'
            }
            onChange={onChange}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
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
              disabled={!draft.trim() && pending.length === 0}
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
