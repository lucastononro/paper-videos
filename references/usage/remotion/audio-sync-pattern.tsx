/**
 * Canonical audio-sync pattern for paper-videos.
 *
 * Don't edit this file as part of a video build. Read it. Then apply the same
 * pattern when you write or change `src/remotion/compositions/PaperExplainer.tsx`.
 *
 * Rules:
 *   1. One <Sequence> per script segment.
 *   2. Sequence's durationInFrames = ceil(segment_audio_duration_seconds * fps).
 *   3. Inside the Sequence: <Audio> + visual + <CaptionBar timestampsSrc=...>.
 *   4. startFrame of segment N = sum of durationFrames of segments 0..N-1.
 *
 * The composition's outer durationInFrames = sum of all segment durations.
 */

import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';

type Segment = {
  id: string;
  startFrame: number;
  durationFrames: number;
  audioFile: string;
  timestampsFile: string;
};

const ExampleVisual: React.FC = () => <AbsoluteFill style={{ backgroundColor: '#0e1117' }} />;

const ExampleCaptionBar: React.FC<{ timestampsSrc: string }> = () => null;

export const AudioSyncExample: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0e1117' }}>
      {segments.map((seg) => (
        <Sequence key={seg.id} from={seg.startFrame} durationInFrames={seg.durationFrames}>
          <ExampleVisual />
          <Audio src={staticFile(seg.audioFile)} />
          <ExampleCaptionBar timestampsSrc={staticFile(seg.timestampsFile)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
