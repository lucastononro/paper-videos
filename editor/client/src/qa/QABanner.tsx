import React from 'react';
import type { Manifest } from '../api';
import { ws } from '../ws/client';

type QaIssue = {
  severity: 'error' | 'warning' | 'info';
  kind: string;
  message: string;
  jumpFrame: number;
};

type QaReport = {
  slug: string;
  generatedAt: string | null;
  issues: QaIssue[];
  bySeverity: { error: number; warning: number; info: number };
  byKind: Record<string, number>;
};

const SEV_COLOR: Record<QaIssue['severity'], string> = {
  error: '#ff6b6b',
  warning: '#fcd34d',
  info: '#60a5fa',
};

export const QABanner: React.FC<{
  slug: string;
  manifest: Manifest;
  onJumpFrame: (f: number) => void;
  onMention: (token: string) => void;
}> = ({ slug, manifest, onJumpFrame, onMention }) => {
  const [report, setReport] = React.useState<QaReport | null>(null);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    const r = await fetch(`/api/projects/${encodeURIComponent(slug)}/qa-report`);
    if (r.ok) setReport((await r.json()) as QaReport);
  }, [slug]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Refetch whenever the server's auto-QA runner reports a fresh run for
  // this slug. The runner is debounced server-side, so this fires at most
  // every ~1.5s while the user edits.
  React.useEffect(() => {
    return ws.on((e) => {
      if (e.kind === 'qa:updated' && e.slug === slug) void load();
    });
  }, [slug, load]);

  const errs = report?.bySeverity.error ?? 0;
  const warns = report?.bySeverity.warning ?? 0;
  const infos = report?.bySeverity.info ?? 0;

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elev-2)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          fontSize: 12,
        }}
      >
        <strong style={{ color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          QA
        </strong>
        <span style={{ color: SEV_COLOR.error, fontWeight: errs > 0 ? 700 : 400 }}>
          ✗ {errs} {errs === 1 ? 'error' : 'errors'}
        </span>
        <span style={{ color: SEV_COLOR.warning, fontWeight: warns > 0 ? 700 : 400 }}>
          ⚠ {warns} {warns === 1 ? 'warning' : 'warnings'}
        </span>
        <span style={{ color: SEV_COLOR.info }}>
          · {infos} info
        </span>
        <span style={{ flex: 1 }} />
        <span
          title="Auto-runs on every manifest / narration / Manim change (debounced 1.5s)"
          style={{ color: 'var(--text-mute)', fontSize: 11, fontStyle: 'italic' }}
        >
          {report?.generatedAt
            ? `auto · as of ${new Date(report.generatedAt).toLocaleTimeString()}`
            : 'auto · waiting for first run'}
        </span>
        {report && report.issues.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{
              padding: '4px 10px',
              background: 'transparent',
              color: 'var(--text-mute)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            {open ? 'Hide issues' : 'Show issues'}
          </button>
        )}
      </div>
      {open && report && report.issues.length > 0 && (
        <div
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            padding: '6px 16px 12px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
          }}
        >
          {report.issues.map((iss, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
                borderBottom: '1px solid #1a1f29',
              }}
            >
              <span
                style={{
                  width: 60,
                  fontSize: 10,
                  color: SEV_COLOR[iss.severity],
                  fontWeight: 600,
                }}
              >
                {iss.severity}
              </span>
              <span
                style={{
                  width: 200,
                  color: 'var(--text-mute)',
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                }}
              >
                {iss.kind}
              </span>
              <span style={{ flex: 1, color: 'var(--text)' }}>{iss.message}</span>
              <button
                type="button"
                onClick={() => onJumpFrame(iss.jumpFrame)}
                title="Jump player to frame"
                style={{
                  padding: '2px 6px',
                  background: 'transparent',
                  color: 'var(--text-mute)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: 10,
                }}
              >
                ↳ {Math.round(iss.jumpFrame / manifest.fps)}s
              </button>
              <button
                type="button"
                onClick={() => onMention(`This QA issue: ${iss.kind} — ${iss.message}`)}
                title="Send as chat turn"
                style={{
                  padding: '2px 6px',
                  background: 'transparent',
                  color: 'var(--accent)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: 10,
                }}
              >
                Ask claude
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
