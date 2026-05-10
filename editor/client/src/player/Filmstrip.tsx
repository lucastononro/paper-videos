import React from 'react';
import type { PlayerRef } from '@remotion/player';
import type { AssetsIndex, ManimLastFrames, Manifest, Visual } from '../api';
import { staticAssetBaseUrl } from '../api';

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
  const dragRef = React.useRef(false);
  const [width, setWidth] = React.useState(0);

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

  const seekToX = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const frame = Math.round((x / rect.width) * (total - 1));
    playerRef?.current?.seekTo(frame);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekToX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) seekToX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
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
          gap: 12,
          marginBottom: 4,
          fontSize: 10,
          color: 'var(--text-mute)',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        <span>filmstrip</span>
        <span style={{ flex: 1 }} />
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
              borderRight:
                i < thumbs.length - 1 ? '1px solid rgba(0, 0, 0, 0.35)' : 'none',
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
