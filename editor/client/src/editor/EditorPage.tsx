import React from 'react';
import type { PlayerRef } from '@remotion/player';
import {
  fetchPreviewData,
  preparePreview,
  type FullPreviewData,
} from '../api';
import { ChatPanel } from '../chat/ChatPanel';
import { PlayerPanel } from '../player/PlayerPanel';
import { BeatStrip } from '../player/BeatStrip';
import { QABanner } from '../qa/QABanner';
import { ThreadsPanel } from '../threads/ThreadsPanel';
import { useThreadStore, useThreadsBindings } from '../threads/store';
import { navigate } from '../router';

type LoadState =
  | { kind: 'draft' }                                 // no manifest yet — chat-only mode
  | { kind: 'preparing' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: FullPreviewData }
  | { kind: 'error'; message: string };

const EMPTY_THREADS: never[] = [];

export const EditorPage: React.FC<{ slug: string }> = ({ slug }) => {
  // Always start in `preparing` and let the load attempt decide. If the slug
  // has no folder yet (brand-new user-named video), `preparePreview` returns
  // 404 and `tryLoad` flips us into `draft` state. The "preparing" flicker is
  // ~50ms, not worth pre-checking the slug name for.
  const [load, setLoad] = React.useState<LoadState>({ kind: 'preparing' });
  const [reloadTick, setReloadTick] = React.useState(0);
  const [draft, setDraft] = React.useState('');
  const playerRef = React.useRef<PlayerRef | null>(null);
  const chatInputRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Try to load preview data. For brand-new draft slugs the manifest doesn't
  // exist yet — that's expected; we sit in `draft` state until chokidar
  // reports a manifest file appearing for our slug, then re-attempt.
  React.useEffect(() => {
    let cancelled = false;
    const tryLoad = async () => {
      try {
        const { exists } = await preparePreview(slug);
        if (cancelled) return;
        // ChatGPT-before-canvas behavior: if the slug folder isn't there yet,
        // sit in draft state — chat-only, no error message, no flicker.
        if (!exists) {
          setLoad({ kind: 'draft' });
          return;
        }
        setLoad({ kind: 'loading' });
        const data = await fetchPreviewData(slug);
        if (cancelled) return;
        setLoad({ kind: 'ready', data });
      } catch (err) {
        if (cancelled) return;
        // Manifest is missing even though the folder exists (e.g. /paper-video
        // new still running). Treat as draft, not an error.
        const msg = String(err);
        if (msg.includes('not found') || msg.includes('Manifest at')) {
          setLoad({ kind: 'draft' });
        } else {
          setLoad({ kind: 'error', message: msg });
        }
      }
    };
    if (load.kind !== 'draft') {
      setLoad({ kind: 'preparing' });
    }
    void tryLoad();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, reloadTick]);

  // Watcher → preview:reload event: refetch + remount on any underlying
  // change. Also flips `draft` → `ready` automatically when the manifest
  // first materializes.
  React.useEffect(() => {
    const onReload = (evt: Event) => {
      const detail = (evt as CustomEvent).detail as { slug?: string };
      if (detail?.slug === slug) {
        setReloadTick((n) => n + 1);
      }
    };
    window.addEventListener('preview:reload', onReload);
    return () => window.removeEventListener('preview:reload', onReload);
  }, [slug]);

  const insertMention = React.useCallback((token: string) => {
    setDraft((d) => {
      const sep = d.length === 0 || d.endsWith(' ') ? '' : ' ';
      return d + sep + token + ' ';
    });
    setTimeout(() => chatInputRef.current?.focus(), 0);
  }, []);

  // Threads-panel state (per-slug, in the threads store)
  useThreadsBindings();
  const threadsOpen = useThreadStore((s) => Boolean(s.panelOpenBySlug[slug]));
  const setPanelOpen = useThreadStore((s) => s.setPanelOpen);
  // Stable empty sentinel — `?? []` would create a new ref every render and
  // trip zustand 5's Object.is-by-default equality, causing infinite loops.
  const threadsForSlug = useThreadStore((s) => s.threadsBySlug[slug] ?? EMPTY_THREADS);

  const isDraft = load.kind === 'draft';
  const draftHint = isDraft ? (
    <div className="chat-empty">
      <strong>New video — {slug}</strong>
      Tell claude what paper to explain — an arXiv id, a URL, a topic. It'll fetch the PDF, extract
      equations, and scaffold the project at <code>videos/{slug}/</code>. The video player will
      appear here as soon as the manifest is ready.
    </div>
  ) : null;

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', width: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 18px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elev)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate({ kind: 'gallery' })}
          style={{
            padding: '5px 10px',
            background: 'transparent',
            color: 'var(--text-mute)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
          }}
        >
          ← Gallery
        </button>
        <strong style={{ fontSize: 14 }}>{slug}</strong>
        {load.kind === 'ready' && (
          <span style={{ color: 'var(--text-mute)', fontSize: 12 }}>
            · {load.data.manifest.paperTitle}
          </span>
        )}
        {isDraft && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(255, 217, 102, 0.12)',
              color: '#ffd866',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.4,
            }}
          >
            NEW
          </span>
        )}
        <span style={{ flex: 1 }} />
        {!isDraft && (
          <button
            type="button"
            onClick={() => setPanelOpen(slug, !threadsOpen)}
            style={{
              padding: '5px 10px',
              background: threadsOpen ? 'rgba(255, 217, 102, 0.10)' : 'transparent',
              color: threadsOpen ? '#ffd866' : 'var(--text-mute)',
              border: `1px solid ${threadsOpen ? 'rgba(255, 217, 102, 0.40)' : 'var(--border)'}`,
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
            title="Async spot-edit threads (one claude session per beat or block)"
          >
            ↗ Spot edits {threadsForSlug.length > 0 && `(${threadsForSlug.length})`}
          </button>
        )}
        <button
          type="button"
          onClick={() => setReloadTick((n) => n + 1)}
          style={{
            padding: '5px 10px',
            background: 'transparent',
            color: 'var(--text-mute)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
          }}
        >
          ↻ Reload
        </button>
      </header>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplateForLayout(isDraft, threadsOpen),
          minHeight: 0,
          transition: 'grid-template-columns 0.25s ease',
        }}
      >
        {isDraft ? (
          // ChatGPT-before-canvas: centered chat column, max 720px wide. No
          // canvas mounted at all until the manifest materializes.
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              minHeight: 0,
              background: 'var(--bg)',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 760,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                borderLeft: '1px solid var(--border)',
                borderRight: '1px solid var(--border)',
              }}
            >
              <ChatPanel
                slug={slug}
                draft={draft}
                setDraft={setDraft}
                inputRef={chatInputRef}
                emptyHint={draftHint}
              />
            </div>
          </div>
        ) : (
          <ChatPanel
            slug={slug}
            draft={draft}
            setDraft={setDraft}
            inputRef={chatInputRef}
            emptyHint={draftHint}
          />
        )}
        {!isDraft && (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              {load.kind === 'preparing' && (
                <Centered text="Preparing preview (mirroring assets, probing manim mp4s)…" />
              )}
              {load.kind === 'loading' && <Centered text="Loading manifest…" />}
              {load.kind === 'error' && <Centered text={`Error: ${load.message}`} error />}
              {load.kind === 'ready' && (
                <PlayerPanel
                  key={`${slug}:${reloadTick}`}
                  slug={slug}
                  data={load.data}
                  playerRef={playerRef}
                />
              )}
            </div>
            {load.kind === 'ready' && (
              <>
                <BeatStrip
                  slug={slug}
                  manifest={load.data.manifest}
                  playerRef={playerRef}
                  onMention={insertMention}
                />
                <QABanner
                  slug={slug}
                  manifest={load.data.manifest}
                  onJumpFrame={(f) => playerRef.current?.seekTo(f)}
                  onMention={insertMention}
                />
              </>
            )}
          </div>
        )}
        {!isDraft && threadsOpen && (
          <ThreadsPanel slug={slug} onClose={() => setPanelOpen(slug, false)} />
        )}
      </div>
    </div>
  );
};

function gridTemplateForLayout(isDraft: boolean, threadsOpen: boolean): string {
  if (isDraft) return '1fr';
  if (threadsOpen) return 'minmax(280px, 26%) 1fr minmax(320px, 30%)';
  return 'minmax(320px, 32%) 1fr';
}

const Centered: React.FC<{ text: string; error?: boolean }> = ({ text, error }) => (
  <div
    style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: error ? '#ff6b6b' : 'var(--text-mute)',
      fontSize: 13,
      padding: 32,
      textAlign: 'center',
    }}
  >
    {text}
  </div>
);
