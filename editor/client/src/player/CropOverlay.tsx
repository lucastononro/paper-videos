import React from 'react';
import type { PlayerRef } from '@remotion/player';
import { toPng } from 'html-to-image';
import { usePendingAttachments } from '../chat/pendingAttachments';
import { uploadChatImage } from '../chat/uploadImage';

/**
 * Drag-rect crop tool that sits on top of the Remotion player.
 *
 * Activation: PlayerPanel's "✂ Crop" button toggles `active`. When active:
 *   1. The overlay covers the player area, dimming it.
 *   2. The user drags a rect — we render a marching-ants outline live.
 *   3. On mouseup, we snapshot the current frame via html-to-image (the
 *      browser Player renders the composition as React DOM — div / img /
 *      video, NOT a canvas — so we serialise the DOM into an SVG
 *      foreignObject and rasterise it). Then we crop to the rect, upload,
 *      and add to the chat's pending attachments.
 *   4. We flash "Added ✓" for a beat so the user sees the success, then
 *      deactivate.
 */
type Rect = { x: number; y: number; w: number; h: number };
type Status =
  | { kind: 'idle' }
  | { kind: 'capturing' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export const CropOverlay: React.FC<{
  slug: string;
  active: boolean;
  onDeactivate: () => void;
  playerRef: React.MutableRefObject<PlayerRef | null>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
}> = ({ slug, active, onDeactivate, playerRef, containerRef }) => {
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [status, setStatus] = React.useState<Status>({ kind: 'idle' });
  const addPending = usePendingAttachments((s) => s.add);
  const dragStart = React.useRef<{ x: number; y: number } | null>(null);

  // Pause the player while crop mode is active so the user lands on a
  // specific frame. Restore play state when leaving (do nothing fancy —
  // they can press play again themselves).
  React.useEffect(() => {
    if (!active) return;
    playerRef.current?.pause();
    setRect(null);
    setStatus({ kind: 'idle' });
    dragStart.current = null;
  }, [active, playerRef]);

  // Escape exits crop mode.
  React.useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDeactivate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onDeactivate]);

  if (!active) return null;

  const overlayBounds = (): DOMRect | null => {
    const el = containerRef.current;
    return el?.getBoundingClientRect() ?? null;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const b = overlayBounds();
    if (!b) return;
    const x = e.clientX - b.left;
    const y = e.clientY - b.top;
    dragStart.current = { x, y };
    setRect({ x, y, w: 0, h: 0 });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    const b = overlayBounds();
    if (!b) return;
    const x = e.clientX - b.left;
    const y = e.clientY - b.top;
    const ax = Math.min(x, dragStart.current.x);
    const ay = Math.min(y, dragStart.current.y);
    const w = Math.abs(x - dragStart.current.x);
    const h = Math.abs(y - dragStart.current.y);
    setRect({ x: ax, y: ay, w, h });
  };

  const onMouseUp = async () => {
    if (!dragStart.current || !rect) {
      dragStart.current = null;
      return;
    }
    dragStart.current = null;
    // Too-small drags = misclicks; ignore.
    if (rect.w < 10 || rect.h < 10) {
      setRect(null);
      return;
    }
    setStatus({ kind: 'capturing' });
    try {
      const blob = await captureCropBlob(containerRef.current, rect);
      if (!blob) {
        setStatus({ kind: 'error', message: 'capture produced no image' });
        return;
      }
      const att = await uploadChatImage(slug, blob, 'crop');
      addPending(slug, att);
      setStatus({ kind: 'success' });
      // Flash the success badge briefly so the user sees the crop landed,
      // THEN deactivate. The thumb is already visible in the chat input
      // pending-strip by this point.
      setTimeout(() => onDeactivate(), 700);
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message || 'capture failed' });
      // eslint-disable-next-line no-console
      console.error('[crop] capture failed', err);
    } finally {
      setRect(null);
    }
  };

  return (
    <div
      className="crop-overlay"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        onDeactivate();
      }}
    >
      <div
        className={`crop-overlay-hint ${
          status.kind === 'success' ? 'is-success' : status.kind === 'error' ? 'is-error' : ''
        }`}
      >
        {status.kind === 'capturing' && 'Capturing…'}
        {status.kind === 'success' && 'Added to chat ✓'}
        {status.kind === 'error' && `Crop failed: ${status.message}`}
        {status.kind === 'idle' && 'Drag to crop · Esc to cancel'}
      </div>
      {rect && (
        <div
          className="crop-overlay-rect"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
          }}
        />
      )}
    </div>
  );
};

