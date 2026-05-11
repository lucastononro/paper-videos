# Visualization best practices for paper-videos

The visualizer subagent's primary reference. Read this before writing any Manim scene or touching the Remotion composition. These rules come from analyzing 3Blue1Brown's recent work (2024-2025) and from how human attention actually works during dense lectures.

## 1. The micro-beat doctrine

A beat is the atomic unit. Each beat = one short narration clip + one visual action. The video is a chain of beats.

Don't:

- Make a 30-second monologue with 4 mixed visuals.
- Cram three concepts into one Manim scene.
- Let a single beat run longer than 8 seconds.

Do:

- Make 120-200 beats for a 12-minute video.
- One concept per beat.
- Insert silent pause-beats (0.3-1.0s) after key claims.

## 2. Tight timing — visual ≈ 0.95 × narration

For every Manim beat:

- Audio length is given (from `narration/beat-NNN.timestamps.json`).
- Visual content should consume **95%** of that time.
- The visual settles slightly before the voice ends. The viewer's eyes catch up; the brain integrates; the next beat lands clean.

If audio is 3.4s, your Manim scene is **3.2s** of animation + a 0.2s `wait()` + `FadeOut`.

Never have the visual end exactly when the voice does — feels rushed.
Never have the visual end 1+ seconds before the voice — feels lazy.

## 3. Spacing — silent breath beats

After:

- A key claim (the "what")
- A heavy equation step
- A surprising visual transition

…always insert a `[PAUSE 0.4-0.8s]` beat. This is non-negotiable. Comprehension dies without it.

In a 12-minute video, expect ~25-40 pause beats. They are content.

## 4. Comprehension-first layout

