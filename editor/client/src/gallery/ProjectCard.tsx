import React from 'react';
import { type ProjectSummary, formatDuration, formatRelativeTime, thumbUrl } from '../api';
import { navigate } from '../router';

export const ProjectCard: React.FC<{ project: ProjectSummary }> = ({ project }) => {
  return (
    <button
      type="button"
      onClick={() => navigate({ kind: 'editor', slug: project.slug })}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        transition: 'border-color 0.15s, transform 0.15s',
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
        {project.hasOutputMp4 && (
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
    </button>
  );
};
