import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * Renders a LaTeX equation. Uses MathJax via CDN for full LaTeX coverage; the
 * delayRender hook in Root waits for the page to fetch the CDN script during
 * bundling. For "stepwise" reveal, splits the equation by `&` or `\\` boundaries
 * and animates each row in.
 */
export const EquationCard: React.FC<{
  latex: string;
  reveal: 'stepwise' | 'all';
  durationFrames: number;
}> = ({ latex, reveal, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lines = reveal === 'stepwise' ? splitLatex(latex) : [latex];
  // Reveal each line in sequence over the segment.
  const perLineFrames = Math.max(8, Math.floor(durationFrames / Math.max(1, lines.length)));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0e1117',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 24,
        padding: 64,
      }}
    >
      {lines.map((line, i) => {
        const start = i * perLineFrames;
        const opacity = interpolate(frame, [start, start + 10], [0, 1], { extrapolateRight: 'clamp' });
        const translateY = interpolate(frame, [start, start + 10], [12, 0], { extrapolateRight: 'clamp' });
        return (
          <MathLine
            key={i}
            latex={line}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Renders a single LaTeX line. We embed KaTeX via CDN at <head> install time and
 * call `katex.render` on mount. KaTeX is bundled at render time by Remotion's
 * webpack — but since we'd rather avoid an npm dep, we use a CDN <script> tag.
 *
 * For a fully-bundled path, install `katex` and import its CSS in this file.
 */
const MathLine: React.FC<{ latex: string; style?: React.CSSProperties }> = ({ latex, style }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // Lazy-load KaTeX from CDN. In Remotion's headless Chrome this works at render time.
      if (!('katex' in window)) {
        await loadKatex();
      }
      if (cancelled || !ref.current) return;
      // Strip \tag{...} (paper equation numbers) — KaTeX renders them as
      // overlapping (N) glyphs that visually collide with the closing paren.
      const cleaned = latex.replace(/\\tag\{[^}]*\}/g, '').trim();
      // @ts-expect-error global from CDN
      window.katex.render(cleaned, ref.current, { throwOnError: false, displayMode: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [latex]);

  return (
    <div
      ref={ref}
      style={{
        color: '#e6edf3',
        fontSize: 56,
        lineHeight: 1.3,
        ...style,
      }}
    />
  );
};

let katexPromise: Promise<void> | null = null;
function loadKatex(): Promise<void> {
  if (katexPromise) return katexPromise;
  katexPromise = new Promise<void>((resolve, reject) => {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
    document.head.appendChild(cssLink);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load KaTeX from CDN'));
    document.head.appendChild(script);
  });
  return katexPromise;
}

/** Split a LaTeX block at \\ or & boundaries for stepwise reveal. */
function splitLatex(latex: string): string[] {
  const parts = latex
    .split(/\\\\\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [latex];
}
