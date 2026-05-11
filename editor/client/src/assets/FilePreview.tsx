import React from 'react';
import type { FileEntry } from '../api';

/**
 * Inline previewer for a single file. Branches on mime type:
 *  - image/*       → <img>
 *  - audio/*       → <audio controls>
 *  - video/*       → <video controls>
 *  - application/pdf → <iframe>
 *  - text/* + json + code → fetch the text and render in a <pre>
 *  - everything else → "binary file" footer with a download link
 */
export const FilePreview: React.FC<{ slug: string; entry: FileEntry; src: string }> = ({
  entry,
  src,
}) => {
  const mime = entry.mime ?? '';
  const [text, setText] = React.useState<string | null>(null);
  const [textErr, setTextErr] = React.useState<string | null>(null);

  const isText =
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('python') ||
    mime.includes('typescript') ||
    mime.includes('javascript') ||
    mime.includes('yaml');

  React.useEffect(() => {
    if (!isText) {
      setText(null);
      return;
    }
    let cancelled = false;
    fetch(src)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch((err) => {
        if (!cancelled) setTextErr(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [src, isText]);

  return (
    <div className="file-preview">
      <div className="file-preview-header">
        <span className="file-preview-name">{entry.name}</span>
        <span className="file-preview-mime">{mime || 'binary'}</span>
        <span style={{ flex: 1 }} />
        <a className="file-preview-download" href={src} target="_blank" rel="noreferrer">
          open ↗
        </a>
      </div>
      <div className="file-preview-body">
        {mime.startsWith('image/') && (
          <img
            src={src}
            alt={entry.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        )}
        {mime.startsWith('audio/') && (
          <audio controls src={src} style={{ width: '100%' }}>
            <track kind="captions" />
          </audio>
        )}
        {mime.startsWith('video/') && (
          <video controls src={src} style={{ width: '100%', maxHeight: '100%' }}>
            <track kind="captions" />
          </video>
        )}
        {mime === 'application/pdf' && (
          <iframe
            src={src}
            title={entry.name}
            style={{ width: '100%', height: '100%', border: 'none', background: '#0e1117' }}
          />
        )}
        {isText && (
          <>
            {textErr && <div className="file-preview-error">failed to load: {textErr}</div>}
            {text === null && !textErr && <div className="file-preview-loading">loading…</div>}
            {text !== null && <pre className="file-preview-pre">{text}</pre>}
          </>
        )}
        {!isText &&
          !mime.startsWith('image/') &&
          !mime.startsWith('audio/') &&
          !mime.startsWith('video/') &&
          mime !== 'application/pdf' && (
            <div className="file-preview-binary">
              binary file ({entry.size} bytes) — open in a new tab via the link above
            </div>
          )}
      </div>
    </div>
  );
};
