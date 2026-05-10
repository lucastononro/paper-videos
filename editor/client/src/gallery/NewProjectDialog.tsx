import React from 'react';
import { navigate } from '../router';

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * "+ New video" dialog. Asks the user for a slug — the folder name under
 * `videos/`. The slug is the URL the editor will sit on; Claude will create
 * `videos/<slug>/` from `/paper-video new` once told what to fetch.
 *
 * Just a slug picker. No paper / arXiv input — that part of the conversation
 * happens in the chat once the editor opens.
 */
export const NewProjectDialog: React.FC<{
  existingSlugs: string[];
  onClose: () => void;
}> = ({ existingSlugs, onClose }) => {
  const [slug, setSlug] = React.useState(() => suggestSlug(existingSlugs));
  const [touched, setTouched] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.select();
  }, []);

  const slugError = (() => {
    if (!touched) return null;
    if (!slug.trim()) return 'pick a name';
    if (!SLUG_RE.test(slug)) return 'lowercase letters, digits, hyphens; must start with a letter or digit';
    if (existingSlugs.includes(slug)) return `"${slug}" already exists`;
    return null;
  })();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!slug.trim() || !SLUG_RE.test(slug) || existingSlugs.includes(slug)) return;
    navigate({ kind: 'editor', slug });
  };

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
          width: 'min(520px, 92%)',
        }}
      >
        <h2 style={{ margin: '0 0 6px 0', fontSize: 18 }}>New video</h2>
        <p style={{ margin: '0 0 16px 0', color: 'var(--text-mute)', fontSize: 13, lineHeight: 1.5 }}>
          Pick a name — that's the folder under <code>videos/</code> and the URL of the editor.
          Claude will scaffold the project there once you tell it which paper.
        </p>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            color: 'var(--text-mute)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 4,
          }}
        >
          slug
        </label>
        <input
          ref={inputRef}
          type="text"
          value={slug}
          onChange={(e) => {
            setSlug(e.currentTarget.value.toLowerCase().replace(/\s+/g, '-'));
            setTouched(true);
          }}
          onBlur={() => setTouched(true)}
          spellCheck={false}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'var(--bg-elev-2)',
            color: 'var(--text)',
            border: `1px solid ${slugError ? '#ff6b6b' : 'var(--border)'}`,
            borderRadius: 6,
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: slugError ? '#ff9494' : 'var(--text-mute)',
            minHeight: 14,
          }}
        >
          {slugError ?? `→ videos/${slug || '<slug>'}/`}
        </div>
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
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
            disabled={!!slugError || !slug.trim()}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              color: '#0e1117',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              opacity: slugError || !slug.trim() ? 0.45 : 1,
            }}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
};

function suggestSlug(existing: string[]): string {
  // Try `untitled-1`, `untitled-2`, … until one is free.
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `untitled-${i}`;
    if (!existing.includes(candidate)) return candidate;
  }
  return `untitled-${Date.now()}`;
}
