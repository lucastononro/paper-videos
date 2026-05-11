import React from 'react';
import { listFiles, fileUrl, type FileEntry } from '../api';
import { FilePreview } from './FilePreview';
import './assets.css';

/**
 * File-tree + preview panel for the right pane's "Assets" tab.
 * Shows the user every file under videos/<slug>/ — paper.pdf, paper.md, the
 * generated narration mp3s, manim mp4s, equations.json, qa-report.json,
 * output.mp4 — and lets them preview each one inline.
 */
export const AssetsTab: React.FC<{ slug: string }> = ({ slug }) => {
  const [path, setPath] = React.useState('');
  const [entries, setEntries] = React.useState<FileEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<FileEntry | null>(null);

  const refresh = React.useCallback(() => {
    setError(null);
    listFiles(slug, path)
      .then(setEntries)
      .catch((err) => setError(String(err)));
  }, [slug, path]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // When the slug's filesystem changes (chokidar fires preview:reload), pull
  // a fresh listing so newly-generated narration mp3s / manim mp4s appear.
  React.useEffect(() => {
    const onReload = (evt: Event) => {
      const detail = (evt as CustomEvent).detail as { slug?: string };
      if (detail?.slug === slug) refresh();
    };
    window.addEventListener('preview:reload', onReload);
    return () => window.removeEventListener('preview:reload', onReload);
  }, [slug, refresh]);

  const breadcrumb = path === '' ? [] : path.split('/');

  return (
    <div className="assets-pane">
      <div className="assets-toolbar">
        <button
          type="button"
          className="assets-crumb"
          onClick={() => setPath('')}
          disabled={path === ''}
        >
          {slug}
        </button>
        {breadcrumb.map((seg, i) => (
          <React.Fragment key={i}>
            <span className="assets-crumb-sep">/</span>
            <button
              type="button"
              className="assets-crumb"
              onClick={() => setPath(breadcrumb.slice(0, i + 1).join('/'))}
              disabled={i === breadcrumb.length - 1}
            >
              {seg}
            </button>
          </React.Fragment>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" className="assets-refresh" onClick={refresh} title="Refresh">
          ↻
        </button>
      </div>
      <div className="assets-body">
        <div className="assets-list">
          {error && <div className="assets-error">{error}</div>}
          {entries === null && <div className="assets-loading">loading…</div>}
          {entries?.length === 0 && <div className="assets-empty">empty folder</div>}
          {entries?.map((entry) => (
            <button
              key={entry.path}
              type="button"
              className={`assets-row ${selected?.path === entry.path ? 'is-selected' : ''}`}
              onClick={() => {
                if (entry.isDir) {
                  setPath(entry.path);
                  setSelected(null);
                } else {
                  setSelected(entry);
                }
              }}
            >
              <span className="assets-row-icon">{entry.isDir ? '▸' : iconFor(entry)}</span>
              <span className="assets-row-name">{entry.name}</span>
              {!entry.isDir && <span className="assets-row-size">{formatBytes(entry.size)}</span>}
            </button>
          ))}
        </div>
        <div className="assets-preview">
          {selected ? (
            <FilePreview slug={slug} entry={selected} src={fileUrl(slug, selected.path)} />
          ) : (
            <div className="assets-preview-empty">
              {entries?.length === 0 ? 'Folder is empty.' : 'Pick a file to preview it here.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function iconFor(e: FileEntry): string {
  const m = e.mime ?? '';
  if (m.startsWith('image/')) return '🖼';
  if (m.startsWith('audio/')) return '🔊';
  if (m.startsWith('video/')) return '🎬';
  if (m === 'application/pdf') return '📄';
  if (
    m.startsWith('text/') ||
    m.includes('json') ||
    m.includes('python') ||
    m.includes('typescript')
  )
    return '✎';
  return '📦';
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)}GB`;
}
