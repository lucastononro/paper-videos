import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';

export const TitleCard: React.FC<{ text: string; subtitle?: string }> = ({ text, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const scale = spring({ frame, fps, config: { damping: 18, stiffness: 120, mass: 0.5 } });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 24,
        textAlign: 'center',
        padding: 64,
        opacity,
      }}
    >
      <div
        style={{
          color: '#e6edf3',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          fontWeight: 700,
          fontSize: 96,
          letterSpacing: -1,
          transform: `scale(${0.92 + scale * 0.08})`,
        }}
      >
        {text}
      </div>
      {subtitle && (
        <div
          style={{
            color: '#8b949e',
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            fontWeight: 400,
            fontSize: 36,
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};
