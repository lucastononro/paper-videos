import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';

type Focus = 'top' | 'center' | 'bottom' | 'all';
type BBox = { x: number; y: number; w: number; h: number };

/**
 * Shows a paper page with a gentle Ken-Burns pan/zoom toward the focus region.
 * If `highlightBBox` is provided, draws a dim overlay everywhere except the
 * bbox + glowing border around it — the eye is pulled to the highlighted text.
 *
 * BBox uses normalized coordinates in [0, 1] of the page image:
 *   x, y   = top-left corner (0,0 = top-left of the page)
 *   w, h   = width, height as fraction of the page
 *
 * Typical bbox shapes:
 *   - one paragraph: ~{x: 0.08, y: 0.18, w: 0.84, h: 0.10}
 *   - a single equation line: ~{x: 0.20, y: 0.42, w: 0.60, h: 0.05}
 *   - the abstract block: ~{x: 0.10, y: 0.16, w: 0.80, h: 0.18}
 */
export const PaperPage: React.FC<{
  src: string;
  focus: Focus;
  durationFrames: number;
  highlightBBox?: BBox;
}> = ({ src, focus, durationFrames, highlightBBox }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, durationFrames], [0, 1], { extrapolateRight: 'clamp' });

  const zoom = focus === 'all' ? 1.0 + 0.04 * t : 1.18 + 0.06 * t;
  const translateY = focusTranslateY(focus, t);

  // Highlight intro animation: dim ramps up over the first ~12 frames, border
  // glow pulses subtly throughout.
  const dimOpacity = highlightBBox ? interpolate(frame, [4, 16], [0, 0.62], { extrapolateRight: 'clamp' }) : 0;
  const borderGlow = 0.65 + 0.35 * Math.sin(frame / 16);

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
        <div
          style={{
            position: 'relative',
            height: '90%',
            aspectRatio: '8.5 / 11',
            overflow: 'hidden',
            borderRadius: 12,
            boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
          }}
        >
          <Img
            src={src}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `translate(-50%, calc(-50% + ${translateY}%)) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          />

          {highlightBBox && (
            <HighlightOverlay bbox={highlightBBox} dim={dimOpacity} glow={borderGlow} />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Renders a "spotlight" effect over the page: dim everything except the bbox
 * region, draw a glowing yellow border around the bbox.
 */
const HighlightOverlay: React.FC<{ bbox: BBox; dim: number; glow: number }> = ({ bbox, dim, glow }) => {
  const xPct = bbox.x * 100;
  const yPct = bbox.y * 100;
  const wPct = bbox.w * 100;
  const hPct = bbox.h * 100;
  return (
    <>
      {/* Dim mask: four rectangles around the bbox */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            linear-gradient(to right,
              rgba(13,17,23,${dim}) 0%,
              rgba(13,17,23,${dim}) ${xPct}%,
              transparent ${xPct}%,
              transparent ${xPct + wPct}%,
              rgba(13,17,23,${dim}) ${xPct + wPct}%,
              rgba(13,17,23,${dim}) 100%
            )
          `,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${xPct}%`,
          right: `${100 - (xPct + wPct)}%`,
          top: 0,
          height: `${yPct}%`,
          backgroundColor: `rgba(13,17,23,${dim})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${xPct}%`,
          right: `${100 - (xPct + wPct)}%`,
          top: `${yPct + hPct}%`,
          bottom: 0,
          backgroundColor: `rgba(13,17,23,${dim})`,
        }}
      />
      {/* Glowing border around the highlighted region */}
      <div
        style={{
          position: 'absolute',
          left: `${xPct}%`,
          top: `${yPct}%`,
          width: `${wPct}%`,
          height: `${hPct}%`,
          border: `3px solid rgba(255, 216, 102, ${glow})`,
          borderRadius: 6,
          boxShadow: `0 0 ${24 * glow}px rgba(255, 216, 102, ${glow * 0.7})`,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};

function focusTranslateY(focus: Focus, t: number): number {
  // Pan slowly from neutral toward the focus region across the segment.
  const target = focus === 'top' ? 18 : focus === 'bottom' ? -18 : 0;
  return target * t;
}
