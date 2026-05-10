import React from 'react';
import { AbsoluteFill, Img } from 'remotion';

type Focus = 'top' | 'center' | 'bottom' | 'all';
type BBox = { x: number; y: number; w: number; h: number };

/**
 * Static paper page with optional highlight or zoom-into-bbox.
 *
 * BBox coordinates are normalized [0, 1] of the page IMAGE (not the container):
 *   x, y   = top-left corner of the highlight
 *   w, h   = width, height as fraction of the page
 *
 * Coord-to-pixel discipline:
 *   The container shrinks to the image's intrinsic aspect via `width: auto;
 *   height: 100%` on the <img>. That means the highlight overlay's percentage
 *   coordinates map exactly to image pixels — no letterbox margin, no
 *   `objectFit: cover` cropping. (Earlier revisions hardcoded 8.5/11 aspect
 *   on the container which silently shifted highlights on A4 / non-letter
 *   PDFs by the size of the letterbox bands.)
 *
 * Modes:
 *   - default: full page visible, region outside `highlightBBox` is dimmed,
 *     yellow border around the highlight. Reads like a printed reference.
 *   - zoom: when `zoom=true` and a bbox is provided, the page is scaled and
 *     translated so the bbox region fills the canvas with a small padding,
 *     and a tiny page-mini in the corner shows where on the page we are.
 */
export const PaperPage: React.FC<{
  src: string;
  focus: Focus;
  durationFrames: number;
  highlightBBox?: BBox;
  zoom?: boolean;
}> = ({ src, highlightBBox, zoom }) => {
  if (zoom && highlightBBox) {
    return <ZoomedPaperPage src={src} bbox={highlightBBox} />;
  }
  return (
    <AbsoluteFill style={{ backgroundColor: '#0e1117', padding: 48 }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* The wrapper sizes itself to the image's natural aspect — no
            letterboxing. Bbox % coordinates therefore map 1:1 onto image
            pixels, regardless of whether the PDF is letter, A4, etc. */}
        <div
          style={{
            position: 'relative',
            height: '92%',
            display: 'inline-block',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
            backgroundColor: '#ffffff',
          }}
        >
          <Img
            src={src}
            style={{
              display: 'block',
              height: '100%',
              width: 'auto',
              maxWidth: '100%',
            }}
          />
          {highlightBBox && <HighlightOverlay bbox={highlightBBox} />}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Zoom-into-bbox view. The whole page image is scaled and translated so that
 * `bbox + padding` fills the canvas. A small mini-page in the corner shows
 * the original page with the same bbox marked, so the viewer keeps spatial
 * context.
 */
const ZoomedPaperPage: React.FC<{ src: string; bbox: BBox }> = ({ src, bbox }) => {
  // Pad the bbox by ~3% of the page so the highlighted text doesn't bleed to
  // the canvas edges. Clamp inside the page so we never expose blank space.
  const PAD = 0.03;
  const pX = Math.max(0, bbox.x - PAD);
  const pY = Math.max(0, bbox.y - PAD);
  const pW = Math.min(1 - pX, bbox.w + 2 * PAD);
  const pH = Math.min(1 - pY, bbox.h + 2 * PAD);

  // We want the padded region to fit inside the visible frame (90% of
  // canvas). Compute scale so the longer of (pW * canvasAspect / pageAspect,
  // pH) maps to 90%. Done via CSS: we render the image at a multiple of the
  // viewport then translate to center the padded region.
  // The math: if the page-image fills a 90vh-tall box at aspect = imgW/imgH,
  // and we want pH (fraction) of it to fill 90% of canvas height, scale =
  // 0.9 / pH. Same in width.
  const FILL = 0.9;
  const scaleX = FILL / pW;
  const scaleY = FILL / pH;
  const scale = Math.min(scaleX, scaleY);

  // Center coordinates in [0,1] of the padded region we want at canvas center.
  const cx = pX + pW / 2;
  const cy = pY + pH / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0e1117', padding: 48, overflow: 'hidden' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: '92%',
            display: 'inline-block',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
            backgroundColor: '#ffffff',
            transform: `scale(${scale}) translate(${(0.5 - cx) * 100}%, ${(0.5 - cy) * 100}%)`,
            transformOrigin: '50% 50%',
            willChange: 'transform',
          }}
        >
          <Img
            src={src}
            style={{
              display: 'block',
              height: '100%',
              width: 'auto',
              maxWidth: 'none',
            }}
          />
          <HighlightOverlay bbox={bbox} />
        </div>
      </div>
      {/* Page-mini: tiny preview of the full page with the bbox marked, so
          viewers don't lose track of where the zoom is anchored. */}
      <PageMini src={src} bbox={bbox} />
    </AbsoluteFill>
  );
};

const PageMini: React.FC<{ src: string; bbox: BBox }> = ({ src, bbox }) => (
  <div
    style={{
      position: 'absolute',
      right: 24,
      bottom: 24,
      width: 200,
      borderRadius: 6,
      overflow: 'hidden',
      boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      border: '1px solid rgba(255, 216, 102, 0.35)',
      background: '#ffffff',
    }}
  >
    <div style={{ position: 'relative' }}>
      <Img src={src} style={{ display: 'block', width: '100%', height: 'auto' }} />
      <div
        style={{
          position: 'absolute',
          left: `${bbox.x * 100}%`,
          top: `${bbox.y * 100}%`,
          width: `${bbox.w * 100}%`,
          height: `${bbox.h * 100}%`,
          border: '2px solid rgba(255, 216, 102, 0.95)',
          borderRadius: 2,
          pointerEvents: 'none',
        }}
      />
    </div>
  </div>
);

/**
 * Dim everything except the bbox region; draw a solid yellow border around it.
 * No animation — both the dim and the border are static.
 */
const HighlightOverlay: React.FC<{ bbox: BBox }> = ({ bbox }) => {
  const dim = 0.55;
  const xPct = bbox.x * 100;
  const yPct = bbox.y * 100;
  const wPct = bbox.w * 100;
  const hPct = bbox.h * 100;

  return (
    <>
      {/* top dim strip */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: `${yPct}%`,
          backgroundColor: `rgba(13,17,23,${dim})`,
        }}
      />
      {/* bottom dim strip */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${yPct + hPct}%`,
          bottom: 0,
          backgroundColor: `rgba(13,17,23,${dim})`,
        }}
      />
      {/* left dim strip (only between top+bottom strips) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: `${xPct}%`,
          top: `${yPct}%`,
          height: `${hPct}%`,
          backgroundColor: `rgba(13,17,23,${dim})`,
        }}
      />
      {/* right dim strip */}
      <div
        style={{
          position: 'absolute',
          left: `${xPct + wPct}%`,
          right: 0,
          top: `${yPct}%`,
          height: `${hPct}%`,
          backgroundColor: `rgba(13,17,23,${dim})`,
        }}
      />
      {/* solid border around the highlighted region */}
      <div
        style={{
          position: 'absolute',
          left: `${xPct}%`,
          top: `${yPct}%`,
          width: `${wPct}%`,
          height: `${hPct}%`,
          border: '3px solid rgba(255, 216, 102, 0.95)',
          borderRadius: 4,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
