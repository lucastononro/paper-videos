import React from 'react';
import { AbsoluteFill, Img } from 'remotion';

type Focus = 'top' | 'center' | 'bottom' | 'all';
type BBox = { x: number; y: number; w: number; h: number };

/**
 * Static paper page. Shows the full page; if `highlightBBox` is provided,
 * dims everything outside the bbox and draws a solid border around it.
 *
 * BBox uses normalized coordinates in [0, 1] of the page image:
 *   x, y   = top-left corner (0,0 = top-left of the page)
 *   w, h   = width, height as fraction of the page
 *
 * No zoom-over-time, no pan-over-time, no pulse. The page is meant to read
 * like a printed reference, not a Ken-Burns sequence.
 */
export const PaperPage: React.FC<{
  src: string;
  focus: Focus;
  durationFrames: number;
  highlightBBox?: BBox;
}> = ({ src, highlightBBox }) => {
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
            height: '92%',
            aspectRatio: '8.5 / 11',
            overflow: 'hidden',
            borderRadius: 8,
            boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
            backgroundColor: '#ffffff',
          }}
        >
          <Img
            src={src}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />

          {highlightBBox && <HighlightOverlay bbox={highlightBBox} />}
        </div>
      </div>
    </AbsoluteFill>
  );
};

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
