# Manim usage notes (Community Edition)

Read this first. The full upstream is at `references/raw-packages/manim/` if you need to dig.

## Render flag cheat-sheet

| Flag | Resolution | Use |
|---|---|---|
| `-ql` | 480p15 | quick smoke tests only |
| `-qm` | 720p30 | preview |
| `-qh` | 1080p60 | **production default** |
| `-qk` | 2160p60 | hero shots only |

We always render production with `-qh` (1080p60). The renderer ingests the mp4 and Remotion plays it at 30fps in the final composition; 60fps Manim → 30fps Remotion is fine because we treat the clip as decoded video frames.

## Scene class skeleton

```python
from manim import *

config.background_color = "#0e1117"

class YourSceneName(Scene):
    def construct(self):
        # 1. Set up state
        eq = MathTex(r"f(x) = x^2", color=BLUE_C).scale(1.2)

        # 2. Animate
        self.play(Write(eq))
        self.wait(0.6)

        # 3. Transform
        eq2 = MathTex(r"f'(x) = 2x", color=YELLOW_C).scale(1.2)
        self.play(TransformMatchingTex(eq, eq2))
        self.wait(0.6)

        # 4. Fade to clear at end
        self.play(FadeOut(eq2))
```

## Common patterns

- **Stepwise rewrite**: `MathTex(r"a", r"+", r"b")` then `self.play(Transform(eq[0], target_a))` per token.
- **Vector field**: `VectorField(lambda p: ...)` — see `geometric-intuition.py`.
- **Plot a function**: `axes = Axes(...)` then `axes.plot(lambda x: ...)`.
- **Highlight a region**: `SurroundingRectangle(target, color=YELLOW)`.

## Pitfalls

- `MathTex` and `Tex` need a working LaTeX install. The `uv sync` install pulls a Python wrapper but the system `latex` binary must exist (`brew install --cask mactex-no-gui` on macOS).
- A `Scene` ends when `construct` returns; trailing `self.wait()` controls hold time.
- Render time scales with the number of distinct objects animated. If a scene takes >90s to render at `-qh`, simplify.

## Color palette (use these for consistency)

```python
PRIMARY   = BLUE_C      # main equations, focus elements
SECONDARY = YELLOW_C    # highlights, "after" state in transforms
CONTRAST  = RED_C       # warnings, removed terms
NEUTRAL   = GREY_B      # axes, grid, supporting text
```

## Where to look for examples

- This folder's `equation-derivation.py`, `geometric-intuition.py` — canonical patterns.
- `references/raw-packages/manim/example_scenes/` — upstream gallery.
- 3Blue1Brown's `videos` repo (not vendored) at https://github.com/3b1b/videos for style inspiration.
