"""
Canonical pattern: explain an equation by pointing at its parts.

Render:  uv run manim -qh references/usage/manim/equation-explanation.py EquationExplanation

Two reusable helpers live at the top of this file. Paste them into every Manim
scene that explains an equation (alongside `fit_to_frame`). They are the
visualizer's main tool for syncing what the narrator names with what the viewer
sees:

  - `contour_flash(scene, mob)`   — soft rounded rectangle traces around `mob`,
    holds, fades. Use when narration *names* a sub-expression in passing
    ("the softmax here", "this denominator").

  - `explain_part(scene, equation, part, label)` — the sub-expression slides
    left, scales up, shows a short label, then slides back. Use when narration
    *unpacks* the sub-expression for 3+ seconds.

Both helpers expect `equation` to be a `MathTex` built from a sequence of
tex strings (so individual parts are indexable as `equation[i]`) OR a regular
`MathTex` whose substrings can be addressed by `get_parts_by_tex(r"...")`.

CLAUDE.md hard-rule #25 mandates one of these whenever the narration dwells on
a named sub-expression. The 3b1b discipline is: never let the viewer wonder
which symbol the voice is talking about.
"""

from manim import *

config.background_color = "#0e1117"


# ---------- Helpers (paste into every equation-explanation scene file) ----------

def fit_to_frame(mob, w_ratio=0.85, h_ratio=0.85):
    """Scale a Mobject down (never up) so it fits the frame with margins.
    Idempotent: a second call is a no-op if the mobject is already small enough."""
    max_w = config.frame_width * w_ratio
    max_h = config.frame_height * h_ratio
    sx = max_w / mob.width if mob.width > max_w else 1.0
    sy = max_h / mob.height if mob.height > max_h else 1.0
    s = min(sx, sy)
    if s < 1.0:
        mob.scale(s)
    return mob


def contour_flash(
    scene,
    mob,
    *,
    color=YELLOW,
    run_time=0.4,
    hold=1.2,
    fade_time=0.35,
    corner_radius=0.12,
    buff=0.10,
    stroke_width=4,
):
    """Trace a rounded `SurroundingRectangle` around `mob`, hold, fade out.

    Use when the narration *names* a sub-expression in passing. The rectangle
    appears in ~0.4s, sits for `hold` seconds, then fades over ~0.35s. Total
    ≈ 2s — short enough to fit inside a single voice beat without dragging.

    Returns True if drawn, False if `mob` is empty (no submobjects, no points).
    """
    if mob is None:
        return False
    has_points = bool(getattr(mob, "submobjects", [])) or (
        hasattr(mob, "has_points") and mob.has_points()
    )
    if not has_points:
        return False
    box = SurroundingRectangle(
        mob,
        color=color,
        corner_radius=corner_radius,
        buff=buff,
        stroke_width=stroke_width,
    )
    scene.play(Create(box), run_time=run_time)
    scene.wait(hold)
    scene.play(FadeOut(box), run_time=fade_time)
    return True


def explain_part(
    scene,
    equation,
    part,
    label,
    *,
    hold=3.5,
    dest=LEFT * 2.8 + UP * 0.4,
    scale_factor=1.6,
    label_color=YELLOW_C,
    dim_opacity=0.30,
    slide_in_time=0.7,
    slide_out_time=0.5,
):
    """Pull `part` out of `equation`, scale up, show `label`, slide back.

    `part` is either:
      - a sub-mobject already extracted, e.g. `equation[2]` or
        `equation.get_parts_by_tex(r"\\softmax")`
      - or a string, in which case we resolve it via
        `equation.get_parts_by_tex(part)`.

    `label` is a short string (3-6 words) rendered as `Tex` below the
    magnified copy. `hold` is the time (seconds) the viewer sees the
    breakdown before it slides back into the equation.

    Returns True if drawn, False if the selector resolved to nothing.
    """
    if isinstance(part, str):
        resolved = equation.get_parts_by_tex(part)
    else:
        resolved = part
    if not resolved:
        return False
    try:
        if len(resolved) == 0:
            return False
    except TypeError:
        # A single mobject (e.g. `equation[2]`) — fine, fall through.
        pass

    # Everything in the equation that ISN'T the part: dimmed.
    part_set = set(resolved) if hasattr(resolved, "__iter__") else {resolved}
    rest = VGroup(*[p for p in equation.submobjects if p not in part_set])

    # Magnified copy lands at `dest`.
    magnified = resolved.copy().scale(scale_factor).move_to(dest)
    label_mob = Tex(label, color=label_color).scale(0.7).next_to(magnified, DOWN, buff=0.35)

    scene.play(
        rest.animate.set_opacity(dim_opacity),
        TransformFromCopy(resolved, magnified),
        FadeIn(label_mob, shift=UP * 0.2),
        run_time=slide_in_time,
    )
    scene.wait(hold)
    scene.play(
        rest.animate.set_opacity(1.0),
        FadeOut(magnified),
        FadeOut(label_mob),
        run_time=slide_out_time,
    )
    return True


# ---------- Worked example ----------

class EquationExplanation(Scene):
    """Walk through softmax(s)_i = exp(s_i) / sum_j exp(s_j) with the helpers.

    Voice timeline this scene is built for (~16 seconds, matches a 4-beat block):
      1. "Softmax turns a vector of scores into a probability distribution."   [4s]
      2. "The numerator is exp of the i-th score —"                            [3s]
      3. "— normalized by the total exponentiated score across the vector."    [4s]
      4. "Every output sums to one."                                           [3s]

    Beats 2 and 3 are the moments where the viewer needs to know exactly which
    symbol is meant — beat 2 uses `contour_flash` (passing reference); beat 3
    uses `explain_part` (sustained unpacking).
    """

    def construct(self):
        # Build the equation as separately-addressable pieces so we can target
        # the numerator and denominator without `get_parts_by_tex` ambiguity.
        # The four-piece split: lhs, '=', numerator, '\over', denominator.
        eq = MathTex(
            r"\mathrm{softmax}(s)_i",   # 0
            r"=",                        # 1
            r"\exp(s_i)",                # 2  ← numerator
            r"\over",                    # 3
            r"\sum_j \exp(s_j)",         # 4  ← denominator
        )
        fit_to_frame(eq)
        eq.set_color_by_tex(r"\exp(s_i)", BLUE_C)
        eq.set_color_by_tex(r"\sum_j", BLUE_C)

        # --- Beat 1: introduce the whole equation (4s) ---
        self.play(Write(eq), run_time=1.4)
        self.wait(2.6)

        # --- Beat 2: passing reference to the numerator (3s) ---
        # contour_flash takes ~2s total (0.4 + 1.2 + 0.35); the 0.5s extra
        # `self.wait` lets the voice land before the next animation begins.
        numerator = eq[2]
        contour_flash(self, numerator)
        self.wait(0.5)

        # --- Beat 3: unpack the denominator (4s) ---
        # explain_part takes 0.7 + hold + 0.5 ≈ 4.5s with hold=3.3.
        denominator = eq[4]
        explain_part(
            self,
            eq,
            denominator,
            r"sum over every score in the vector",
            hold=3.0,
        )

        # --- Beat 4: held tableau (3s) ---
        # Final state: the whole equation, undimmed, visible. The composition
        # will hold this frame for any remaining block time.
        self.wait(2.5)  # extended via CLAUDE.md hard-rule #14 (no FadeOut).
