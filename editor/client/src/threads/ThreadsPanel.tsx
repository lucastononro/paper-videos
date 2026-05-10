import React from 'react';
import { ws } from '../ws/client';
import { useThreadStore, useThreadsBindings } from './store';
import { MessageList } from '../chat/MessageList';
import type { ThreadView } from './store';
import type { ThreadScope, ThreadStatus } from '../ws/types';
import './threads.css';

const EMPTY_THREADS: never[] = [];

const STATUS_LABEL: Record<ThreadStatus, string> = {
  ready: 'Ready',
  running: 'Running',
  awaiting_finish: 'Finishing',
  completed: 'Completed',
  failed: 'Failed',
  ended: 'Ended',
};

const STATUS_TONE: Record<ThreadStatus, string> = {
  ready: 'tone-neutral',
  running: 'tone-running',
  awaiting_finish: 'tone-running',
  completed: 'tone-success',
  failed: 'tone-error',
  ended: 'tone-muted',
};

export const ThreadsPanel: React.FC<{ slug: string; onClose: () => void }> = ({
  slug,
  onClose,
}) => {
  useThreadsBindings();
  // EMPTY_THREADS is a stable sentinel — see ChatPanel for why this matters.
  const threads = useThreadStore((s) => s.threadsBySlug[slug] ?? EMPTY_THREADS);
  const selectedId = useThreadStore((s) => s.selectedByslug[slug] ?? null);
  const draft = useThreadStore((s) => s.draftBySlug[slug] ?? null);
  const selectThread = useThreadStore((s) => s.selectThread);
  const setDraft = useThreadStore((s) => s.setDraft);

  // Active tab: "draft" if the user is composing a brand-new spot-edit;
  // otherwise the selected thread id; otherwise the most-recent thread.
  const fallbackId = threads[threads.length - 1]?.id ?? null;
  const activeThreadId = !draft ? (selectedId ?? fallbackId) : null;
  const selected = threads.find((t) => t.id === activeThreadId) ?? null;

  return (
    <div className="threads-panel">
      <div className="threads-panel-header">
        <span className="threads-panel-title">Spot edits</span>
        <span className="threads-panel-count">
          {threads.length === 0 && !draft
            ? 'no threads'
            : `${threads.length + (draft ? 1 : 0)} ${threads.length + (draft ? 1 : 0) === 1 ? 'thread' : 'threads'}`}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="threads-panel-close" onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      {/* Horizontal tab strip — one tab per active spot-edit thread, plus
          a "New" tab when a draft is in progress. Click a tab to switch
          between concurrently-running spot-edits without losing the others'
          state. The strip scrolls horizontally when there are too many. */}
      {(threads.length > 0 || draft) && (
        <div className="threads-panel-tabs">
          {threads.map((t) => (
            <ThreadTab
              key={t.id}
              thread={t}
              active={!draft && t.id === activeThreadId}
              onSelect={() => {
                if (draft) setDraft(slug, null);
                selectThread(slug, t.id);
              }}
            />
          ))}
          {draft && (
            <button
              type="button"
              className="thread-tab is-active is-draft"
              onClick={() => {
                /* already active */
              }}
              title="New spot-edit being composed"
            >
              <span className="thread-pill tone-neutral">New</span>
              <span className="thread-tab-label">{shortScope(draft.scope)}</span>
            </button>
          )}
        </div>
      )}

      {threads.length === 0 && !draft && (
        <div className="threads-panel-empty">
          Drag a time crop on the filmstrip and click&nbsp;
          <strong>↗ Spot-edit</strong> to start an async claude thread scoped to that range.
        </div>
      )}

      {/* Detail of whichever tab is active. Drafts get the composer; an
          active thread gets the chat detail. */}
      {draft ? (
        <ThreadComposer
          slug={slug}
          scope={draft.scope}
          initialDraft={draft.initialAsk ?? ''}
          onCancel={() => setDraft(slug, null)}
        />
      ) : selected ? (
        <ThreadDetail thread={selected} />
      ) : null}
    </div>
  );
};

