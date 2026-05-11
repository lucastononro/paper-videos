import React from 'react';
import type { PlayerRef } from '@remotion/player';
import type { AssetsIndex, ManimLastFrames, Manifest, Visual } from '../api';
import { staticAssetBaseUrl } from '../api';
import { useSelection } from '../selection/selection';
import { useThreadStore } from '../threads/store';

const THUMB_W = 96;
const THUMB_H = 54; // 16:9

type Representative =
  | { kind: 'image'; src: string }
  | { kind: 'label'; text: string; color: string };

function representativeForVisual(
  v: Visual,
  baseUrl: string,
  assets: AssetsIndex,
  manimLastFrames: ManimLastFrames,
): Representative {
  switch (v.kind) {
    case 'paperPage':
    case 'highlightedQuote': {
      const n = String(v.pageIdx).padStart(3, '0');
      return { kind: 'image', src: `${baseUrl}pages/page-${n}.png` };
    }
    case 'manimClip': {
      const lf = manimLastFrames[v.mp4];
      if (lf) return { kind: 'image', src: `${baseUrl}${lf}` };
      return { kind: 'label', text: 'manim', color: '#0c2530' };
    }
    case 'image':
    case 'diagram': {
      const a = assets[v.assetId];
      if (a) return { kind: 'image', src: `${baseUrl}${a.file}` };
      return { kind: 'label', text: v.kind, color: '#19314a' };
    }
    case 'titleCard':
      return { kind: 'label', text: v.text, color: '#2a1d4a' };
    case 'equationCard':
    case 'equationStep':
      return { kind: 'label', text: 'eq', color: '#3a2a08' };
    case 'pause':
      return { kind: 'label', text: '', color: '#1a1f2a' };
  }
}