/**
 * Capture a crop of the Remotion player's current frame as a PNG Blob.
 *
 * Strategy: `@remotion/player` renders compositions as plain React DOM
 * (`<div>`, `<img>`, `<video>` via OffthreadVideo), NOT a `<canvas>`. So
 * we use `html-to-image` (DOM → SVG foreignObject → rasterise) to snapshot
 * the entire player container, then crop the result on a fresh canvas to
 * the user's selection rect.
 *
 * `<video>` caveat: html-to-image cannot read frames out of an HTMLVideoElement
 * (browsers refuse without explicit user gesture + same-origin). The Manim
 * mp4s served via `/static/<slug>/...` ARE same-origin, but the video frame
 * still doesn't survive SVG serialisation. As a fallback we walk any
 * `<video>` inside the crop and `drawImage` their current frame on top of
 * the snapshot before the crop step — that covers ManimClip beats. For
 * `<img>` (paper pages, diagrams, asset images) and DOM (equation cards,
 * captions, title cards) html-to-image works directly.
 */
async function captureCropBlob(
  container: HTMLDivElement | null,
  cssRect: Rect,
): Promise<Blob | null> {
  if (!container) return null;
  const containerRect = container.getBoundingClientRect();
  const cssWidth = containerRect.width;
  const cssHeight = containerRect.height;
  if (cssWidth < 1 || cssHeight < 1) return null;

  // Capture at devicePixelRatio so the crop ships full resolution to the agent.
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const dataUrl = await toPng(container, {
    cacheBust: true,
    pixelRatio: dpr,
    skipFonts: false,
    // html-to-image will skip cross-origin assets that taint the canvas; ours
    // are same-origin (served via Vite proxy → editor-server /static/).
  });

  // Load the captured PNG so we can crop + composite video frames.
  const baseImg = await loadImage(dataUrl);
  const baseW = baseImg.naturalWidth;
  const baseH = baseImg.naturalHeight;

  // Sometimes html-to-image inflates dimensions slightly past pixelRatio*css.
  // Use the actual baseW / cssWidth ratio as the source-of-truth scale.
  const sx = baseW / cssWidth;
  const sy = baseH / cssHeight;
  const cx = Math.max(0, Math.round(cssRect.x * sx));
  const cy = Math.max(0, Math.round(cssRect.y * sy));
  const cw = Math.max(1, Math.round(cssRect.w * sx));
  const ch = Math.max(1, Math.round(cssRect.h * sy));

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(baseImg, cx, cy, cw, ch, 0, 0, cw, ch);

  // Composite any <video> frames sitting under the crop rect. Without this,
  // ManimClip moments would land in the chat as a blank panel.
  for (const v of Array.from(container.querySelectorAll('video'))) {
    if (v.readyState < 2 || v.videoWidth === 0 || v.videoHeight === 0) continue;
    const vr = v.getBoundingClientRect();
    // Video position relative to container in CSS pixels.
    const vx = vr.left - containerRect.left;
    const vy = vr.top - containerRect.top;
    const vw = vr.width;
    const vh = vr.height;
    // Intersection with crop rect (CSS pixels).
    const ix0 = Math.max(cssRect.x, vx);
    const iy0 = Math.max(cssRect.y, vy);
    const ix1 = Math.min(cssRect.x + cssRect.w, vx + vw);
    const iy1 = Math.min(cssRect.y + cssRect.h, vy + vh);
    if (ix1 <= ix0 || iy1 <= iy0) continue;
    // Source rect on the video itself (native video pixels).
    const vsx = v.videoWidth / vw;
    const vsy = v.videoHeight / vh;
    const ssx = (ix0 - vx) * vsx;
    const ssy = (iy0 - vy) * vsy;
    const ssw = (ix1 - ix0) * vsx;
    const ssh = (iy1 - iy0) * vsy;
    // Destination rect on the output canvas (output is the cropped image,
    // origin at cssRect.x, cssRect.y; scale by sx/sy).
    const dx = (ix0 - cssRect.x) * sx;
    const dy = (iy0 - cssRect.y) * sy;
    const dw = (ix1 - ix0) * sx;
    const dh = (iy1 - iy0) * sy;
    try {
      ctx.drawImage(v, ssx, ssy, ssw, ssh, dx, dy, dw, dh);
    } catch {
      // CORS taint or other capture failure — leave the html-to-image
      // placeholder underneath; better than nothing.
    }
  }

  return new Promise<Blob | null>((resolve) => {
    out.toBlob((b) => resolve(b), 'image/png');
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load captured image'));
    img.src = src;
  });
}