/** Compact horizontal tab. Status pill + scope label. */
const ThreadTab: React.FC<{
  thread: ThreadView;
  active: boolean;
  onSelect: () => void;
}> = ({ thread, active, onSelect }) => {
  const tone = STATUS_TONE[thread.status];
  return (
    <button
      type="button"
      className={`thread-tab ${active ? 'is-active' : ''}`}
      onClick={onSelect}
      title={thread.initialAsk}
    >
      <span className={`thread-pill ${tone}`}>
        {thread.status === 'running' && <span className="thread-pill-spinner" />}
        {STATUS_LABEL[thread.status]}
      </span>
      <span className="thread-tab-label">
        {thread.scope.label ||
          [thread.scope.beatIds.join(','), thread.scope.blockIds.join(',')]
            .filter(Boolean)
            .join(' + ') ||
          '(scope)'}
      </span>
    </button>
  );
};

function shortScope(s: ThreadScope): string {
  if (s.label) return s.label;
  const parts: string[] = [];
  if (s.beatIds.length) parts.push(s.beatIds.join(','));
  if (s.blockIds.length) parts.push(s.blockIds.join(','));
  return parts.join(' + ') || '(scope)';
}

/**
 * In-panel composer for a new thread. Replaces the old window.prompt popup —
 * the user picks a beat/block in the timeline, BeatStrip seeds a draft, this
 * composer is shown with the scope label + a textarea, and pressing Enter
 * sends `thread:create`. The draft auto-clears when `thread:created` arrives
 * (see store.ts).
 */
