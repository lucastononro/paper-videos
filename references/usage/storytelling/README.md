# Storytelling — pacing, comprehension, narrative arc

The storyteller subagent's primary reference. Read this before writing `script.md`.

## 1. The shape of a paper video

Five acts, every time:

| Act                  | Purpose                                                                      | % of total time | Tone                   |
| -------------------- | ---------------------------------------------------------------------------- | --------------- | ---------------------- |
| **1. Why care?**     | Hook. The problem this paper attacks, in one image and a short claim.        | 8-12%           | Curious                |
| **2. The setup**     | Background — what existed before, what was missing, what notation we'll use. | 12-18%          | Grounded               |
| **3. The core idea** | The actual technique. Build it up step by step.                              | 35-45%          | Tight, precise         |
| **4. Why it works**  | Intuition + evidence. Why the math behaves. The paper's results.             | 20-25%          | Curious-then-confident |
| **5. Implications**  | What changed because of this paper. Closing card.                            | 8-12%           | Reflective             |

The critic produces this arc with concrete `estSeconds` per act. Your job is to fill it with beats.

## 2. The micro-beat principle

Every visual moment gets its own narration clip. **Don't write monologues.**

Wrong:

> "The Transformer architecture replaces recurrence with attention, which lets it parallelize across sequence positions and capture long-range dependencies that were difficult for RNNs."

Right (split into beats):

- beat-N (manim shows RNN unrolled): "RNNs process sequences one step at a time."
- beat-N+1 (manim shows the bottleneck): "That's slow. And it limits long-range understanding."
- [PAUSE 0.4s]
- beat-N+3 (manim shows attention all-to-all): "Attention lets every position talk to every other — at once."
- beat-N+4 (manim shows parallelization): "And it parallelizes."

Each beat is one short clip. The viewer's eyes follow the visual; the words just confirm what they're seeing.

## 3. Beat length targets

| Beat type               | Words | Seconds |
| ----------------------- | ----- | ------- |
| Hook line               | 4-12  | 1.5-3.5 |
| Setup statement         | 8-20  | 3-6     |
| Equation step narration | 5-15  | 2-4     |
| Pause beat              | 0     | 0.3-1.0 |
| Closing card            | 6-15  | 3-5     |

A 12-minute video typically lands at:

- 120-200 beats total
- ~25-40 of those are pause beats
- ~40-80 are Manim beats (if heavy on derivation)
- ~20-40 are paper-page / quote / image beats
- ~10-20 are equation-card or title-card beats

## 4. Story structure mechanics

### Open with a question or a claim — not a definition

> "What if you could replace recurrence entirely?"
> _not_
> "The Transformer is a sequence-to-sequence model proposed by Vaswani et al. in 2017."

The viewer chose to watch — give them a reason to stay.

### Show, then tell

When introducing a new concept:

1. **Visual lands first** (1 beat with `(silent)` or short framing word).
2. **Words follow the next beat or two**.

If you describe a concept before showing it, the viewer is decoding words while the visual arrives — comprehension drops.

### Repeat important things in different forms

A key formula gets:

- Shown as paper text (1 beat — "this is the formula").
- Stated in words (2-3 beats — "we take Q, dot it with K transpose...").
- Derived in Manim (4-6 beats — geometric/symbolic derivation).
- Restated at the end (1 beat — "and that's all attention is").

The same idea hits the brain four ways. It sticks.

### Use callbacks

Reference earlier beats by visual continuity. When you introduce `softmax` in act 3, light up the same softmax box from act 2's diagram. The brain rewards continuity.

### End each act with a transition beat

A 1-2 second beat with a single sentence summarizing the act and pointing to the next.

> "That's the setup. Now let's actually build the thing."

## 5. Punctuation drives pacing

ElevenLabs respects:

- `,` ≈ 0.15s pause
- `—` or `...` ≈ 0.4s pause
- `.` ≈ 0.5s pause

Use these in the narration text. Never use SSML break tags — Multilingual v2 ignores them.

For longer pauses, use a dedicated `[PAUSE Xs]` beat with `(silent)` narration.

## 6. Math language

The visual carries the symbols; the narration spells them out:

| On screen            | In narration                                 |
| -------------------- | -------------------------------------------- |
| `Q · K^T`            | `Q dot K transpose`                          |
| `\frac{a}{b}`        | `a over b`                                   |
| `\sqrt{d_k}`         | `the square root of d sub k`                 |
| `α, β, θ`            | `alpha, beta, theta`                         |
| `x_1, x_2, ..., x_n` | `x sub one, x sub two, dot dot dot, x sub n` |
| `\nabla f`           | `the gradient of f`                          |
| `\sum_{i=1}^{n}`     | `the sum from i equals one to n`             |
| `1.4142`             | `one point four one four two`                |
| `O(n^2)`             | `big O of n squared`                         |

Never write raw LaTeX in narration text.

## 7. The viewer's emotional arc

| Time  | Viewer feeling              | Storyteller move            |
| ----- | --------------------------- | --------------------------- |
| 0:00  | Curious / skeptical         | Hook with a strong claim    |
| 0:30  | Engaged                     | Show the paper itself       |
| 2:00  | Following along             | Build setup carefully       |
| 5:00  | Slightly tired              | Insert a "let's recap" beat |
| 7:00  | Locked in (if pacing right) | Hit the core derivation     |
| 9:00  | Synthesizing                | Show why it works           |
| 11:00 | Reflective                  | Implications + closing      |

If you don't insert a recap around the 5-minute mark, you'll lose half the audience.

## 8. What the storyteller does NOT do

- Generate audio (producer).
- Write Manim code (visualizer).
- Fetch images (asset-fetcher).
- Pick visual layouts (visualizer).
- Fabricate equations or references (those come from `equations.json` / `references.json` / `brief.json`).

The storyteller writes **intent + words + structure**. Other agents resolve the rest.

## 9. Sanity check before handing off

After writing `script.md`, run through it:

1. Every act from `brief.json` is covered.
2. Total estimated duration within ±10% of `targetLengthMinutes × 60`.
3. Total narration character count fits the user's ElevenLabs plan.
4. Every `[VISUAL: equationStep equationId=...]` and `[VISUAL: equationCard equationId=...]` references a real id in `equations.json`.
5. `[VISUAL: image src=...]` and `[VISUAL: diagram src=...]` ids are stable enough that the asset-fetcher can resolve them (use `img-001`, `diag-001`, etc.).
6. Pause beats are present after every act transition and after every heavy equation.
7. The first beat is a `titleCard` hook. The last beat is a `titleCard` with the paper title + arxiv id.

Print a summary to the orchestrator: act count, beat count, total est seconds, char count.
