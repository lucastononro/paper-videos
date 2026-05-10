import React from 'react';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
} from 'remotion';
import { splitLatex } from '../../lib/split-latex';

/**
 * Renders a LaTeX equation via KaTeX (CDN). For "stepwise" reveal, splits the
 * equation by `\\` boundaries and animates each row in.
 *
 * Auto-fit: KaTeX itself doesn't shrink long equations. After render, we measure
 * the rendered .katex-display width and the available container width, then apply
 * `transform: scale(ratio)` to a dedicated inner wrapper if the content overflows.
 * The scale is registered with delayRender so Remotion waits for the measurement
 * to land before capturing the frame. This is the web analog of Manim's
 * `fit_to_frame` (CLAUDE.md rule #22a).
 */
export const EquationCard: React.FC<{
  latex: string;
  reveal: 'stepwise' | 'all';
  durationFrames: number;
}> = ({ latex, reveal, durationFrames }) => {
  const frame = useCurrentFrame();

  const lines = reveal === 'stepwise' ? splitLatex(latex) : [latex];
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

const FIT_W_RATIO = 0.92;
const MAX_LINE_HEIGHT_RATIO = 0.55;

const MathLine: React.FC<{ latex: string; style?: React.CSSProperties }> = ({ latex, style }) => {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const katexRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [handle] = React.useState(() => delayRender(`Fit equation: ${latex.slice(0, 32)}`));
  const continued = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (continued.current) return;
      continued.current = true;
      continueRender(handle);
    };
    (async () => {
      if (!('katex' in window)) {
        await loadKatex();
      }
      if (cancelled || !katexRef.current) {
        finish();
        return;
      }
      // Strip \tag{...} (paper equation numbers) — KaTeX renders them as
      // overlapping (N) glyphs that visually collide with the closing paren.
      const cleaned = latex.replace(/\\tag\{[^}]*\}/g, '').trim();
      // @ts-expect-error global from CDN
      window.katex.render(cleaned, katexRef.current, { throwOnError: false, displayMode: true });

      // Measure after layout settles. Two RAFs: KaTeX inserts elements
      // synchronously but the browser hasn't reflowed yet.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled || !katexRef.current || !outerRef.current) {
            finish();
            return;
          }
          const inner = katexRef.current.querySelector('.katex-display') as HTMLElement | null;
          const innerW = inner?.scrollWidth ?? katexRef.current.scrollWidth;
          const innerH = inner?.scrollHeight ?? katexRef.current.scrollHeight;
          const containerW = outerRef.current.clientWidth || 1792;
          const containerH = outerRef.current.clientHeight || 980;
          const sW = innerW > 0 ? (containerW * FIT_W_RATIO) / innerW : 1;
          const sH = innerH > 0 ? (containerH * MAX_LINE_HEIGHT_RATIO) / innerH : 1;
          const next = Math.min(1, sW, sH);
          if (Number.isFinite(next) && next > 0) setScale(next);
          // Release the delayRender on the next frame so React commits the
          // scaled transform before Remotion captures.
          requestAnimationFrame(finish);
        });
      });
    })();
    return () => {
      cancelled = true;
      finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latex]);

  return (
    <div
      ref={outerRef}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        ...style,
      }}
    >
      <div
        ref={innerRef}
        style={{
          color: '#e6edf3',
          fontSize: 56,
          lineHeight: 1.3,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <div ref={katexRef} />
      </div>
    </div>
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

// `splitLatex` was extracted to `src/lib/split-latex.ts` so the QA layer can
// regression-test it without pulling Remotion. See that file for why the
// depth-aware logic is non-negotiable (matrix row separators).
