import React from 'react';
import { fetchProjects, type ProjectSummary } from '../api';
import { ProjectCard } from './ProjectCard';
import { NewProjectDialog } from './NewProjectDialog';

export const GalleryPage: React.FC = () => {
  const [projects, setProjects] = React.useState<ProjectSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const load = React.useCallback(() => {
    setError(null);
    fetchProjects()
      .then(setProjects)
      .catch((err) => setError(String(err)));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elev)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <strong style={{ fontSize: 14, letterSpacing: 0.4 }}>paper-videos</strong>
        <span style={{ color: 'var(--text-mute)', fontSize: 13 }}>
          {projects ? `${projects.length} project${projects.length === 1 ? '' : 's'}` : 'loading…'}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          style={{
            padding: '6px 14px',
            background: 'var(--accent)',
            color: '#0e1117',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          + New video
        </button>
        <button
          type="button"
          onClick={load}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            color: 'var(--text-mute)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
          }}
        >
          ↻ Refresh
        </button>
      </header>

      <main style={{ padding: 24, flex: 1 }}>
        {error && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: '#3a1f24',
              border: '1px solid #ff6b6b40',
              color: '#ff9494',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            Failed to load projects: {error}
          </div>
        )}
        {projects === null ? (
          <div style={{ color: 'var(--text-mute)', textAlign: 'center', padding: 64 }}>
            Loading projects…
          </div>
        ) : projects.length === 0 ? (
          <div
            style={{
              color: 'var(--text-mute)',
              textAlign: 'center',
              padding: 64,
              border: '1px dashed var(--border)',
              borderRadius: 12,
            }}
          >
            No videos yet. Click <strong style={{ color: 'var(--accent)' }}>+ New video</strong>{' '}
            to scaffold one.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 18,
            }}
          >
            {projects.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        )}
      </main>
      {dialogOpen && (
        <NewProjectDialog
          existingSlugs={projects?.map((p) => p.slug) ?? []}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
};
