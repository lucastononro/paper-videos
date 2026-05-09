# 3Blue1Brown style notes

These are aesthetic and pacing rules of thumb the manim-animator should follow when generating scenes for paper-videos.

## Palette

```
Background      #0e1117   (close to 3b1b's #161616 but harmonized with our Remotion bg)
Primary blue    BLUE_C    (#58c4dd in Manim)  — main subject of the equation
Highlight gold  YELLOW_C  (#ffff00) — the "what changed" state during a transform
Removed red     RED_C     (#fc6255) — terms being dropped or that are wrong
Neutral grey    GREY_B    (#9a9a9a) — axes, grid, supporting labels
```

## Pacing

- Hold each new equation step for **0.5–0.8s** before transforming.
- After the final step, **0.4s wait + FadeOut** before the scene ends.
- Don't pause mid-transform; the audience can read while it animates.
- Each scene should consume ~95% of its narration segment's duration. The visual settles slightly before the voice does.

## Typography

- `MathTex` default size scaled by **1.2–1.4** for solo equations.
- For multi-equation derivations, scale `1.0–1.1` and stack vertically with `arrange(DOWN, buff=0.6)`.
- Body text is rare — use `Text(..., font="Inter")` only for a single label or annotation.

## What deserves a Manim scene?

- A multi-step derivation (3+ rewrites).
- A geometric visualization that words can't carry alone (vectors rotating, a function being summed, etc.).
- A clean visual proof.

What does **not** deserve a Manim scene (use an `equationCard` instead):

- A single static equation with no derivation.
- Just showing a formula while the narrator describes it.

## When the narrator says "let's derive"

That's your cue. Always favor `TransformMatchingTex` over plain `Transform` for equation-to-equation moves so shared symbols animate continuously instead of cross-fading.

## Don't

- Don't use camera moves shorter than 8s of segment duration — they distract.
- Don't put more than ~5 mobjects on screen at once for an equation scene.
- Don't write LaTeX from memory of the paper. Always sourced from `equations.json` or quoted in the script.
