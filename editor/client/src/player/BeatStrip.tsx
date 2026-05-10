import React from 'react';
import type { PlayerRef } from '@remotion/player';
import type { Manifest, Visual } from '../api';
import { useSelection } from '../selection/selection';
import { useThreadStore } from '../threads/store';

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

export const BeatStrip: React.FC<{
  slug: string;
  manifest: Manifest;
  playerRef?: React.MutableRefObject<PlayerRef | null>;
  onMention: (token: string) => void;
}> = ({ slug, manifest, playerRef, onMention }) => {
  const totalFrames = Math.max(1, manifest.totalFrames);
  const sel = useSelection((s) => s.current);
  const setSel = useSelection((s) => s.set);
  const setPanelOpen = useThreadStore((s) => s.setPanelOpen);
  const setDraft = useThreadStore((s) => s.setDraft);

  const seekTo = (frame: number) => {
    playerRef?.current?.seekTo(Math.max(0, Math.min(totalFrames - 1, frame)));
  };

  // Seed a draft thread in the side panel and open it. The actual
  // `thread:create` is sent from the panel's composer when the user types
  // their ask there — never via a window.prompt popup.
  const startSpotEdit = (kind: 'beat' | 'block', id: string) => {
    const scope = kind === 'beat'
      ? { beatIds: [id], blockIds: [] as string[], label: id }
      : { beatIds: [] as string[], blockIds: [id], label: id };
    setDraft(slug, { scope });
    setPanelOpen(slug, true);
  };

  // Detect if a single-beat or single-block selection is active so we can show
  // a "Spot-edit" affordance in the row labels too.
  const selBeatId = sel?.kind === 'beat' ? sel.beatId : null;
  const selBlockId = sel?.kind === 'block' ? sel.blockId : null;

  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        borderTop: '1px solid var(--border)',
        padding: '8px 16px 12px 16px',
        userSelect: 'none',
      }}
    >
      {(selBeatId || selBlockId) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
            fontSize: 11,
          }}
        >
          <span style={{ color: 'var(--text-mute)' }}>selected:</span>
          <code
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              color: 'var(--text)',
            }}
          >
            {selBeatId ?? selBlockId}
          </code>
          <button
            type="button"
            onClick={() =>
              startSpotEdit(selBeatId ? 'beat' : 'block', (selBeatId ?? selBlockId)!)
            }
            style={{
              padding: '3px 10px',
              background: 'transparent',
              color: '#ffd866',
              border: '1px solid rgba(255, 217, 102, 0.40)',
              borderRadius: 5,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 600,
            }}
            title="Open an async claude thread scoped to this beat/block"
          >
            ↗ Spot-edit
          </button>
          <button
            type="button"
            onClick={() => onMention(`#${selBeatId ?? selBlockId}`)}
            style={{
              padding: '3px 10px',
              background: 'transparent',
              color: 'var(--text-mute)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 11,
            }}
            title="Append the beat id as a mention into the main chat input"
          >
            📌 Pin to chat
          </button>
        </div>
      )}
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
            selected={sel?.kind === 'block' && sel.blockId === block.id}
            onClick={() => {
              setSel({ kind: 'block', blockId: block.id });
              seekTo(block.startFrame);
            }}
            onPin={() => onMention(`#${block.id}`)}
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
            selected={sel?.kind === 'beat' && sel.beatId === beat.id}
            onClick={() => {
              setSel({ kind: 'beat', beatId: beat.id });
              seekTo(beat.startFrame);
            }}
            onPin={() => onMention(`#${beat.id}`)}
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
  onPin: () => void;
}> = ({ id, startFrame, durationFrames, totalFrames, color, label, selected, onClick, onPin }) => {
  const left = (startFrame / totalFrames) * 100;
  const width = (durationFrames / totalFrames) * 100;
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onPin}
      title={`${label} — click to seek, double-click to mention in chat`}
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
