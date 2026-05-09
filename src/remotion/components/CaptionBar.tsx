import React from 'react';
import {
  AbsoluteFill,
  delayRender,
  continueRender,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  interpolateColors,
} from 'remotion';

type WordTiming = { word: string; start: number; end: number };
type SegmentTimestamps = {
  segmentId: string;
  audioDurationSeconds: number;
  words: WordTiming[];
};

const COLOR_INACTIVE = '#e6edf3';
const COLOR_ACTIVE = '#ffd866';
const COLOR_PAST = '#8b949e';
const FADE_FRAMES = 3;

/**
 * Bottom-aligned word-by-word captions.
 *
 * Design notes (read first if you're tweaking this):
 *
 * 1. **Stable layout, no sliding window.** All words of the beat are rendered
 *    once in their final positions. Word boxes never move. The only thing that
 *    changes per frame is each word's color/opacity. This eliminates the row-
 *    shift jitter the previous implementation had every time the active word
 *    advanced.
 *
 * 2. **Per-word activation curve.** Each word's "active-ness" is interpolated
 *    over a small fade window (~3 frames each side of its start/end). This
 *    avoids binary on/off pops between words and lets two adjacent words
 *    cross-fade their highlight cleanly.
 *
 * 3. **Three-state styling.** A word is one of:
 *      - upcoming     (default color, normal weight)
 *      - active       (gold, bold, slightly larger via transform-scale)
 *      - past         (muted grey, normal weight)
 *    The transition between states is interpolated by frame, not CSS.
 *    CSS `transition` does NOT play during Remotion render — render is frame-
 *    by-frame, so any transition has to be expressed via `interpolate()`.
 *
 * 4. **Beats are short.** Our doctrine targets 5-25 words per beat, occasionally
 *    up to ~40. Flex-wrap handles the rare long beat across two lines without
 *    reflowing word positions.
 *
 * 5. **Silent gaps.** When `t` lies between two words' end/start, all words
 *    fade smoothly to past/upcoming styling (no word is "active") — no snap.
 */
export const CaptionBar: React.FC<{ timestampsSrc: string }> = ({ timestampsSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [handle] = React.useState(() => delayRender(`Loading captions ${timestampsSrc}`));
  const [data, setData] = React.useState<SegmentTimestamps | null>(null);

  React.useEffect(() => {
    (async () => {
      const res = await fetch(timestampsSrc);
      if (!res.ok) {
        continueRender(handle);
        return;
      }
      const json = (await res.json()) as SegmentTimestamps;
      setData(json);
      continueRender(handle);
    })();
  }, [timestampsSrc, handle]);

  if (!data || data.words.length === 0) return null;

  const fadeS = FADE_FRAMES / fps;
  const t = frame / fps;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        pointerEvents: 'none',
        paddingBottom: 56,
      }}
    >
      <div
        style={{
          maxWidth: '72%',
          padding: '20px 32px',
          borderRadius: 16,
          backgroundColor: 'rgba(13, 17, 23, 0.78)',
          color: COLOR_INACTIVE,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 36,
          lineHeight: 1.4,
          textAlign: 'center',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0 12px',
        }}
      >
        {data.words.map((w, i) => {
          // Activation curve: 0 → 1 over fadeS before w.start, hold at 1
          // through w.end, then 1 → 0 over fadeS after w.end. This produces
          // a smooth highlight ramp instead of a single-frame pop.
          const activation = interpolate(
            t,
            [w.start - fadeS, w.start, w.end, w.end + fadeS],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          // "Past-ness": once t > w.end + fadeS the word is fully past.
          const pastness = interpolate(
            t,
            [w.end, w.end + fadeS],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          // Compose color: inactive → active over the start ramp, then
          // active → past over the end ramp. Two-step blend.
          const colorPart1 = interpolateColors(activation, [0, 1], [COLOR_INACTIVE, COLOR_ACTIVE]);
          const color = interpolateColors(pastness, [0, 1], [colorPart1, COLOR_PAST]);

          // Slight scale-up on active for emphasis without reflow.
          const scale = 1 + 0.06 * activation;
          // Bold weight ramps; CSS can't smoothly interpolate font-weight,
          // so we just toggle past activation > 0.5.
          const fontWeight = activation > 0.5 ? 700 : 500;

          return (
            <span
              key={`${i}-${w.start}`}
              style={{
                display: 'inline-block',
                color,
                fontWeight,
                transform: `scale(${scale})`,
                transformOrigin: 'center bottom',
                // Reserve glyph space at the larger size so neighbors don't shift
                // when this word scales up. We achieve this by NOT applying margin
                // to the scale; the scale visually overflows but doesn't push.
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
