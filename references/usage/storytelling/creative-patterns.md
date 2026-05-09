# Creative storytelling patterns

A catalog of patterns the storyteller can pick from when planning beats. Use these by name in the brief / script — the visualizer knows them.

## 1. Paper-page highlights

Pull the viewer's eye to the exact spot on the page where the claim lives.

### Pattern: spotlight

A paper page with a dim mask everywhere except a glowing rectangle around the relevant paragraph or equation. Use when:
- A specific sentence in the paper IS the evidence for what the narrator just said.
- An equation lives in the paper at a specific spot you want to anchor.
- You want the viewer to *read* a phrase, not paraphrase it.

Script grammar:
```
[VISUAL: paperPage page=1 focus=top highlight="0.10,0.16,0.80,0.18"]
```

The four numbers are normalized `x,y,w,h` in [0,1] of the page image (top-left origin). Approximate values are fine — the storyteller doesn't need pixel precision. Some common bboxes:

| Region | Approx bbox |
|---|---|
| The abstract block (top of page 1) | `"0.10,0.16,0.80,0.18"` |
| A single equation line (mid page) | `"0.20,0.42,0.60,0.05"` |
| First paragraph of a section | `"0.10,0.30,0.80,0.10"` |
| A figure caption strip | `"0.10,0.55,0.80,0.04"` |
| Bottom-of-page citation | `"0.10,0.85,0.80,0.06"` |

When a beat's narration explicitly quotes the paper, use a `highlightedQuote` instead — the page highlight + the pulled-out text together is much stronger than either alone.

### Pattern: quote pull-out with on-page anchor

Side-by-side: paper page on the left with a bbox highlight, the pulled quote rendered large on the right.

```
[VISUAL: highlightedQuote pageIdx=0 text="The first transduction model relying entirely on self-attention." bbox="0.10,0.18,0.80,0.06"]
```

The viewer reads the quote large while their peripheral vision sees where it lives in the paper. Strong for landmark claims.

### Pattern: walk the page

A sequence of beats, each highlighting a different bbox on the same page, narrated as a guided tour:

```
beat-N    [VISUAL: paperPage page=3 focus=top  highlight="0.10,0.10,0.80,0.06"]  "First, the input embeddings."
beat-N+1  [VISUAL: paperPage page=3 focus=top  highlight="0.10,0.18,0.80,0.06"]  "Then, the multi-head attention block."
beat-N+2  [VISUAL: paperPage page=3 focus=center highlight="0.10,0.30,0.80,0.06"] "And the feed-forward layer."
```

Use when the visual structure of a figure or block diagram in the paper IS the explanation.

## 2. Deductions — multi-beat derivation chains

Don't state a formula. **Build it.** Each step is its own beat with its own narration clip.

### Pattern: from-question derivation

Start with a question. End with the formula as the answer.

```
beat-N    [VISUAL: titleCard "How do we measure similarity?"]
beat-N+1  [MANIM: vec_dot_intro]   "Two vectors. How aligned are they?"
beat-N+2  [MANIM: vec_dot_compute] "Multiply each component, sum them up."
beat-N+3  [MANIM: vec_dot_intuit]  "When they point the same way, the sum is large."
beat-N+4  [VISUAL: equationCard equationId=eq-001 reveal=stepwise]  "That's the dot product."
```

Five beats; the formula lands in beat 5 *as the resolution* of a question that the viewer was tracking from beat 1. Way more memorable than just showing eq-001 with "this is the dot product."

### Pattern: term-by-term reveal

A complex formula, revealed one substring at a time, with narration explaining why each piece is necessary.

```
beat-N    [VISUAL: equationStep equationId=eq-001 step=0]    "Start with the dot product."
beat-N+1  [VISUAL: equationStep equationId=eq-001 step=1]    "Divide by sqrt of d sub k — for stability."
beat-N+2  [VISUAL: equationStep equationId=eq-001 step=2]    "Apply softmax. Now they're weights."
beat-N+3  [VISUAL: equationStep equationId=eq-001 step=3]    "Multiply by V. That's attention."
```

Each step adds one piece. The viewer assembles the formula in their head as the narrator names each new term. (Note: `equationStep` currently renders the same equation as `equationCard` with stepwise reveal — the `step` field is a hook for future fine-grained control.)

### Pattern: prove by contradiction / motivation

Show what goes wrong without the trick. Then introduce the trick as the fix.

