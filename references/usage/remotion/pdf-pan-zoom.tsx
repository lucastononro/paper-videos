/**
 * Canonical Ken-Burns pattern for the PaperPage component.
 *
 * The actual implementation is in `src/remotion/components/PaperPage.tsx`. This
 * file is a documented reduction of that pattern for reference.
 */

import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';

export const PdfPanZoomExample: React.FC<{
  pageSrc: string;
  durationFrames: number;
  focus: 'top' | 'center' | 'bottom' | 'all';
}> = ({ pageSrc, durationFrames, focus }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, durationFrames], [0, 1], { extrapolateRight: 'clamp' });

  // Zoom in slowly; if focusing on a region, start more zoomed-in.
  const zoom = focus === 'all' ? 1.0 + 0.04 * t : 1.18 + 0.06 * t;
  const targetY = focus === 'top' ? 18 : focus === 'bottom' ? -18 : 0;
  const translateY = targetY * t;

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
          }}
        >
          <Img
            src={pageSrc}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `translate(-50%, calc(-50% + ${translateY}%)) scale(${zoom})`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
