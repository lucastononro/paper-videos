import React from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { PaperExplainerCore } from '@composition/compositions/PaperExplainerCore';
import { type FullPreviewData, staticAssetBaseUrl } from '../api';

/**
 * Mounts `PaperExplainerCore` directly with pre-fetched data + an explicit
 * assetBaseUrl. No `staticFile()` indirection, no `window.remotion_staticBase`
 * global — eliminating the silent black-frame failure mode of the previous
 * implementation (where the composition's manifest fetch would 404 against
 * Vite's root and `delayRender` would never resolve).
 */
export const PlayerPanel: React.FC<{
  slug: string;
  data: FullPreviewData;
  playerRef?: React.MutableRefObject<PlayerRef | null>;
}> = ({ slug, data, playerRef }) => {
  const { manifest } = data;
  const baseUrl = staticAssetBaseUrl(slug);

  // The manifest can exist but be empty — typical right after `/paper-video new`
  // before the storyteller / producer / visualizer have done anything. Render
  // a friendly placeholder; mounting <Player> with `durationInFrames=0` (or
  // NaN) crashes Remotion.
  const empty =
    !Number.isFinite(manifest.totalFrames) ||
    manifest.totalFrames < 1 ||
    manifest.voice.length === 0;
  if (empty) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--bg)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            border: '1px dashed var(--border)',
            borderRadius: 12,
            padding: '20px 22px',
            color: 'var(--text-mute)',
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Project scaffolded — no script yet
          </div>
          <div>
            <code>{manifest.paperTitle || slug}</code> is set up at <code>videos/{slug}/</code>,
            but the storyteller hasn't written <code>script.md</code> yet (so there are no voice
            beats or visual blocks to play).
          </div>
          <div style={{ marginTop: 10 }}>
            Tell claude to write the script (e.g. <em>"run /paper-video script {slug}"</em>) and the
            player will materialize as soon as the manifest is filled.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '100%',
            aspectRatio: `${manifest.resolution.width} / ${manifest.resolution.height}`,
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#000',
          }}
        >
          <Player
            ref={playerRef}
            component={PaperExplainerCore}
            inputProps={{
              manifest,
              equations: data.equations,
              assets: data.assets,
              manimDurations: data.manimDurations,
              manimLastFrames: data.manimLastFrames,
              assetBaseUrl: baseUrl,
            }}
            durationInFrames={Math.max(1, manifest.totalFrames)}
            compositionWidth={manifest.resolution.width}
            compositionHeight={manifest.resolution.height}
            fps={manifest.fps}
            controls
            clickToPlay
            doubleClickToFullscreen
            spaceKeyToPlayOrPause
            style={{ width: '100%', height: '100%' }}
            acknowledgeRemotionLicense
          />
        </div>
      </div>
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--text-mute)',
          display: 'flex',
          gap: 24,
        }}
      >
        <span>{manifest.paperTitle}</span>
        <span>
          {manifest.voice.length} voice beats · {manifest.visualBlocks.length} visual blocks ·{' '}
          {(manifest.totalFrames / manifest.fps).toFixed(1)}s @ {manifest.fps}fps
        </span>
      </div>
    </div>
  );
};