function fmt(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs - m * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * iMovie-style filmstrip: a horizontal strip of representative thumbnails
 * sampled across the timeline, with a draggable playhead overlay synced to
 * the Remotion Player via requestAnimationFrame (no React state on the hot
 * path so playback stays smooth).
 *
 * Thumbnails come from each visual block's natural still:
 *   - paperPage / highlightedQuote → pages/page-NNN.png
 *   - manimClip → manim-last-frames/<scene>.png
 *   - image / diagram → the asset itself
 *   - titleCard / equation* / pause → labelled tile
 *
 * Clicking or dragging anywhere on the strip seeks; the playhead snaps under
 * the pointer for instant scrubbing.
 */
export const Filmstrip: React.FC<{
  slug: string;
  manifest: Manifest;
  assets: AssetsIndex;
  manimLastFrames: ManimLastFrames;
  playerRef?: React.MutableRefObject<PlayerRef | null>;
}> = ({ slug, manifest, assets, manimLastFrames, playerRef }) => {
  const baseUrl = staticAssetBaseUrl(slug);
  const total = Math.max(1, manifest.totalFrames);
  const fps = manifest.fps;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const playheadRef = React.useRef<HTMLDivElement>(null);
  const timeLabelRef = React.useRef<HTMLSpanElement>(null);
  // Pointer-gesture bookkeeping. `downFrame` is the frame the user pressed
  // down at; `dragStarted` flips true once the user has moved more than
  // DRAG_THRESHOLD_PX away from `downFrame`. Without that threshold every
  // click would create a 0-frame "range" that's annoying to dismiss.
  const downFrameRef = React.useRef<number | null>(null);
  const dragStartedRef = React.useRef(false);
  const downXRef = React.useRef(0);
  const [width, setWidth] = React.useState(0);

  const sel = useSelection((s) => s.current);
  const setSel = useSelection((s) => s.set);
  const setDraft = useThreadStore((s) => s.setDraft);
  const setPanelOpen = useThreadStore((s) => s.setPanelOpen);

  const range = sel?.kind === 'range' ? sel : null;
  const rangeStartPct = range ? (range.startFrame / total) * 100 : 0;
  const rangeWidthPct = range
    ? Math.max(0.4, ((range.endFrame - range.startFrame) / total) * 100)
    : 0;

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Drive the playhead and the time read-out from Player frames via rAF — no
  // React renders during playback. The DOM updates directly.
  React.useEffect(() => {
    let raf = 0;
    let lastFrame = -1;
    const tick = () => {
      const f = playerRef?.current?.getCurrentFrame() ?? 0;
      if (f !== lastFrame) {
        lastFrame = f;
        if (playheadRef.current) {
          playheadRef.current.style.left = `${(f / total) * 100}%`;
        }
        if (timeLabelRef.current) {
          timeLabelRef.current.textContent = `${fmt(f / fps)} / ${fmt(total / fps)}`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, fps, playerRef]);

  const frameAtX = (clientX: number): number => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return Math.round((x / rect.width) * (total - 1));
  };
  const seekToX = (clientX: number) => {
    playerRef?.current?.seekTo(frameAtX(clientX));
  };

  const DRAG_THRESHOLD_PX = 4;
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    downFrameRef.current = frameAtX(e.clientX);
    downXRef.current = e.clientX;
    dragStartedRef.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (downFrameRef.current === null) return;
    const moved = Math.abs(e.clientX - downXRef.current) > DRAG_THRESHOLD_PX;
    if (!dragStartedRef.current && !moved) return;
    if (!dragStartedRef.current) {
      dragStartedRef.current = true;
    }
    // Live-update the selection range as the pointer moves so the gold band
    // grows under it.
    const a = downFrameRef.current;
    const b = frameAtX(e.clientX);
    const startFrame = Math.min(a, b);
    const endFrame = Math.max(a, b);
    setSel({ kind: 'range', startFrame, endFrame });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    if (downFrameRef.current === null) return;
    if (dragStartedRef.current) {
      // Drag finished — selection is already set, leave it. Don't seek.
    } else {
      // No drag: this was a click. Seek and clear any prior range.
      seekToX(e.clientX);
      if (sel?.kind === 'range') setSel(null);
    }
    downFrameRef.current = null;
    dragStartedRef.current = false;
  };

  const thumbCount = Math.max(8, Math.floor(width / THUMB_W));
  const thumbs = React.useMemo(() => {
    if (thumbCount === 0) return [];
    return Array.from({ length: thumbCount }, (_, i) => {
      const frame = Math.floor(((i + 0.5) / thumbCount) * total);
      const block = manifest.visualBlocks.find(
        (b) => frame >= b.startFrame && frame < b.startFrame + b.durationFrames,
      );
      const rep = block
        ? representativeForVisual(block.visual, baseUrl, assets, manimLastFrames)
        : ({ kind: 'label', text: '', color: '#1a1f2a' } satisfies Representative);
      return { i, frame, rep };
    });
  }, [thumbCount, total, manifest.visualBlocks, baseUrl, assets, manimLastFrames]);

  // Time tick density: aim for ~6–10 ticks across the strip.
  const totalSecs = total / fps;
  const tickInterval =
    totalSecs > 600 ? 60 : totalSecs > 240 ? 30 : totalSecs > 120 ? 15 : totalSecs > 30 ? 5 : 2;
  const ticks = React.useMemo(() => {
    const out: Array<{ left: number; label: string }> = [];
    for (let s = 0; s * fps <= total; s += tickInterval) {
      out.push({ left: ((s * fps) / total) * 100, label: fmt(s) });
    }
    return out;
  }, [tickInterval, total, fps]);

  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        borderTop: '1px solid var(--border)',
        padding: '8px 16px 4px 16px',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4,
          fontSize: 10,
          color: 'var(--text-mute)',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        <span>filmstrip</span>
        <span
          style={{
            color: 'var(--text-mute)',
            textTransform: 'none',
            letterSpacing: 0,
            fontStyle: 'italic',
          }}
        >
          drag to select a time crop · click to seek
        </span>
        <span style={{ flex: 1 }} />
        {range && (
          <>
            <span
              style={{
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                color: '#ffd866',
                textTransform: 'none',
                letterSpacing: 0,
                fontWeight: 600,
              }}
            >
              {fmt(range.startFrame / fps)}→{fmt(range.endFrame / fps)} ·{' '}
              {((range.endFrame - range.startFrame) / fps).toFixed(1)}s
            </span>
            <button
              type="button"
              onClick={() => {
                setDraft(slug, {
                  scope: {
                    beatIds: [],
                    blockIds: [],
                    label: `${fmt(range.startFrame / fps)}→${fmt(range.endFrame / fps)}`,
                    startFrame: range.startFrame,
                    endFrame: range.endFrame,
                  },
                });
                setPanelOpen(slug, true);
              }}
              title="Open a forked claude thread scoped to this time crop"
              style={{
                padding: '2px 8px',
                background: 'rgba(255, 217, 102, 0.12)',
                color: '#ffd866',
                border: '1px solid rgba(255, 217, 102, 0.40)',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.4,
              }}
            >
              ↗ Spot-edit
            </button>
            <button
              type="button"
              onClick={() => setSel(null)}
              title="Clear selection"
              style={{
                padding: '2px 6px',
                background: 'transparent',
                color: 'var(--text-mute)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 10,
              }}
            >
              ✕
            </button>
          </>
        )}
        {!range && (
          <span
            ref={timeLabelRef}
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              color: 'var(--text)',
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            {fmt(0)} / {fmt(totalSecs)}
          </span>
        )}
      </div>
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: 'relative',
          height: THUMB_H,
          display: 'flex',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
          cursor: 'ew-resize',
          touchAction: 'none',
        }}
      >
        {thumbs.map(({ i, rep }) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              borderRight: i < thumbs.length - 1 ? '1px solid rgba(0, 0, 0, 0.35)' : 'none',
              ...(rep.kind === 'image'
                ? {
                    backgroundImage: `url("${rep.src}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: '#0a0d12',
                  }
                : {
                    background: rep.color,
                    color: 'rgba(255, 255, 255, 0.78)',
                    fontSize: 9,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    padding: '0 4px',
                    textAlign: 'center',
                  }),
            }}
          >
            {rep.kind === 'label' && rep.text ? (
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}
              >
                {rep.text}
              </span>
            ) : null}
          </div>
        ))}
        {range && (
          <div
            aria-label="selection"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${rangeStartPct}%`,
              width: `${rangeWidthPct}%`,
              background: 'rgba(255, 217, 102, 0.18)',
              borderLeft: '2px solid rgba(255, 217, 102, 0.85)',
              borderRight: '2px solid rgba(255, 217, 102, 0.85)',
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          ref={playheadRef}
          style={{
            position: 'absolute',
            top: -2,
            bottom: -2,
            left: 0,
            width: 2,
            background: 'var(--accent)',
            boxShadow: '0 0 0 2px rgba(255, 217, 102, 0.20)',
            pointerEvents: 'none',
            transform: 'translateX(-1px)',
          }}
        />
      </div>
      <div
        style={{
          position: 'relative',
          height: 14,
          marginTop: 2,
          fontSize: 9,
          color: 'var(--text-mute)',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        }}
      >
        {ticks.map(({ left, label }) => (
          <span
            key={label}
            style={{
              position: 'absolute',
              left: `${left}%`,
              transform:
                left > 95 ? 'translateX(-100%)' : left < 2 ? 'translateX(0)' : 'translateX(-50%)',
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};
