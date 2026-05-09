import React from 'react';
import { AbsoluteFill, OffthreadVideo } from 'remotion';

/**
 * Plays a Manim-rendered mp4. Uses OffthreadVideo (Rust-decoded) for stable
 * deterministic frame extraction during render.
 */
export const ManimClip: React.FC<{ src: string }> = ({ src }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0e1117' }}>
      <OffthreadVideo
        src={src}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </AbsoluteFill>
  );
};
