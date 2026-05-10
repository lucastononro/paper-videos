import React from 'react';
import { ws } from '../ws/client';
import { useThreadStore, useThreadsBindings } from './store';
import { MessageList } from '../chat/MessageList';
import type { ThreadView } from './store';
import type { ThreadStatus } from '../ws/types';
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
  const selectThread = useThreadStore((s) => s.selectThread);

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="threads-panel">
      <div className="threads-panel-header">
        <span className="threads-panel-title">Spot edits</span>
        <span className="threads-panel-count">
          {threads.length === 0 ? 'no threads' : `${threads.length} thread${threads.length === 1 ? '' : 's'}`}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="threads-panel-close" onClick={onClose} title="Close">
          ✕
        </button>
      </div>
      <div className="threads-panel-list">
        {threads.length === 0 && (
          <div className="threads-panel-empty">
            Select a beat or block in the timeline below the player, then click&nbsp;
            <strong>Spot-edit ↗</strong> to start an async thread scoped to it.
          </div>
        )}
        {threads.map((t) => (
          <ThreadCard
            key={t.id}
            thread={t}
            selected={t.id === selectedId}
            onSelect={() => selectThread(slug, t.id)}
          />
        ))}
      </div>
      {selected && <ThreadDetail thread={selected} />}
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
    useThreadStore.getState().appendLocalUser(thread.id, text);
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
        <MessageList items={thread.items} inFlight={inFlight} />
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
