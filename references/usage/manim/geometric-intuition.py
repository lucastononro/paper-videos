"""
Canonical pattern: 2D plot + a moving object that builds geometric intuition.

Render:  uv run manim -qh references/usage/manim/geometric-intuition.py GeometricIntuition

Use this as the template for any [MANIM: viz_*] cue that visualizes a function,
a vector, or a region (rather than deriving an equation symbolically).
"""

from manim import *
import numpy as np

config.background_color = "#0e1117"


class GeometricIntuition(Scene):
    def construct(self):
        axes = Axes(
            x_range=[-3, 3, 1],
            y_range=[-1, 9, 1],
            axis_config={"color": GREY_B, "stroke_width": 2},
        )
        labels = axes.get_axis_labels(x_label="x", y_label="y")

        graph = axes.plot(lambda x: x ** 2, color=BLUE_C, x_range=[-3, 3])
        graph_label = MathTex(r"y = x^2", color=BLUE_C).next_to(graph, UR)

        self.play(Create(axes), Write(labels))
        self.play(Create(graph), Write(graph_label))
        self.wait(0.5)

        # A moving point that traces the curve
        t = ValueTracker(-2.5)
        dot = always_redraw(
            lambda: Dot(axes.c2p(t.get_value(), t.get_value() ** 2), color=YELLOW_C)
        )
        slope_line = always_redraw(
            lambda: axes.get_secant_slope_group(
                x=t.get_value(), graph=graph, dx=0.001, secant_line_color=RED_C
            )
        )

        self.play(FadeIn(dot), FadeIn(slope_line))
        self.play(t.animate.set_value(2.5), run_time=4, rate_func=linear)
        self.wait(0.6)
        self.play(*[FadeOut(o) for o in [axes, labels, graph, graph_label, dot, slope_line]])
