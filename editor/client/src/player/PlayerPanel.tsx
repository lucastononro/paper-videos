import React from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { PaperExplainerCore } from '@composition/compositions/PaperExplainerCore';
import { type FullPreviewData, staticAssetBaseUrl } from '../api';
import { CropOverlay } from './CropOverlay';
import './player.css';

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
  /** Cache-bust suffix forwarded to PaperExplainerCore so regenerated assets
   *  (same filename, new bytes) defeat the browser cache. The editor passes
   *  its `reloadTick` here. */
  cacheBustKey?: string | number;
}> = ({ slug, data, playerRef, cacheBustKey }) => {
  const { manifest } = data;
  const baseUrl = staticAssetBaseUrl(slug);
  // Persist the user's chosen speed across mounts (per-tab, not per-slug —
  // someone who likes 2× tends to like it everywhere).
  const [playbackRate, setPlaybackRate] = React.useState<number>(() => {
    const v = Number(sessionStorage.getItem('paper-videos:playbackRate'));
    return Number.isFinite(v) && v > 0 ? v : 1;
  });
  const updatePlaybackRate = React.useCallback((rate: number) => {
    setPlaybackRate(rate);
    sessionStorage.setItem('paper-videos:playbackRate', String(rate));
  }, []);
  // Internal playerRef so the crop button can pause and the overlay can
  // capture even if the caller didn't pass one in.
  const internalPlayerRef = React.useRef<PlayerRef | null>(null);
  const resolvedPlayerRef = playerRef ?? internalPlayerRef;
  const playerContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [cropActive, setCropActive] = React.useState(false);

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
            <code>{manifest.paperTitle || slug}</code> is set up at <code>videos/{slug}/</code>, but
            the storyteller hasn't written <code>script.md</code> yet (so there are no voice beats
            or visual blocks to play).
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
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}
    >
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
          ref={playerContainerRef}
          style={{
            // `width: 100%` + `maxHeight: 100%` + `aspect-ratio` lets the
            // browser shrink in either direction to satisfy both bounds while
            // keeping the 16:9 frame intact — no more controls bleeding under
            // the filmstrip when the right column is short.
            position: 'relative',
            width: '100%',
            height: 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: `${manifest.resolution.width} / ${manifest.resolution.height}`,
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#000',
          }}
        >
          <Player
            ref={resolvedPlayerRef}
            component={PaperExplainerCore}
            inputProps={{
              manifest,
              equations: data.equations,
              assets: data.assets,
              manimDurations: data.manimDurations,
              manimLastFrames: data.manimLastFrames,
              assetBaseUrl: baseUrl,
              cacheBustKey,
            }}
            durationInFrames={Math.max(1, manifest.totalFrames)}
            compositionWidth={manifest.resolution.width}
            compositionHeight={manifest.resolution.height}
            fps={manifest.fps}
            playbackRate={playbackRate}
            controls
            clickToPlay
            doubleClickToFullscreen
            // Disable global key shortcuts — Remotion attaches them to
            // `document`, so spacebar / arrows would intercept anything you
            // type in the chat textarea (skipping the message, scrubbing
            // frames, etc.). Click the play/pause button in the controls
            // instead. Speed shortcuts ([ and ]) handled below scoped to
            // the player wrapper.
            spaceKeyToPlayOrPause={false}
            style={{ width: '100%', height: '100%' }}
            acknowledgeRemotionLicense
          />
          <CropOverlay
            slug={slug}
            active={cropActive}
            onDeactivate={() => setCropActive(false)}
            playerRef={resolvedPlayerRef}
            containerRef={playerContainerRef}
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
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span>{manifest.paperTitle}</span>
        <span>
          {manifest.voice.length} voice beats · {manifest.visualBlocks.length} visual blocks ·{' '}
          {(manifest.totalFrames / manifest.fps).toFixed(1)}s @ {manifest.fps}fps
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className={`player-crop-btn ${cropActive ? 'is-active' : ''}`}
          onClick={() => setCropActive((v) => !v)}
          title="Crop a region of the current frame and attach it to the chat"
        >
          ✂ {cropActive ? 'Cancel crop' : 'Crop to chat'}
        </button>
        <SpeedControl rate={playbackRate} onChange={updatePlaybackRate} />
      </div>
    </div>
  );
};

/**
 * Compact speed picker — five preset rates that cover the useful range:
 *   0.5× for studying, 1× normal, 1.5× / 2× / 4× to scrub through.
 * The active rate gets the gold pill; sessionStorage persistence is in the
 * parent so the choice survives reload-tick remounts.
 */
const SpeedControl: React.FC<{ rate: number; onChange: (r: number) => void }> = ({
  rate,
  onChange,
}) => {
  const presets = [0.5, 1, 1.5, 2, 4];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px 2px 8px',
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--bg)',
      }}
      title="Playback speed"
    >
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-mute)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        speed
      </span>
      {presets.map((r) => {
        const active = Math.abs(r - rate) < 0.001;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontWeight: active ? 700 : 500,
              color: active ? '#0e1117' : 'var(--text-mute)',
              background: active ? '#ffd866' : 'transparent',
            }}
          >
            {r}×
          </button>
        );
      })}
    </div>
  );
};
