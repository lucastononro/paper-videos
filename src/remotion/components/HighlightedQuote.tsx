import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';

type BBox = { x: number; y: number; w: number; h: number };

/**
 * Paper page on the left, the quote pulled out to the right with a fade-in.
 *
 * If a `bbox` is provided, the page-side image dims everything except the
 * bbox region and draws a glowing border there — so the viewer's eye
 * sees the source of the quote AND the pulled-out text simultaneously.
 *
 * BBox is in normalized coordinates [0,1] of the page image. See PaperPage.tsx
 * for the convention.
 */
export const HighlightedQuote: React.FC<{
  pageSrc: string;
  quote: string;
  bbox?: BBox;
}> = ({ pageSrc, quote, bbox }) => {
  const frame = useCurrentFrame();
  const quoteOpacity = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: 'clamp' });
  const dimOpacity = bbox ? interpolate(frame, [4, 18], [0, 0.62], { extrapolateRight: 'clamp' }) : 0;
  const glow = 0.6 + 0.4 * Math.sin(frame / 16);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0e1117',
        flexDirection: 'row',
        padding: 48,
        gap: 32,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          flex: 1,
          height: '90%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Page wrapper sized to the image's intrinsic aspect — bbox %s map
            1:1 onto image pixels. Previously this used objectFit:cover which
            cropped the image and made every bbox doubly wrong. */}
        <div
          style={{
            position: 'relative',
            height: '100%',
            display: 'inline-block',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
            backgroundColor: '#ffffff',
          }}
        >
        <Img
          src={pageSrc}
          style={{ display: 'block', height: '100%', width: 'auto', maxWidth: '100%' }}
        />

        {bbox && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `
                  linear-gradient(to right,
                    rgba(13,17,23,${dimOpacity}) 0%,
                    rgba(13,17,23,${dimOpacity}) ${bbox.x * 100}%,
                    transparent ${bbox.x * 100}%,
                    transparent ${(bbox.x + bbox.w) * 100}%,
                    rgba(13,17,23,${dimOpacity}) ${(bbox.x + bbox.w) * 100}%,
                    rgba(13,17,23,${dimOpacity}) 100%
                  )
                `,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `${bbox.x * 100}%`,
                width: `${bbox.w * 100}%`,
                top: 0,
                height: `${bbox.y * 100}%`,
                backgroundColor: `rgba(13,17,23,${dimOpacity})`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `${bbox.x * 100}%`,
                width: `${bbox.w * 100}%`,
                top: `${(bbox.y + bbox.h) * 100}%`,
                bottom: 0,
                backgroundColor: `rgba(13,17,23,${dimOpacity})`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `${bbox.x * 100}%`,
                top: `${bbox.y * 100}%`,
                width: `${bbox.w * 100}%`,
                height: `${bbox.h * 100}%`,
                border: `3px solid rgba(255, 216, 102, ${glow})`,
                borderRadius: 6,
                boxShadow: `0 0 ${24 * glow}px rgba(255, 216, 102, ${glow * 0.7})`,
                pointerEvents: 'none',
              }}
            />
          </>
        )}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          color: '#e6edf3',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 44,
          lineHeight: 1.35,
          fontWeight: 500,
          opacity: quoteOpacity,
          padding: 32,
          borderLeft: '4px solid #58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.06)',
          borderRadius: 8,
        }}
      >
        “{quote}”
      </div>
    </AbsoluteFill>
  );
};
