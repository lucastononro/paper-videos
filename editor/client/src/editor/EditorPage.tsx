import React from 'react';
import type { PlayerRef } from '@remotion/player';
import {
  cancelRender,
  fetchPreviewData,
  preparePreview,
  startRender,
  type FullPreviewData,
} from '../api';
import { ChatPanel } from '../chat/ChatPanel';
import { PlayerPanel } from '../player/PlayerPanel';
import { BeatStrip } from '../player/BeatStrip';
import { Filmstrip } from '../player/Filmstrip';
import { QABanner } from '../qa/QABanner';
import { ThreadsPanel } from '../threads/ThreadsPanel';
import { useThreadStore, useThreadsBindings } from '../threads/store';
import { AssetsTab } from '../assets/AssetsTab';
import { useRenderBindings, useRenderStore } from '../render/store';
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
  //
  // Refresh discipline: only show 'preparing' on the *first* load. Once we
  // have a `ready` snapshot, subsequent reloadTick bumps (debounced
  // preview:reload from chokidar) refetch silently and swap the data in
  // place — no flicker, no Player remount mid-edit.
  const [reloading, setReloading] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const tryLoad = async () => {
      try {
        const { exists } = await preparePreview(slug);
        if (cancelled) return;
        if (!exists) {
          setLoad({ kind: 'draft' });
          setReloading(false);
          return;
        }
        const data = await fetchPreviewData(slug);
        if (cancelled) return;
        setLoad({ kind: 'ready', data });
        setReloading(false);
      } catch (err) {
        if (cancelled) return;
        const msg = String(err);
        if (msg.includes('not found') || msg.includes('Manifest at')) {
          setLoad({ kind: 'draft' });
        } else {
          setLoad({ kind: 'error', message: msg });
        }
        setReloading(false);
      }
    };
    setLoad((prev) => {
      // Keep the canvas mounted across reloads — only enter 'preparing' on
      // the very first load (when there's nothing to keep visible).
      if (prev.kind === 'ready') {
        setReloading(true);
        return prev;
      }
      if (prev.kind === 'draft') return prev;
      return { kind: 'preparing' };
    });
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

  // Right-pane tab state. The user can flip between watching the video and
  // browsing the slug's files (paper.pdf, narration mp3s, manim mp4s, etc).
  const [rightTab, setRightTab] = React.useState<'video' | 'assets'>('video');

  const insertMention = React.useCallback((token: string) => {
    setDraft((d) => {
      const sep = d.length === 0 || d.endsWith(' ') ? '' : ' ';
      return d + sep + token + ' ';
    });
    setTimeout(() => chatInputRef.current?.focus(), 0);
  }, []);

  // Threads-panel state (per-slug, in the threads store)
  useThreadsBindings();
  useRenderBindings();
  const render = useRenderStore((s) => s.byslug[slug]);
  const markRenderStarting = useRenderStore((s) => s.markStarting);
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
    // `auto minmax(0, 1fr)` — bare `1fr` rows default to `min-content`, which
    // means tall children (chat with many tool cards) blow out the layout and
    // push the body to scroll. `minmax(0, 1fr)` allows the row to shrink so
    // the chat / player constrain themselves and scroll internally.
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', height: '100%', width: '100%', overflow: 'hidden' }}>
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
        {!isDraft && (
          <RenderButton
            slug={slug}
            running={Boolean(render?.running)}
            percent={render?.percent ?? 0}
            lastLine={render?.lastLine ?? null}
            lastResult={render?.lastResult ?? null}
            onStart={async () => {
              markRenderStarting(slug);
              try {
                await startRender(slug);
              } catch (err) {
                // Surface in the console; the WS render:done with ok=false
                // also drops back to idle.
                // eslint-disable-next-line no-console
                console.error('[render]', err);
              }
            }}
            onCancel={async () => {
              try {
                await cancelRender(slug);
              } catch {
                /* server logs */
              }
            }}
          />
        )}
      </header>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplateForLayout(isDraft, threadsOpen),
          minHeight: 0,
          height: '100%',
          overflow: 'hidden',
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
            <div style={{ flexShrink: 0 }}>
              <RightTabs current={rightTab} onChange={setRightTab} reloading={reloading} />
            </div>
            {rightTab === 'video' ? (
              <>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  {load.kind === 'preparing' && (
                    <Centered text="Preparing preview (mirroring assets, probing manim mp4s)…" />
                  )}
                  {load.kind === 'loading' && <Centered text="Loading manifest…" />}
                  {load.kind === 'error' && <Centered text={`Error: ${load.message}`} error />}
                  {load.kind === 'ready' && (
                    // `key` was previously bumped on every reloadTick → full
                    // PlayerPanel remount → flicker. Now we re-fetch silently
                    // and let React reconcile the inputProps in place.
                    <PlayerPanel
                      slug={slug}
                      data={load.data}
                      playerRef={playerRef}
                      cacheBustKey={reloadTick}
                    />
                  )}
                </div>
                {load.kind === 'ready' && (
                  <div style={{ flexShrink: 0 }}>
                    <Filmstrip
                      slug={slug}
                      manifest={load.data.manifest}
                      assets={load.data.assets}
                      manimLastFrames={load.data.manimLastFrames}
                      playerRef={playerRef}
                    />
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
                  </div>
                )}
              </>
            ) : (
              <div style={{ flex: 1, minHeight: 0 }}>
                <AssetsTab slug={slug} />
              </div>
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
  // Use `minmax(0, …)` everywhere a column might want to grow, so flex/scroll
  // children inside it can constrain and overflow internally.
  if (isDraft) return 'minmax(0, 1fr)';
  if (threadsOpen) return 'minmax(280px, 26%) minmax(0, 1fr) minmax(320px, 30%)';
  return 'minmax(320px, 32%) minmax(0, 1fr)';
}

const RightTabs: React.FC<{
  current: 'video' | 'assets';
  onChange: (next: 'video' | 'assets') => void;
  reloading?: boolean;
}> = ({ current, onChange, reloading }) => {
  const tab = (key: 'video' | 'assets', label: string) => (
    <button
      type="button"
      onClick={() => onChange(key)}
      style={{
        padding: '6px 14px',
        background: current === key ? 'var(--bg)' : 'transparent',
        color: current === key ? 'var(--text)' : 'var(--text-mute)',
        border: 'none',
        borderBottom: `2px solid ${current === key ? 'var(--accent)' : 'transparent'}`,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: current === key ? 600 : 500,
        letterSpacing: 0.3,
      }}
    >
      {label}
    </button>
  );
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elev)',
        minHeight: 32,
      }}
    >
      {tab('video', 'Video')}
      {tab('assets', 'Assets')}
      <span style={{ flex: 1 }} />
      {reloading && (
        <span
          title="Refreshing manifest in background"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--text-mute)',
            paddingRight: 4,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'pulse 1.2s ease-in-out infinite',
            }}
          />
          syncing
        </span>
      )}
    </div>
  );
};

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

