import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * Generic image / diagram beat. Centers the asset on the dark canvas with a
 * gentle fade-in and subtle scale.
 */
export const AssetImage: React.FC<{ src: string; durationFrames: number }> = ({
  src,
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const t = interpolate(frame, [0, durationFrames], [0, 1], { extrapolateRight: 'clamp' });
  const scale = 1.0 + 0.02 * t;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0e1117',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
      }}
    >
      <Img
        src={src}
        style={{
          maxWidth: '88%',
          maxHeight: '85%',
          objectFit: 'contain',
          opacity,
          transform: `scale(${scale})`,
          borderRadius: 8,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        }}
      />
    </AbsoluteFill>
  );
};