const ThreadComposer: React.FC<{
  slug: string;
  scope: ThreadScope;
  initialDraft: string;
  onCancel: () => void;
}> = ({ slug, scope, initialDraft, onCancel }) => {
  const [text, setText] = React.useState(initialDraft);
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    // Autofocus & put the cursor at the end so the user can start typing
    // immediately. The button-click that opened the panel happens in the
    // same React tick, so we focus on next paint.
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, []);

  const send = () => {
    const ask = text.trim();
    if (!ask) return;
    ws.send({ kind: 'thread:create', slug, scope, initialAsk: ask });
    // Don't setDraft(null) here — let the `thread:created` echo do it so
    // we don't briefly show the empty-list state if the round-trip is slow.
  };

  const scopeLabel =
    scope.label ||
    [scope.beatIds.join(','), scope.blockIds.join(',')].filter(Boolean).join(' + ') ||
    '(scope)';

  return (
    <div className="thread-detail">
      <div className="thread-detail-header">
        <span className="thread-pill tone-neutral">New</span>
        <span className="thread-detail-scope">↗ Spot-edit on {scopeLabel}</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="thread-action"
          onClick={onCancel}
          title="Cancel — no thread is created"
        >
          ✕ Cancel
        </button>
      </div>
      <div className="thread-detail-body chat-panel">
        <div className="thread-composer-hint">
          Forking a fresh claude session scoped to <strong>{scopeLabel}</strong>. The agent will
          edit the manifest / script for that beat or block in isolation, then summarize back.
        </div>
        <div className="chat-input-wrap">
          <div className="chat-input-area">
            <textarea
              ref={taRef}
              className="chat-input-textarea"
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancel();
                }
              }}
              placeholder={`What should claude do for ${scopeLabel}? · Enter to start · Esc to cancel`}
              rows={3}
            />
            <div className="chat-input-actions">
              <button
                type="button"
                className="chat-pill chat-pill-send"
                onClick={send}
                disabled={!text.trim()}
              >
                Start ↵
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ThreadCard: React.FC<{
  thread: ThreadView;
  selected: boolean;
  onSelect: () => void;
}> = ({ thread, selected, onSelect }) => {
  const scopeLabel =
    thread.scope.label ||
    [thread.scope.beatIds.join(','), thread.scope.blockIds.join(',')]
      .filter(Boolean)
      .join(' + ') ||
    '(scope)';
  const tone = STATUS_TONE[thread.status];
  return (
    <button
      type="button"
      className={`thread-card ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <div className="thread-card-row">
        <span className={`thread-pill ${tone}`}>
          {thread.status === 'running' && <span className="thread-pill-spinner" />}
          {STATUS_LABEL[thread.status]}
        </span>
        <span className="thread-card-scope">{scopeLabel}</span>
      </div>
      <div className="thread-card-ask">{thread.initialAsk}</div>
      {thread.summary && <div className="thread-card-summary">{thread.summary}</div>}
    </button>
  );
};

const ThreadDetail: React.FC<{ thread: ThreadView }> = ({ thread }) => {
  const [draft, setDraft] = React.useState('');
  const inFlight = thread.status === 'running' || thread.status === 'awaiting_finish';
  const finalized = thread.status === 'completed' || thread.status === 'failed' || thread.status === 'ended';

  const send = () => {
    const text = draft.trim();
    if (!text || finalized) return;
    // Server echoes the message back as a `user_text` thread event, so we
    // don't append locally — keeps the replay-on-reconnect path clean.
    ws.send({ kind: 'thread:turn', threadId: thread.id, text });
    setDraft('');
  };

  return (
    <div className="thread-detail">
      <div className="thread-detail-header">
        <span className={`thread-pill ${STATUS_TONE[thread.status]}`}>
          {thread.status === 'running' && <span className="thread-pill-spinner" />}
          {STATUS_LABEL[thread.status]}
        </span>
        <span className="thread-detail-scope">
          {thread.scope.label ||
            [thread.scope.beatIds.join(','), thread.scope.blockIds.join(',')]
              .filter(Boolean)
              .join(' + ')}
        </span>
        <span style={{ flex: 1 }} />
        {!finalized && (
          <>
            <button
              type="button"
              className="thread-action thread-action-finish"
              onClick={() => ws.send({ kind: 'thread:finish', threadId: thread.id })}
              title="Ask the agent to summarize and complete the thread"
            >
              ✓ Finish
            </button>
            <button
              type="button"
              className="thread-action thread-action-end"
              onClick={() => ws.send({ kind: 'thread:end', threadId: thread.id })}
              title="Stop without summary"
            >
              ■ End
            </button>
          </>
        )}
        {finalized && (
          <button
            type="button"
            className="thread-action"
            onClick={() => ws.send({ kind: 'thread:delete', threadId: thread.id })}
            title="Delete this thread"
          >
            🗑
          </button>
        )}
      </div>
      <div className="thread-detail-body chat-panel">
        <MessageList
          items={thread.items}
          inFlight={inFlight}
          slug={thread.slug}
          onAnswer={(text) => ws.send({ kind: 'thread:turn', threadId: thread.id, text })}
        />
        {!finalized && (
          <div className="chat-input-wrap">
            <div className={`chat-input-area ${inFlight ? 'is-running' : ''}`}>
              <textarea
                className="chat-input-textarea"
                value={draft}
                onChange={(e) => setDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  inFlight
                    ? 'Send to interrupt & redirect this thread…'
                    : 'Refine the spot edit · Enter to send'
                }
                rows={1}
              />
              <div className="chat-input-actions">
                <button
                  type="button"
                  className={`chat-pill chat-pill-send ${inFlight ? 'is-redirect' : ''}`}
                  onClick={send}
                  disabled={!draft.trim()}
                >
                  {inFlight ? 'Redirect ↵' : 'Send ↵'}
                </button>
              </div>
            </div>
          </div>
        )}
        {finalized && thread.summary && (
          <div className="thread-summary-card">
            <div className="thread-summary-label">summary</div>
            <div className="thread-summary-text">{thread.summary}</div>
          </div>
        )}
      </div>
    </div>
  );
};
