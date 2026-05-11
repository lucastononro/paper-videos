# 3b1b patterns — extracted for ManimCommunity

3Blue1Brown writes for `manimgl` (his own fork). We use **ManimCommunity**. Patterns translate, but APIs differ. This file extracts what carries over and notes the divergences.

For real source code, grep `references/raw-packages/3b1b-videos/_2024/` and `_2025/` (e.g. `_2025/laplace/integration.py`, `_2024/transformers/network_flow.py`).

## 1. Color discipline — variables keep their color

Pick a color per semantic role at the start of a video. Keep it across every scene that variable appears in.

```python
# manimgl uses a `t2c` (text-to-color) dict on Tex/MathTex:
integral = Tex(r"\int^\infty_0 e^{\minus {s}t} dt", t2c={r"{s}": YELLOW})

# ManimCommunity equivalent — set_color_by_tex (works on MathTex with substring args):
integral = MathTex(r"\int^\infty_0 e^{-st} dt").set_color_by_tex("s", YELLOW)

# Or split the MathTex into multiple substring args for finer control:
integral = MathTex(r"\int_0^\infty", r"e^{-", r"s", r"t}", r"\, dt")
integral[2].set_color(YELLOW)  # the "s"
```

Project palette (project-wide):

- `BLUE_C` — the focus subject, primary variables
- `YELLOW_C` — "after" state in transforms, key parameters under discussion
- `RED_C` — terms being removed, problems being highlighted
- `GREEN_C` — derived quantities (rare; usually for the value space, e.g. V matrix)
- `GREY_B` — supporting structure, axes, neutral text

## 2. LaggedStart for staggered reveals

Avoid the "everything appears at once" feeling.

```python
# manimgl and ManimCommunity both have LaggedStart
self.play(
    LaggedStart(
        FadeIn(self.block),
        Create(self.polygon),
        Write(self.label),
        lag_ratio=0.3,    # 30% of each animation overlap with the next
    ),
    run_time=1.5
)
```

Use `lag_ratio` between 0.15 and 0.4 for most reveals. 1.0 means strictly sequential (slow). 0.0 means everything together (chaotic).

## 3. TransformMatchingTex for equation rewrites

Always prefer `TransformMatchingTex` over `Transform` for equation-to-equation moves — it keeps shared symbols stable and animates only what changed.

```python
# manimgl
self.play(TransformMatchingTex(prev, curr, run_time=1.2))

# ManimCommunity (same name, same behavior)
from manim import TransformMatchingTex
self.play(TransformMatchingTex(prev, curr, run_time=1.2))
```

For purely visual transforms (shape changes), use `ReplacementTransform`. For value sweeps, see updaters below.

## 4. ValueTracker + bind_graph_to_func for parameter sweeps

```python
# manimgl
s_tracker = ValueTracker(1)
graph = axes.get_graph(np.exp)
axes.bind_graph_to_func(graph, lambda t: np.exp(-s_tracker.get_value() * t))
self.play(s_tracker.animate.set_value(5), run_time=4)

# ManimCommunity uses always_redraw + plot:
s_tracker = ValueTracker(1.0)
graph = always_redraw(
    lambda: axes.plot(lambda t: np.exp(-s_tracker.get_value() * t), color=BLUE_C)
)
self.add(graph)
self.play(s_tracker.animate.set_value(5), run_time=4)
```

ManimCommunity's `always_redraw(lambda: ...)` is the workhorse for any "redraw on every frame because a parameter changed" pattern.

## 5. Camera moves with Euler angles

Don't `set_camera_orientation()` then `play()`. Use `.animate.reorient()`:

```python
# 3b1b 2024+:
self.frame.target = self.frame.generate_target()
self.frame.target.reorient(-40, -15, 0)  # Euler angles (theta, phi, gamma)
self.play(MoveToTarget(self.frame), run_time=5)
```

ManimCommunity equivalent for `MovingCameraScene`:

```python
class Foo(MovingCameraScene):
    def construct(self):
        self.play(self.camera.frame.animate.move_to(target).set(width=8), run_time=2)
```

For `ThreeDScene`:

```python
self.move_camera(phi=70 * DEGREES, theta=-45 * DEGREES, run_time=3)
```

## 6. Pacing — 3b1b's run_time heuristic

| Animation type                               | run_time | Notes                                            |
| -------------------------------------------- | -------- | ------------------------------------------------ |
| Symbol appearance, small rotations           | 0.5-1.5s | Don't fade in slower than 1s for a single symbol |
| Local transform (color, shape, position)     | 2-3s     | TransformMatchingTex is in this range            |
| Concept transition (zoom, pan, layer change) | 3-5s     | Use LaggedStart inside                           |
| Detailed multi-step derivation               | 5-8s     | Break into multiple smaller `play()` calls       |
| Ambient parameter sweep                      | 8-15s    | Use ValueTracker + always_redraw                 |

Anything > 8s for a single `play()` call is suspicious — split it.

## 7. Suspending updaters during entrance

When an object has an updater AND you want to play an entrance animation on it, suspend updates:

```python
graph = always_redraw(lambda: axes.plot(lambda t: f(t)))
self.play(Create(graph, suspend_mobject_updating=True, run_time=3))
```

Without `suspend_mobject_updating=True`, the entrance gets redrawn every frame and looks janky.

## 8. Scene structure 3b1b style

```python
class WhateverConcept(Scene):
    def setup(self):
        super().setup()
        # state trackers, cameras, persistent containers
        self.s_tracker = ValueTracker(1.0)

    def construct(self):
        # narrative chain — high-level methods
        self.show_axes()
        self.derive_step_one()
        self.transition_to_geometry()

    def show_axes(self):
        ...

    def derive_step_one(self):
        ...
```

Each method is a self-contained narrative beat. This makes the scene re-runnable from any beat for debugging (manimgl supports interactive embedding for this).

## 9. Closing every scene

Always:

```python
self.wait(0.4)               # let last frame breathe
self.play(FadeOut(*self.mobjects), run_time=0.5)   # or FadeOut(Group(*self.mobjects))
```

A scene that ends mid-animation feels broken. Always fade.

## 10. ManimCommunity-only notes (2026)

- **Use `Tex()` for math when LaTeX is available**; lighter than `MathTex` but same args.
- **`Text()` uses Pango/Cairo** — works without LaTeX. Good for plain labels.
- **Without LaTeX**, you can still use everything except `Tex`/`MathTex`. Plain Text + geometry covers ~70% of explainer scenes.
- **Performance**: `-ql` (480p15) for iteration, `-qh` (1080p60) for production. Avoid `-qk` unless it's a hero shot.
- **Avoid deprecated**: `TextMobject` (use `Tex`/`Text`), `set_camera_orientation` (use `reorient`/`move_camera`), `RemovalAnimation` (use `FadeOut`/`Uncreate`).
- **Background color** is set globally: `config.background_color = "#0e1117"` at module top.

## 11. Pitfalls 3b1b explicitly avoids

- **Over-updating**: only put updaters on objects whose state actually depends on a tracker. Updaters on every mobject slows render 10-100×.
- **LaTeX preamble bloat**: keep custom `\usepackage` light. Each line adds 2-5s per scene.
- **Camera move during a play**: a `play(MoveToTarget(self.frame), ...)` should not race with another camera move — chain them.
- **Mixing manimgl and ManimCommunity APIs**: 3b1b's `manim_imports_ext` is his fork's compatibility layer. Don't copy it. Translate the visual idea, not the syntax.
