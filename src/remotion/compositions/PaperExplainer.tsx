import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useVideoConfig,
  delayRender,
  continueRender,
} from 'remotion';
import { TitleCard } from '../components/TitleCard';
import { PaperPage } from '../components/PaperPage';
import { HighlightedQuote } from '../components/HighlightedQuote';
import { EquationCard } from '../components/EquationCard';
import { ManimClip } from '../components/ManimClip';
import { Narration } from '../components/Narration';
import { CaptionBar } from '../components/CaptionBar';
import { PauseBeat } from '../components/PauseBeat';
import { AssetImage } from '../components/AssetImage';

type BBox = { x: number; y: number; w: number; h: number };

type Visual =
  | { kind: 'titleCard'; text: string; subtitle?: string }
  | {
      kind: 'paperPage';
      pageIdx: number;
      focus: 'top' | 'center' | 'bottom' | 'all';
      highlightBBox?: BBox;
    }
  | { kind: 'highlightedQuote'; pageIdx: number; text: string; bbox?: BBox }
  | { kind: 'equationCard'; equationId: string; reveal: 'stepwise' | 'all' }
  | { kind: 'equationStep'; equationId: string; step: number }
  | { kind: 'image'; assetId: string }
  | { kind: 'diagram'; assetId: string }
  | { kind: 'manimClip'; sceneFile: string; mp4: string; clipDurationFrames?: number }
  | { kind: 'pause' };

type ManifestSegment = {
  id: string;
  startFrame: number;
  durationFrames: number;
  audioFile: string | null;
  timestampsFile: string | null;
  visual: Visual;
};

type VoiceBeat = {
  id: string;
  startFrame: number;
  durationFrames: number;
  audioFile: string | null;
  timestampsFile: string | null;
  text?: string;
};

type VisualBlock = {
  id: string;
  startFrame: number;
  durationFrames: number;
  description: string;
  visual: Visual;
};

type Manifest = {
  slug: string;
  paperTitle: string;
  fps: number;
  resolution: { width: number; height: number };
  schemaVersion?: 2;
  segments: ManifestSegment[];
  voice: VoiceBeat[];
  visualBlocks: VisualBlock[];
};

type Equations = Array<{
  id: string;
  latex: string;
  display: 'inline' | 'block';
  context: string;
}>;

type AssetsIndex = Record<string, { kind: 'image' | 'diagram'; file: string }>;
type ManimDurations = Record<string, number>;
type ManimLastFrames = Record<string, string>;

