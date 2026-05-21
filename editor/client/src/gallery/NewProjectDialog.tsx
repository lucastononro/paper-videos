import React from 'react';
import { navigate } from '../router';
import { uploadPdf, deriveSlug } from '../api';
import { setAutoDispatch } from '../autoDispatch';

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

type Mode = 'source' | 'upload';

/**
 * "+ New video" dialog. Two modes:
 *
 * 1. **Source** — enter an arxiv id, URL, or topic. The server derives the
 *    slug; the editor chat auto-fires `/paper-video new <source> <slug>`.
 *
 * 2. **Upload PDF** — drag-drop or pick a PDF from the filesystem. The server
 *    receives the raw bytes, writes `videos/<slug>/paper.pdf`, and the editor
 *    chat auto-fires the pipeline.
 *
 * Both modes derive the slug automatically (editable) and set an auto-dispatch
 * prompt so the pipeline starts as soon as the editor opens.
 */
export const NewProjectDialog: React.FC<{
  existingSlugs: string[];
  onClose: () => void;
}> = ({ existingSlugs, onClose }) => {
  const [mode, setMode] = React.useState<Mode>('source');

  // Source mode state
  const [source, setSource] = React.useState('');

  // Upload mode state
  const [file, setFile] = React.useState<File | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Shared state
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [slugAutoLocked, setSlugAutoLocked] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dispatchPrompt, setDispatchPrompt] = React.useState<string | null>(null);
  const sourceInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (mode === 'source') sourceInputRef.current?.focus();
  }, [mode]);

  // Derive slug from source (debounced).
  const deriveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (mode !== 'source' || !source.trim() || !slugAutoLocked) return;
    if (deriveTimer.current) clearTimeout(deriveTimer.current);
    deriveTimer.current = setTimeout(async () => {
      try {
        const result = await deriveSlug(source.trim());
        setSlug(result.slug);
        setDispatchPrompt(result.dispatchPrompt);
        setError(null);
      } catch {
        // Derive failed — user can still type a slug manually.
      }
    }, 400);
    return () => {
      if (deriveTimer.current) clearTimeout(deriveTimer.current);
    };
  }, [source, mode, slugAutoLocked]);

  // Derive slug from uploaded filename (client-side).
  React.useEffect(() => {
    if (mode !== 'upload' || !file || !slugAutoLocked) return;
    const baseName = file.name.replace(/\.pdf$/i, '');
    const derived = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    setSlug(derived || 'uploaded-paper');
  }, [file, mode, slugAutoLocked]);

  const slugError = (() => {
    if (!slugTouched && !slug) return null;
    if (!slug.trim()) return 'pick a name';
    if (!SLUG_RE.test(slug))
      return 'lowercase letters, digits, hyphens; must start with a letter or digit';
    if (existingSlugs.includes(slug)) return `"${slug}" already exists`;
    return null;
  })();

  const canSubmit = (() => {
    if (submitting) return false;
    if (slugError) return false;
    if (!slug.trim()) return false;
    if (mode === 'source' && !source.trim()) return false;
    if (mode === 'upload' && !file) return false;
    return true;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlugTouched(true);
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      if (mode === 'upload' && file) {
        const result = await uploadPdf(file);
        setAutoDispatch(result.slug, result.dispatchPrompt);
        navigate({ kind: 'editor', slug: result.slug });
      } else if (mode === 'source' && source.trim()) {
        // Use the already-derived dispatch prompt if available, or derive now.
        let prompt = dispatchPrompt;
        if (!prompt) {
          const result = await deriveSlug(source.trim());
          prompt = result.dispatchPrompt;
        }
        setAutoDispatch(slug, prompt);
        navigate({ kind: 'editor', slug });
      }
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please drop a PDF file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
    }
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 12px',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#0e1117' : 'var(--text-mute)',
    border: active ? 'none' : '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    transition: 'all 0.15s',
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          width: 'min(540px, 92%)',
        }}
      >
        <h2 style={{ margin: '0 0 6px 0', fontSize: 18 }}>New video</h2>
        <p
          style={{
            margin: '0 0 16px 0',
            color: 'var(--text-mute)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          Provide a source or upload a PDF. Claude will scaffold the project and start the pipeline.
        </p>

        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setMode('source')}
            style={tabStyle(mode === 'source')}
          >
            Source
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            style={tabStyle(mode === 'upload')}
          >
            Upload PDF
          </button>
        </div>

        {/* Source mode */}
        {mode === 'source' && (
          <>
            <label style={labelStyle}>source (arxiv id, URL, or topic)</label>
            <input
              ref={sourceInputRef}
              type="text"
              value={source}
              onChange={(e) => {
                setSource(e.currentTarget.value);
                setSlugAutoLocked(true);
              }}
              placeholder="1706.03762, https://arxiv.org/..., or Galois theory"
              spellCheck={false}
              autoComplete="off"
              style={inputStyle(false)}
            />
          </>
        )}

        {/* Upload mode */}
        {mode === 'upload' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                style={{
                  padding: '28px 16px',
                  border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8,
                  background: dragOver ? 'rgba(255, 216, 102, 0.06)' : 'var(--bg-elev-2)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 6 }}>{'\uD83D\uDCC4'}</div>
                <div style={{ fontSize: 13, color: 'var(--text-mute)' }}>
                  Drop a PDF here or click to browse
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: 'var(--bg-elev-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                }}
              >
                <span style={{ fontSize: 18 }}>{'\uD83D\uDCC4'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {file.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-mute)' }}>
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setSlug('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  style={{
                    padding: '2px 8px',
                    background: 'transparent',
                    color: 'var(--text-mute)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'inherit',
                  }}
                >
                  {'\u2715'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Slug input (shared) */}
        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>slug (auto-derived, editable)</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.currentTarget.value.toLowerCase().replace(/\s+/g, '-'));
              setSlugTouched(true);
              setSlugAutoLocked(false);
            }}
            onBlur={() => setSlugTouched(true)}
            spellCheck={false}
            autoComplete="off"
            placeholder="project-name"
            style={inputStyle(Boolean(slugTouched && slugError))}
          />
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: slugError ? '#ff9494' : 'var(--text-mute)',
              minHeight: 14,
            }}
          >
            {slugError ?? (slug ? `\u2192 videos/${slug}/` : '')}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              marginTop: 8,
              padding: '8px 10px',
              borderRadius: 6,
              background: '#3a1f24',
              border: '1px solid #ff6b6b40',
              color: '#ff9494',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--text-mute)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              color: '#0e1117',
              border: 'none',
              borderRadius: 6,
              cursor: canSubmit ? 'pointer' : 'default',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              opacity: canSubmit ? 1 : 0.45,
            }}
          >
            {submitting ? 'Creating\u2026' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--text-mute)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 4,
};

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-elev-2)',
    color: 'var(--text)',
    border: `1px solid ${hasError ? '#ff6b6b' : 'var(--border)'}`,
    borderRadius: 6,
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