The Remotion canvas is 1920×1080. Default layout:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   visual (Manim, paper page, image, equation, diagram)   │
│                              ~85% of vertical space      │
│                                                          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│         caption bar — current narration words            │
│         (highlighted word in gold, ~15% bottom)          │
└──────────────────────────────────────────────────────────┘
```

Variations (use sparingly):

- **Side-by-side** for `highlightedQuote` (paper page left, quote pulled to right)
- **Three-thirds** when comparing two concepts visually
- **Full-bleed Manim** for hero shots (no captions for those beats — let the visual breathe)

## 5. Color discipline

Project palette (matches Remotion + Manim):

```
bg              #0e1117   (dark navy — both Manim background & Remotion canvas)
text            #e6edf3   (off-white)
caption-active  #ffd866   (gold — currently-spoken word)
primary         #58a6ff   (blue — focus subjects, main equation terms)
secondary       #ffd866   (gold — "after" state in transforms)
contrast        #f97583   (red — terms being removed, warnings)
neutral         #8b949e   (grey — supporting text, axes, less-important)
```

**Variables stay the same color across the whole video.** If `Q` is blue in beat-014, it's blue in beat-067. The viewer's brain tracks color → meaning.

## 6. Pacing per visual kind

| Visual kind                     | Typical duration | Notes                                                      |
| ------------------------------- | ---------------- | ---------------------------------------------------------- |
| `titleCard` (hook)              | 1.5-3.0s         | Opens with `[PAUSE 0.6s]` after for the viewer to register |
| `paperPage` (Ken-Burns)         | 3-7s             | Pan/zoom over a page region; faster than 3s feels jumpy    |
| `highlightedQuote`              | 4-7s             | Eye must travel left→right; faster than 4s = unreadable    |
| `equationStep` (one row reveal) | 1.5-3.5s         | Per row of an equation; longer for the row that matters    |
| `image`                         | 2-5s             | Static image; 2s if simple, 5s if dense                    |
| `diagram`                       | 3-6s             | Generated SVG diagrams need orientation time               |
| `manimClip`                     | 2-8s             | Per the beat's narration length × 0.95                     |
| `pause`                         | 0.3-1.0s         | Use generously                                             |

## 7. Manim-specific guidance

See `references/usage/manim/3b1b-patterns.md` for full patterns. Key rules from that doc summarized:

- **Color-code variables.** Use `set_color_by_tex` or split `MathTex` into substring args. Same variable, same color, every scene it appears in.
- **`LaggedStart` for 2+ visuals appearing together** — `lag_ratio=0.3`.
- **`TransformMatchingTex` over `Transform`** for equation rewrites — keeps shared symbols stable.
- **`ValueTracker` + `bind_graph_to_func`** for parameter sweeps — separates value change from visual update.
- **Never `set_camera_orientation`** — use `.animate.reorient(theta, phi, gamma)` instead (Euler angles).
- **`suspend_mobject_updating=True`** when playing an entrance animation on something with an updater.
- **Always `self.wait(0.2)` then `FadeOut` at scene end.**
- **Use `Tex()` for math in 2026 ManimCE** — lighter than the older `MathTex`. Same args.

## 8. Remotion-specific guidance

- The composition is data-driven from `manifest.json`. You rarely edit `PaperExplainer.tsx`.
- `<OffthreadVideo>` for Manim mp4s (Rust decoder, deterministic frames).
- `<Img>` for paper pages, images, diagrams — never `<img>` directly.
- Captions in `<CaptionBar>` are word-by-word highlighted from the timestamps file.
- KaTeX renders LaTeX in `EquationCard`. Don't try to render LaTeX in Manim and import as image — use the equation card.

### Critical: continuous playback across reused scenes (v2 model)

The manifest is split into two independent timelines:

- `voice[]` — narration beats (1:1 with TTS clips)
- `visualBlocks[]` — visual spans (each with `description` metadata)

A single `visualBlock` can span many voice beats. The composition (`PaperExplainer.tsx`):

1. Renders one `<Sequence>` per `visualBlock` covering the block's full duration.
2. For Manim blocks, plays the mp4 ONCE end-to-end inside the block's window.
3. If the block is longer than the mp4, holds the **literal last frame** (a PNG pre-extracted by ffmpeg in `render-remotion.ts`) for the remaining frames.
4. **Never loops.** Looping causes mid-narration replays — felt as "the video resets weirdly" by the user.
5. Voice + caption layer is rendered as its own set of `<Sequence layout="none">` elements aligned to voice-beat windows.

If you add a new visual kind that uses a long media source (video, lottie, gif), apply the same play-once + hold-last-frame pattern. Pre-compute the still frame at bundle time. Do not rely on per-Sequence remount as a "reset" mechanism.

### Manim scenes must end on a held tableau

Because the composition holds the final frame for any block-time-beyond-mp4-time, the **last frame of every Manim mp4 must be the satisfying conclusion of the visual**. Specifically:

- DON'T end with `self.play(FadeOut(everything))`. That leaves a black final frame — the held black is indistinguishable from a broken render.
- DO end with `self.wait(0.3)` after the last meaningful animation. The held frame is then the resolved scene state.
- Time the scene's total duration close to the visualBlock's `durationFrames` (or just under). If the block is 20s and your scene runs 12s, that's fine — 8s of held tableau is intentional.

## 9. Common failure modes (and the fix)

| Symptom                                                                                | Cause                                                                                                                              | Fix                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewer says "lost me at minute 3"                                                      | Beats too long, no silent breaths                                                                                                  | Insert pause beats; split long beats                                                                                                                                                                                                                |
| Captions feel late                                                                     | Word timestamps off by >100ms                                                                                                      | Re-narrate the beat with the same text — sometimes the model retimes better                                                                                                                                                                         |
| Captions jitter / words sliding around                                                 | Sliding-window layout — words reflow when active word advances                                                                     | Render ALL words of the beat in stable positions; only the highlight color/scale animates. See `CaptionBar.tsx` doctrine and section 11 below.                                                                                                      |
| Captions snap during silent gaps                                                       | Window pinned to "active word", which is `-1` during gaps                                                                          | Drive each word's styling from its own activation curve via `interpolate(t, [w.start-fade, w.start, w.end, w.end+fade], [0,1,1,0])`. No "active index" lookup.                                                                                      |
| Manim scene ends way before audio                                                      | Visual `wait()` too short                                                                                                          | Add `self.wait(extra)` at end; do not lengthen each animation                                                                                                                                                                                       |
| Manim scene runs over audio                                                            | Too many objects, run_time too generous                                                                                            | Drop a sub-step; split into two beats                                                                                                                                                                                                               |
| "What just happened?" — viewer misses a transition                                     | No color tracking                                                                                                                  | Variables must keep their colors across beats                                                                                                                                                                                                       |
| Equations look fuzzy                                                                   | KaTeX not loaded at render time                                                                                                    | Confirm CDN scripts loaded; check `delayRender` handle                                                                                                                                                                                              |
| Manim hangs at 0% CPU after a few seconds                                              | `LaggedStartMap(Write, ...)` or `LaggedStartMap(GrowFromCenter, ...)` deadlocks ManimCE 0.19+ on multi-Text inputs                 | Replace with explicit `LaggedStart(*[FadeIn(x) for x in collection], lag_ratio=...)`. Don't use `LaggedStartMap` with `Write` ever.                                                                                                                 |
| Manim scene "restarts" at every new sentence — viewer says "the video keeps resetting" | Voice and visual on a rigid 1:1 timeline; each beat mounted its own video.                                                         | Manifest v2: `voice[]` + `visualBlocks[]` independent. Composition renders the visual layer once; mp4 plays once and **holds its final frame** for the rest of the block. No `<Loop>`. See §8 "Critical: continuous playback across reused scenes." |
| Mp4 replays mid-narration ("on the left… on the right" → mp4 starts over)              | Composition used `<Loop>` to cover blocks longer than the mp4 — the loop boundary cut the visual mid-explanation.                  | Replace `<Loop>` with **play-once + hold-last-frame**. Last frames are pre-extracted to PNGs by `render-remotion.ts` via ffmpeg and exposed as `manim-last-frames.json`.                                                                            |
| Pause beats showed black mid-flow                                                      | Pause beat overlaid black `<AbsoluteFill>` between two manim beats.                                                                | v2 migration absorbs pause segments adjacent to a manim run into the manim block. The held mp4 keeps showing during pauses.                                                                                                                         |
| Yellow `[20 9C]` boxes where math should be                                            | Manim `Text("vₜ(x)")` used Unicode subscripts; the default Manim font lacks U+209C and renders codepoint hex as a placeholder box. | Install BasicTeX + tex packages; rewrite scenes with `MathTex(latex)`. NEVER fall back to Unicode subscripts/superscripts/Greek in `Text()`. CLAUDE.md hard rule #12.                                                                               |
| Equation card shows `(1)` overlapping the closing `(x)` paren                          | `equations.json` preserves `\tag{N}` from source; KaTeX renders it adjacent to the formula.                                        | `EquationCard` strips `\\tag\{...\}` before passing to katex.render.                                                                                                                                                                                |
| Manim mp4 ends with black instead of a held final tableau                              | Scene closed with `FadeOut(all_objects)`, leaving black for the last 0.5s. The composition's hold-last-frame then shows black.     | Scenes must END on the satisfying final state, not faded out. Final `self.wait(0.3)` after the last animation; no global FadeOut at scene end.                                                                                                      |

## 11. Captions doctrine

The `CaptionBar` component (`src/remotion/components/CaptionBar.tsx`) is the source of truth. Read it before changing.

Hard rules for captioning:

1. **Never use a sliding window.** The whole-beat layout must render once and stay still. Word boxes do not move during a beat. Only their styling animates. Sliding windows produce frame-by-frame reflow which the eye perceives as jitter.
2. **Each word has its own activation curve.** Don't compute a single "active index" and style it specially. Instead, interpolate per word:
   ```ts
   const activation = interpolate(
     t,
     [w.start - fadeS, w.start, w.end, w.end + fadeS],
     [0, 1, 1, 0],
     { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
   );
   ```
   This gives smooth highlight ramps and crossfades between adjacent words. No lookup, no `-1` edge case.
3. **CSS `transition` does not play during render.** Remotion renders frame by frame; CSS animations and transitions are inert. Any visual change has to come from `interpolate()` or `spring()` driven by the current frame.
4. **Three states with smooth blends.** A word is `upcoming` (default), `active` (gold + bold), or `past` (muted grey). Each transition is interpolated, never binary. The font-weight is the one binary thing — CSS can't tween font-weight numerically.
5. **Stable letter spacing.** Use `display: flex; flex-wrap: wrap; gap: 0 12px;` so neighbors don't push when the active word's `transform: scale()` makes it slightly larger. The scale visually overflows but does not change layout.
6. **Beat length budget.** Captions assume beats fit in ~2 lines at our font-size (36px) and width (72%). For most beats (5-25 words) this is fine. If a beat narration grows past ~40 words, split it into two beats — don't shrink the font.

If you change `CaptionBar`, run a smoke test on a beat with: a single word, ~10 words across one line, ~25 words wrapping, and a beat with a deliberate >0.5s gap inside (you can check with `npm run render-remotion`). Watch each at 1× and 0.5× — the jitter cases are most visible during silent gaps and at word boundaries.

## 10. Test cadence

After the first **5 rendered beats** (Manim + Remotion final on a 5-beat slice):

- Watch the result end-to-end.
- Check captions sync to within ~80ms of voice.
- Check pacing: do you feel rushed or bored?
- Check color discipline: are variables the same color you set them to?

Fix issues at this slice before rendering the full video — saves hours.
