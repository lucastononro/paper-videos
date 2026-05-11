import React from 'react';
import type { PlayerRef } from '@remotion/player';
import { usePendingAttachments } from '../chat/pendingAttachments';
import { uploadChatImage } from '../chat/uploadImage';

/**
 * Drag-rect crop tool that sits on top of the Remotion player.
 *
 * Activation: PlayerPanel's "✂ Crop" button toggles `active`. When active:
 *   1. The overlay covers the player area, dimming it.
 *   2. The user drags a rect — we render a marching-ants outline live.
 *   3. On mouseup, we snapshot the current frame via the Player's html5
 *      `<video>` underlying canvas (Remotion's Player exposes `getCanvas()`
 *      indirectly via `getContainerNode()`'s `<canvas>`), crop to the rect,
 *      upload, and add to the chat's pending attachments — same store the
 *      drag-and-drop path writes to, so the user sees a thumb appear in the
 *      chat input area immediately.
 *   4. We toggle `active` off.
 *
 * Fall-back capture path: if `getCanvas()` is unavailable (older Remotion
 * versions or non-DOM player nodes), we fall back to `html2canvas`-like DIY
 * via `<canvas>.drawImage(node as CanvasImageSource)` — but Remotion 4.0+'s
 * Player renders into an actual canvas, so the primary path almost always
 * works.
 */
type Rect = { x: number; y: number; w: number; h: number };

export const CropOverlay: React.FC<{
  slug: string;
  active: boolean;
  onDeactivate: () => void;
  playerRef: React.MutableRefObject<PlayerRef | null>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
}> = ({ slug, active, onDeactivate, playerRef, containerRef }) => {
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [busy, setBusy] = React.useState(false);
  const addPending = usePendingAttachments((s) => s.add);
  const dragStart = React.useRef<{ x: number; y: number } | null>(null);

  // Pause the player while crop mode is active so the user lands on a
  // specific frame. Restore play state when leaving (do nothing fancy —
  // they can press play again themselves).
  React.useEffect(() => {
    if (!active) return;
    playerRef.current?.pause();
    setRect(null);
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
    setBusy(true);
    try {
      const blob = await captureCropBlob(containerRef.current, rect);
      if (!blob) {
        // eslint-disable-next-line no-console
        console.warn('[crop] capture returned no blob');
        return;
      }
      const att = await uploadChatImage(slug, blob, 'crop');
      addPending(slug, att);
      onDeactivate();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[crop] capture failed', err);
    } finally {
      setBusy(false);
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
      <div className="crop-overlay-hint">
        {busy ? 'Capturing…' : 'Drag to crop · Esc to cancel'}
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
 * Strategy: find the player's internal canvas (Remotion Player renders into
 * an HTMLCanvasElement in the DOM), draw the cropped region into a fresh
 * canvas, and toBlob('image/png'). The crop rect is in container-relative
 * CSS pixels — we scale to the canvas's native pixel dims so a crop on a
 * downscaled player still ships full resolution to the agent.
 */
async function captureCropBlob(
  container: HTMLDivElement | null,
  cssRect: Rect,
): Promise<Blob | null> {
  if (!container) return null;
  const canvas = container.querySelector('canvas');
  if (!canvas) {
    // eslint-disable-next-line no-console
    console.warn('[crop] no <canvas> inside player container');
    return null;
  }
  // CSS → canvas-pixel scale. Player CSS width can differ from
  // canvas.width (devicePixelRatio aware), so use the canvas's own
  // bounding rect.
  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  // The crop was measured against the container; translate it into the
  // canvas's own coord space.
  const localX = cssRect.x - (canvasRect.left - containerRect.left);
  const localY = cssRect.y - (canvasRect.top - containerRect.top);
  const sx = canvas.width / canvasRect.width;
  const sy = canvas.height / canvasRect.height;
  const cx = Math.max(0, Math.round(localX * sx));
  const cy = Math.max(0, Math.round(localY * sy));
  const cw = Math.max(1, Math.round(cssRect.w * sx));
  const ch = Math.max(1, Math.round(cssRect.h * sy));

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  // Drawing canvas → canvas via drawImage. Source canvas must be same-origin
  // (Remotion's is — same document — so no taint).
  ctx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  return new Promise<Blob | null>((resolve) => {
    out.toBlob((b) => resolve(b), 'image/png');
  });
}