/**
 * Header render button — button-driven Remotion render, no agent.
 *
 * Idle: "▶ Render" pill. Click → POST /render, server spawns
 * `npm run render-remotion -- <slug>` and streams progress events.
 *
 * Running: progress bar fills the pill background; label flips to
 * "Rendering 42%" with a tiny "■" cancel button next to it. Hovering shows
 * the latest log line as a tooltip so the user can see what stage we're in
 * (Bundling, Selecting composition, …).
 *
 * Done: a brief flash to green (ok) or red (failure). On success the
 * server also fires `preview:reload`, which the EditorPage's existing
 * effect picks up to refresh the player.
 */
const RenderButton: React.FC<{
  slug: string;
  running: boolean;
  percent: number;
  lastLine: string | null;
  lastResult: { ok: boolean; durationMs: number; tailLog: string } | null;
  onStart: () => void;
  onCancel: () => void;
}> = ({ running, percent, lastLine, lastResult, onStart, onCancel }) => {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  if (running) {
    return (
      <div
        title={lastLine ?? `rendering ${pct}%`}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 4px 4px 10px',
          background: 'transparent',
          border: '1px solid rgba(126, 231, 135, 0.45)',
          borderRadius: 6,
          fontSize: 12,
          color: '#7ee787',
          fontFamily: 'inherit',
          overflow: 'hidden',
          minWidth: 132,
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: 'rgba(126, 231, 135, 0.16)',
            transition: 'width 0.2s ease',
            pointerEvents: 'none',
          }}
        />
        <span style={{ position: 'relative' }}>Rendering {pct}%</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onCancel}
          title="Cancel render"
          style={{
            position: 'relative',
            padding: '2px 6px',
            background: 'transparent',
            color: '#ff9494',
            border: '1px solid rgba(255, 148, 148, 0.40)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'inherit',
          }}
        >
          ■
        </button>
      </div>
    );
  }
  // Idle. Optional last-result flash.
  const justFinished = lastResult != null;
  const flash = justFinished
    ? lastResult!.ok
      ? { color: '#7ee787', border: 'rgba(126, 231, 135, 0.45)' }
      : { color: '#ff9494', border: 'rgba(255, 148, 148, 0.40)' }
    : null;
  return (
    <button
      type="button"
      onClick={onStart}
      title={
        justFinished
          ? lastResult!.ok
            ? `Last render ok (${(lastResult!.durationMs / 1000).toFixed(1)}s) — click to render again`
            : `Last render failed:\n${lastResult!.tailLog.slice(-500)}`
          : 'Render this video to output.mp4 (button-driven, no agent)'
      }
      style={{
        padding: '5px 12px',
        background: flash ? `color-mix(in srgb, ${flash.color} 8%, transparent)` : '#ffd866',
        color: flash ? flash.color : '#0e1117',
        border: `1px solid ${flash ? flash.border : '#ffd866'}`,
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {flash ? (flash.color === '#7ee787' ? '✓ Rendered' : '✕ Render failed') : '▶ Render'}
    </button>
  );
};
