"""
Canonical pattern: derive an equation step by step using MathTex transforms.

Render:  uv run manim -qh references/usage/manim/equation-derivation.py EquationDerivation

Use this as the template for any [MANIM: derive_*] cue. The narrator gives you
a sequence of LaTeX strings (always sourced from videos/<slug>/equations.json
or quoted directly from the script). You write each rewrite and play a transform.
"""

from manim import *

config.background_color = "#0e1117"


class EquationDerivation(Scene):
    def construct(self):
        # Always start from a state the narration explicitly says.
        steps = [
            r"y = (x + 1)^2",
            r"y = (x + 1)(x + 1)",
            r"y = x^2 + 2x + 1",
            r"\frac{dy}{dx} = 2x + 2",
        ]

        prev = MathTex(steps[0], color=BLUE_C).scale(1.4)
        self.play(Write(prev))
        self.wait(0.6)

        for s in steps[1:]:
            curr = MathTex(s, color=YELLOW_C).scale(1.4)
            curr.move_to(prev.get_center())
            # TransformMatchingTex keeps shared symbols stable
            self.play(TransformMatchingTex(prev, curr, run_time=1.2))
            self.wait(0.5)
            prev = curr

        self.wait(0.4)
        self.play(FadeOut(prev))
