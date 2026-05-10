import React from 'react';
import { type ProjectSummary, deleteProject, formatDuration, formatRelativeTime, thumbUrl } from '../api';
import { navigate } from '../router';

export const ProjectCard: React.FC<{
  project: ProjectSummary;
  onDeleted?: (slug: string) => void;
}> = ({ project, onDeleted }) => {
  const [busy, setBusy] = React.useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    // Stop the card's onClick from navigating into the editor.
    e.stopPropagation();
    if (busy) return;
    const ok = window.confirm(
      `Delete "${project.slug}" and ALL its files (paper, narration, manim, output.mp4, chat history)?\n\nThis is irreversible.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteProject(project.slug);
      onDeleted?.(project.slug);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[delete-project]', err);
      window.alert(`Failed to delete: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    // Outer is a <div role="button"> rather than <button> so we can nest
    // the delete <button> inside it (invalid HTML otherwise).
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate({ kind: 'editor', slug: project.slug })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate({ kind: 'editor', slug: project.slug });
        }
      }}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        transition: 'border-color 0.15s, transform 0.15s',
        opacity: busy ? 0.55 : 1,
        pointerEvents: busy ? 'none' : 'auto',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          aspectRatio: '16/9',
          background: '#000',
          backgroundImage: `url(${thumbUrl(project.slug)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      >
        {/* Delete affordance — visible on hover only so the card stays
            clean. Confirms via window.confirm before firing the DELETE
            request. */}
        <button
          type="button"
          onClick={handleDelete}
          className="project-card-delete"
          title="Delete this video and all its files"
          aria-label={`Delete ${project.slug}`}
        >
          ✕
        </button>
        {project.hasOutputMp4 && !project.inFlight && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(13,17,23,0.85)',
              color: 'var(--accent)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            ✓ rendered
          </span>
        )}
        {project.inFlight && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px 3px 8px',
              borderRadius: 999,
              background: 'rgba(13,17,23,0.85)',
              color: '#79c0ff',
              fontSize: 11,
              fontWeight: 600,
              border: '1px solid rgba(121,192,255,0.40)',
            }}
            title="Claude is working in this project"
          >
            <span
              style={{
                width: 10,
                height: 10,
                border: '2px solid rgba(121,192,255,0.30)',
                borderTopColor: '#79c0ff',
                borderRadius: '50%',
                animation: 'tool-spin 0.8s linear infinite',
              }}
            />
            running
          </span>
        )}
      </div>
      <div style={{ padding: '12px 14px 14px 14px' }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.35,
            marginBottom: 4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {project.paperTitle}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 8 }}>
          {project.slug}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-mute)',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span>⏱ {formatDuration(project.totalSeconds)}</span>
          <span>{project.voiceBeats} beats</span>
          <span>{project.visualBlocks} blocks</span>
          {project.lastModified > 0 && <span>· {formatRelativeTime(project.lastModified)}</span>}
        </div>
      </div>
    </div>
  );
};
