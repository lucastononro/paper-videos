import React from 'react';
import type { PlayerRef } from '@remotion/player';
import type { Manifest, Visual } from '../api';
import { useSelection } from '../selection/selection';

const KIND_COLORS: Record<Visual['kind'], string> = {
  titleCard: '#8b5cf6',
  paperPage: '#fcd34d',
  highlightedQuote: '#facc15',
  equationCard: '#f59e0b',
  equationStep: '#fbbf24',
  image: '#60a5fa',
  diagram: '#34d399',
  manimClip: '#22d3ee',
  pause: '#3a414e',
};

/**
 * Visual-blocks + voice-beats lanes under the filmstrip. Clicking a chip:
 *   - seeks the player to the chip's start
 *   - sets the time-range selection to the chip's [startFrame, startFrame+duration]
 *
 * The latter is what makes "spot-edit on a single beat" still cheap: click
 * a chip in the voice lane → range pre-selected → click ↗ Spot-edit in the
 * filmstrip toolbar. We removed the per-chip spot-edit / pin buttons that
 * encouraged the old beat-id-as-scope workflow; spot-edits are time-crop-
 * driven now (filmstrip drag → range → toolbar action).
 */
export const BeatStrip: React.FC<{
  slug: string;
  manifest: Manifest;
  playerRef?: React.MutableRefObject<PlayerRef | null>;
  onMention: (token: string) => void;
}> = ({ slug: _slug, manifest, playerRef, onMention: _onMention }) => {
  const totalFrames = Math.max(1, manifest.totalFrames);
  const sel = useSelection((s) => s.current);
  const setSel = useSelection((s) => s.set);

  const seekTo = (frame: number) => {
    playerRef?.current?.seekTo(Math.max(0, Math.min(totalFrames - 1, frame)));
  };

  const selectChip = (startFrame: number, durationFrames: number) => {
    seekTo(startFrame);
    setSel({
      kind: 'range',
      startFrame,
      endFrame: Math.min(totalFrames, startFrame + durationFrames),
    });
  };

  // Highlight chip when its frame range matches the current selection — keeps
  // the visual feedback consistent with the filmstrip's gold band above.
  const isChipSelected = (startFrame: number, durationFrames: number): boolean => {
    if (sel?.kind !== 'range') return false;
    return sel.startFrame === startFrame &&
      sel.endFrame === Math.min(totalFrames, startFrame + durationFrames);
  };

  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        borderTop: '1px solid var(--border)',
        padding: '8px 16px 12px 16px',
        userSelect: 'none',
      }}
    >
      <Row label="visual blocks" muted>
        {manifest.visualBlocks.map((block) => (
          <BeatChip
            key={block.id}
            id={block.id}
            startFrame={block.startFrame}
            durationFrames={block.durationFrames}
            totalFrames={totalFrames}
            color={KIND_COLORS[block.visual.kind] ?? 'var(--text-mute)'}
            label={`${block.id} · ${block.visual.kind}`}
            selected={isChipSelected(block.startFrame, block.durationFrames)}
            onClick={() => selectChip(block.startFrame, block.durationFrames)}
          />
        ))}
      </Row>
      <Row label="voice beats">
        {manifest.voice.map((beat) => (
          <BeatChip
            key={beat.id}
            id={beat.id}
            startFrame={beat.startFrame}
            durationFrames={beat.durationFrames}
            totalFrames={totalFrames}
            color={beat.audioFile ? '#7ee787' : '#3a414e'}
            label={`${beat.id}${beat.text ? ` · ${beat.text.slice(0, 60)}` : ''}`}
            selected={isChipSelected(beat.startFrame, beat.durationFrames)}
            onClick={() => selectChip(beat.startFrame, beat.durationFrames)}
          />
        ))}
      </Row>
    </div>
  );
};

const Row: React.FC<{ label: string; muted?: boolean; children: React.ReactNode }> = ({
  label,
  muted,
  children,
}) => (
  <div style={{ marginBottom: 6 }}>
    <div
      style={{
        fontSize: 10,
        color: 'var(--text-mute)',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 3,
        opacity: muted ? 0.85 : 1,
      }}
    >
      {label}
    </div>
    <div
      style={{
        position: 'relative',
        height: 18,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 4,
      }}
    >
      {children}
    </div>
  </div>
);

const BeatChip: React.FC<{
  id: string;
  startFrame: number;
  durationFrames: number;
  totalFrames: number;
  color: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}> = ({ id, startFrame, durationFrames, totalFrames, color, label, selected, onClick }) => {
  const left = (startFrame / totalFrames) * 100;
  const width = (durationFrames / totalFrames) * 100;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} — click to seek + select this range`}
      style={{
        all: 'unset',
        position: 'absolute',
        left: `${left}%`,
        width: `${Math.max(width, 0.4)}%`,
        top: 1,
        bottom: 1,
        background: color,
        opacity: selected ? 1 : 0.55,
        borderRadius: 2,
        cursor: 'pointer',
        outline: selected ? '1px solid var(--accent)' : 'none',
      }}
      data-id={id}
    />
  );
};