```
beat-N    [MANIM: softmax_saturated]    "When d sub k is large, softmax saturates."
beat-N+1  [MANIM: gradient_vanish]      "Gradients vanish. Learning stalls."
beat-N+2  [PAUSE 0.6s]                  (silent)
beat-N+3  [MANIM: scaling_fix]          "Divide by sqrt of d sub k."
beat-N+4  [MANIM: softmax_healthy]      "Now it stays trainable."
```

Use whenever the paper has a "we found that ___ helps" claim. Show the failure, then the fix.

### Pattern: shape the inputs and outputs

Before the formula, show what goes in and what comes out — as boxes, vectors, or matrices with concrete dimensions.

```
beat-N    [MANIM: dim_box_inputs]      "Q is a matrix. n by d."
beat-N+1  [MANIM: dim_box_intermediate] "Their dot product gives an n-by-n score matrix."
beat-N+2  [MANIM: dim_box_output]      "Multiply by V to get n-by-d again."
```

Especially useful for transformers, attention, conv layers — anywhere shape mismatches are common confusions.

## 3. Creative visualizations

Patterns the visualizer can pick from when a beat says `[MANIM: ...]`. Mix-and-match.

### Pattern: object → formula morph

Start with a concrete visual (vectors, shapes), then morph it into the symbolic equivalent.

```python
class ObjectToFormulaMorph(Scene):
    def construct(self):
        vec_a = Arrow(LEFT*2, RIGHT*2, color=BLUE_C)
        vec_b = Arrow(LEFT*2, UR*2, color=YELLOW_C)
        # ... show them, animate angle between
        # then transform into "a · b = |a||b|cos(theta)"
        formula = Text("a · b", font_size=64, color=WHITE)
        self.play(ReplacementTransform(VGroup(vec_a, vec_b), formula))
```

The viewer sees the symbol *come from* the geometric thing.

### Pattern: side-by-side comparison

Two alternative approaches, one on the left, one on the right. Animate them in parallel. Highlight the difference.

Use when the paper says "old way / new way" or "without X / with X".

### Pattern: parameter sweep

A `ValueTracker` controls something; the visual updates continuously as the value changes. Pair narration like "as d sub k grows…" with an actual sweep.

```python
d_k = ValueTracker(2)
bars = always_redraw(lambda: bar_chart_for_dk(d_k.get_value()))
self.add(bars)
self.play(d_k.animate.set_value(64), run_time=4)
```

Use sparingly — works great for *one* sweep per video.

### Pattern: visual metaphor

Borrow imagery from outside ML. Examples:
- Attention as "soft database lookup" — show keys, query, weighted retrieval
- Gradient descent as "rolling down a hill" — show a ball on a 3D loss surface
- Autoregressive generation as "filling in a sentence one word at a time" — show a typewriter
- A neural net layer as "a translation between two languages" — show two coordinate frames

The metaphor is a temporary scaffold. Drop it once the formal idea has landed.

### Pattern: hide the eye-distractors

When showing a multi-step transform, fade the steps the viewer has already seen to 30% opacity so the current step is the focus. Keep the chain visible for context, but visually subordinate.

### Pattern: count the operations

For a paper claiming efficiency, show a literal count of operations. RNN: O(n) sequential steps. Attention: O(1) dependency depth, O(n²) operations in parallel. Make the number on screen.

### Pattern: callback to an earlier beat

When a concept introduced earlier returns, briefly flash the same visual element (same color, same position) before continuing. The viewer's brain rewards continuity.

## 4. When to use which

| The narrator says... | Pattern to reach for |
|---|---|
| "Look at this in the paper..." | Paper-page highlight |
| "The authors claim..." | Highlighted quote (with bbox) |
| "Let's see why..." | Multi-beat deduction (from-question derivation) |
| "First Q, then K, then V..." | Term-by-term reveal |
| "Without scaling..." | Motivation / prove-by-contradiction |
| "Q is a matrix of shape..." | Shape inputs/outputs (Manim block diagram) |
| "It's like a database lookup" | Visual metaphor |
| "As d sub k grows..." | Parameter sweep |
| "Here's the old way / new way" | Side-by-side comparison |
| "Recall from earlier..." | Callback (same color, same position) |

## 5. Avoid

- **One-pattern videos.** A 5-min video that's all paper-pages or all Manim is monotonous. Aim for at least 4 different patterns across the video.
- **Decoration without function.** Every visual moment should answer a question or land a claim. If you can't articulate why this beat exists, cut it.
- **Visualizing the obvious.** A title card saying "Conclusion" is worth less than a strong final claim spoken over a single relevant frame. Don't pad.
- **Abstract metaphors with no anchor.** "Imagine a graph of meaning…" — too vague. Metaphors must be CONCRETE: a typewriter, a database, a ball on a hill.
