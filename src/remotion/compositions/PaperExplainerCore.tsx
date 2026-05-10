import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  useCurrentFrame,
  interpolate,
} from 'remotion';

// Fade-in / fade-out edges for every visual block, so transitions feel like
// "erasing and starting a new page" instead of jump-cutting. Both edges fade
// through the dark-navy bg, giving a brief breath at every block boundary.
// Tuned to ~0.27s in / ~0.30s out at 30 fps.
const BLOCK_FADE_IN_FRAMES = 8;
const BLOCK_FADE_OUT_FRAMES = 9;

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
      quote?: string;
      highlightBBox?: BBox;
      zoom?: boolean;
    }
  | { kind: 'highlightedQuote'; pageIdx: number; text: string; bbox?: BBox }
  | { kind: 'equationCard'; equationId: string; reveal: 'stepwise' | 'all' }
  | { kind: 'equationStep'; equationId: string; step: number }
  | { kind: 'image'; assetId: string }
  | { kind: 'diagram'; assetId: string }
  | { kind: 'manimClip'; sceneFile: string; mp4: string; clipDurationFrames?: number }
  | { kind: 'pause' };

export type VoiceBeat = {
  id: string;
  startFrame: number;
  durationFrames: number;
  audioFile: string | null;
  timestampsFile: string | null;
  text?: string;
};

export type VisualBlock = {
  id: string;
  startFrame: number;
  durationFrames: number;
  description: string;
  visual: Visual;
};

export type ManifestForCore = {
  slug: string;
  paperTitle: string;
  fps: number;
  resolution: { width: number; height: number };
  schemaVersion?: 2;
  voice: VoiceBeat[];
  visualBlocks: VisualBlock[];
  captions?: boolean;
};

export type Equations = Array<{
  id: string;
  latex: string;
  display: 'inline' | 'block';
  context: string;
}>;

export type AssetsIndex = Record<string, { kind: 'image' | 'diagram'; file: string }>;
export type ManimDurations = Record<string, number>;
export type ManimLastFrames = Record<string, string>;

export type PaperExplainerCoreProps = {
  manifest: ManifestForCore;
  equations: Equations;
  assets: AssetsIndex;
  manimDurations: ManimDurations;
  manimLastFrames: ManimLastFrames;
  /**
   * URL prefix for every asset reference. Empty string ("") for offline
   * Remotion render (staticFile resolves at the bundle root). For the editor's
   * @remotion/player this is "/static/<slug>/" and the editor server serves
   * `videos/<slug>/public/` at that path.
   */
  assetBaseUrl: string;
};

/**
 * Pure composition. All asset URLs are constructed from `assetBaseUrl + path`,
 * eliminating the dependency on Remotion's `staticFile()` global resolver.
 * That lets the editor's `@remotion/player` mount this component directly with
 * pre-fetched JSON in `inputProps` — no `window.remotion_staticBase`
 * side-channel, no silent black-frame failures.
 *
 * Offline render uses the thin wrapper `PaperExplainer.tsx`, which fetches the
 * JSONs via `staticFile()` and forwards them here with `assetBaseUrl=""`.
 */
export const PaperExplainerCore: React.FC<PaperExplainerCoreProps> = ({
  manifest,
  equations,
  assets,
  manimDurations,
  manimLastFrames,
  assetBaseUrl,
}) => {
  const eqMap = React.useMemo(
    () => new Map(equations.map((e) => [e.id, e])),
    [equations],
  );
  const resolve = React.useCallback(
    (rel: string) => `${assetBaseUrl}${rel}`,
    [assetBaseUrl],
  );

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
          <BlockFade durationFrames={block.durationFrames}>
            <VisualForBlock
              block={block}
              eqMap={eqMap}
              assets={assets}
              manimDurations={manimDurations}
              manimLastFrames={manimLastFrames}
              resolve={resolve}
            />
          </BlockFade>
        </Sequence>
      ))}
      {/* Voice + caption layer. Captions are opt-in per video — see the
          `captions` flag on the manifest, set at /paper-video new time. */}
      {manifest.voice.map((beat) => (
        <Sequence
          key={beat.id}
          from={beat.startFrame}
          durationInFrames={beat.durationFrames}
          name={beat.id}
          layout="none"
        >
          {beat.audioFile && <Narration audioSrc={resolve(beat.audioFile)} />}
          {manifest.captions && beat.timestampsFile && (
            <CaptionBar timestampsSrc={resolve(beat.timestampsFile)} />
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
  resolve: (rel: string) => string;
}> = ({ block, eqMap, assets, manimDurations, manimLastFrames, resolve }) => {
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
          <ManimClip src={resolve(mp4)} />
        </Sequence>
        {holdFrames > 0 && lastFrameSrc && (
          <Sequence from={playFrames} durationInFrames={holdFrames} layout="none">
            <AbsoluteFill style={{ backgroundColor: '#0e1117' }}>
              <Img
                src={resolve(lastFrameSrc)}
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
          src={resolve(`pages/page-${String(v.pageIdx + 1).padStart(3, '0')}.png`)}
          focus={v.focus}
          durationFrames={block.durationFrames}
          highlightBBox={v.highlightBBox}
          zoom={v.zoom}
        />
      );
    case 'highlightedQuote':
      return (
        <HighlightedQuote
          pageSrc={resolve(`pages/page-${String(v.pageIdx + 1).padStart(3, '0')}.png`)}
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
      return <AssetImage src={resolve(asset.file)} durationFrames={block.durationFrames} />;
    }
    case 'pause':
      return <PauseBeat />;
    default:
      return null;
  }
};

// Soft fade at every visual block's edges. Block content emerges from the
// dark-navy bg over BLOCK_FADE_IN_FRAMES, sits at full opacity, then dissolves
// back to bg over BLOCK_FADE_OUT_FRAMES. The opaque dark-navy AbsoluteFill
// underneath every block guarantees the "blink" between blocks reads as
// erasing/rewriting on a single canvas, not cutting to a new scene.
const BlockFade: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();
  const fadeIn = Math.min(BLOCK_FADE_IN_FRAMES, Math.floor(durationFrames / 4));
  const fadeOut = Math.min(BLOCK_FADE_OUT_FRAMES, Math.floor(durationFrames / 4));
  const fadeOutStart = Math.max(durationFrames - fadeOut, fadeIn);
  const opacity = interpolate(
    frame,
    [0, fadeIn, fadeOutStart, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