export const PaperExplainer: React.FC<{ slug: string }> = () => {
  const [handle] = React.useState(() => delayRender('Loading manifest'));
  const [data, setData] = React.useState<{
    manifest: Manifest;
    equations: Equations;
    assets: AssetsIndex;
    manimDurations: ManimDurations;
    manimLastFrames: ManimLastFrames;
  } | null>(null);

  React.useEffect(() => {
    (async () => {
      const [m, e, a, d, lf] = await Promise.all([
        fetch(staticFile('manifest.json')).then((r) => r.json()),
        fetch(staticFile('equations.json'))
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(staticFile('assets-index.json'))
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({})),
        fetch(staticFile('manim-durations.json'))
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({})),
        fetch(staticFile('manim-last-frames.json'))
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({})),
      ]);
      setData({
        manifest: m as Manifest,
        equations: e as Equations,
        assets: a as AssetsIndex,
        manimDurations: d as ManimDurations,
        manimLastFrames: lf as ManimLastFrames,
      });
      continueRender(handle);
    })();
  }, [handle]);

  if (!data) return null;
  const { manifest, equations, assets, manimDurations, manimLastFrames } = data;
  const eqMap = new Map(equations.map((e) => [e.id, e]));

  // Two independent timelines:
  //   - visualBlocks: what's on screen at each frame range (M:N to voice).
  //   - voice: per-beat narration + captions, may span 1..N visualBlocks.
  return (
    <AbsoluteFill style={{ backgroundColor: '#0e1117' }}>
      {/* Visual layer */}
      {manifest.visualBlocks.map((block) => (
        <Sequence
          key={block.id}
          from={block.startFrame}
          durationInFrames={block.durationFrames}
          name={block.id}
        >
          <VisualForBlock
            block={block}
            eqMap={eqMap}
            assets={assets}
            manimDurations={manimDurations}
            manimLastFrames={manimLastFrames}
          />
        </Sequence>
      ))}
      {/* Voice + caption layer */}
      {manifest.voice.map((beat) => (
        <Sequence
          key={beat.id}
          from={beat.startFrame}
          durationInFrames={beat.durationFrames}
          name={beat.id}
          layout="none"
        >
          {beat.audioFile && <Narration audioSrc={staticFile(beat.audioFile)} />}
          {beat.timestampsFile && (
            <CaptionBar timestampsSrc={staticFile(beat.timestampsFile)} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const VisualForBlock: React.FC<{
  block: VisualBlock;
  eqMap: Map<string, Equations[number]>;
  assets: AssetsIndex;
  manimDurations: ManimDurations;
  manimLastFrames: ManimLastFrames;
}> = ({ block, eqMap, assets, manimDurations, manimLastFrames }) => {
  // Manim blocks: play mp4 once, then hold its last frame for the rest of the
  // block. No looping — the visual stays still while the voice continues.
  if (block.visual.kind === 'manimClip') {
    const mp4 = block.visual.mp4;
    const blockFrames = block.durationFrames;
    const mp4Frames = manimDurations[mp4] ?? blockFrames;
    const playFrames = Math.min(mp4Frames, blockFrames);
    const holdFrames = Math.max(0, blockFrames - mp4Frames);
    const lastFrameSrc = manimLastFrames[mp4];

    return (
      <>
        <Sequence from={0} durationInFrames={playFrames} layout="none">
          <ManimClip src={staticFile(mp4)} />
        </Sequence>
        {holdFrames > 0 && lastFrameSrc && (
          <Sequence from={playFrames} durationInFrames={holdFrames} layout="none">
            <AbsoluteFill style={{ backgroundColor: '#0e1117' }}>
              <Img
                src={staticFile(lastFrameSrc)}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </AbsoluteFill>
          </Sequence>
        )}
      </>
    );
  }

  const v = block.visual;
  switch (v.kind) {
    case 'titleCard':
      return <TitleCard text={v.text} subtitle={v.subtitle} />;
    case 'paperPage':
      return (
        <PaperPage
          src={staticFile(`pages/page-${String(v.pageIdx + 1).padStart(3, '0')}.png`)}
          focus={v.focus}
          durationFrames={block.durationFrames}
          highlightBBox={v.highlightBBox}
        />
      );
    case 'highlightedQuote':
      return (
        <HighlightedQuote
          pageSrc={staticFile(`pages/page-${String(v.pageIdx + 1).padStart(3, '0')}.png`)}
          quote={v.text}
          bbox={v.bbox}
        />
      );
    case 'equationCard': {
      const eq = eqMap.get(v.equationId);
      if (!eq) return <TitleCard text={`(missing equation: ${v.equationId})`} />;
      return (
        <EquationCard latex={eq.latex} reveal={v.reveal} durationFrames={block.durationFrames} />
      );
    }
    case 'equationStep': {
      const eq = eqMap.get(v.equationId);
      if (!eq) return <TitleCard text={`(missing equation: ${v.equationId})`} />;
      return (
        <EquationCard latex={eq.latex} reveal="stepwise" durationFrames={block.durationFrames} />
      );
    }
    case 'image':
    case 'diagram': {
      const asset = assets[v.assetId];
      if (!asset) return <TitleCard text={`(missing asset: ${v.assetId})`} />;
      return <AssetImage src={staticFile(asset.file)} durationFrames={block.durationFrames} />;
    }
    case 'pause':
      return <PauseBeat />;
    default:
      return null;
  }
};

