---
slug: 5-minutes-paper-melt
voice: pharaoh
target_minutes: 6
---

# MELT — Memory-Efficient Looped Transformer

## Act 0 — Teaser

### beat-001

[MANIM: kv_tax_two_bars description="Two vertical bars side by side on a dark navy canvas. Left bar labeled 'Ouro' grows rapidly from the bottom in pink, filling almost the entire frame, with a number ticking up next to it to '28 GB'. Right bar labeled 'MELT' grows only slightly in orange, stopping near the bottom, with its number reaching '9.5 GB'. Both bars represent VRAM at 32k tokens. Hold the final tableau."]
"[serious] Reasoning models pay a hidden tax. Every extra step of thinking — triples your memory."

### beat-002

[VISUAL: continue]
"On a thirty-two thousand token generation, Ouro burns about twenty-eight gigabytes of VRAM."

### beat-003

[VISUAL: continue]
"[emphasized] MELT does the same iterative reasoning — in under ten."

### beat-004

[PAUSE 0.8s]
(silent)

### beat-005

[MANIM: open_loop_question description="A single line of text fades in centered on dark navy: 'How can looping the same layers four times keep one cache the same size — without accuracy collapsing?' Hold."]
"[curious] How can a model loop its layers four times — and somehow keep one cache the same size as a model that never loops at all?"

### beat-006

[PAUSE 0.6s]
(silent)

### beat-007

[VISUAL: titleCard "MELT" subtitle="Memory-Efficient Looped Transformer — Conchello Vendrell et al., 2026"]
(silent 1.6s)

## Act 1 — The hidden cost of thinking longer

### beat-008

[MANIM: horizontal_vs_vertical_reasoning description="Two stacked panels on dark navy. Top panel labeled 'chain-of-thought' shows a long horizontal sequence of small token boxes streaming left to right, growing the line longer and longer. Bottom panel labeled 'latent reasoning' shows a fixed-width transformer stack but with a curved arrow looping back to the top, repeating four times. Both panels end at the same vertical line marked 'answer'. Hold."]
"[calm] There are two ways to make a language model think harder."

### beat-009

[VISUAL: continue]
"You can let it talk to itself. Generate more tokens, more reasoning, longer chains of thought."

### beat-010

[VISUAL: continue]
"Or — you can let it stay quiet, and just run the same layers again. And again. And again."

### beat-011

[VISUAL: continue]
"[serious] The first costs you output length. The second costs you something less visible."

### beat-012

[PAUSE 0.5s]
(silent)

### beat-013

[VISUAL: paperPage page=1 quote="memory consumption to grow linearly with reasoning depth"]
"The paper puts it bluntly: looping the layers makes memory grow with reasoning depth — linearly."

### beat-014

[VISUAL: continue]
"And that memory lives somewhere very specific."

## Act 2 — What a looped transformer actually does

### beat-015

[MANIM: looped_stack_intro description="On dark navy, draw a vertical stack of N=4 transformer-layer blocks labeled L1, L2, L3, L4, each in a different muted color. A token enters at the bottom and a hidden state arrow flows upward through each block."]
"A standard transformer stacks N layers — one pass, one prediction."

### beat-016

[MANIM: looped_stack_unroll description="The same N=4 stack from the previous beat is duplicated horizontally three more times, all sharing the SAME color-coded blocks (same parameters). The hidden-state arrow now snakes through all T=4 copies in sequence. A label appears: 'same parameters, more compute'."]
"A looped transformer — like Ouro — runs the same stack again. And again. T iterations. Same weights, more compute."

### beat-017

[VISUAL: equationCard equationId=eq-001 reveal=stepwise]
"[slow] One forward pass becomes T forward passes through the same composition M."

### beat-018

[PAUSE 0.5s]
(silent)

### beat-019

[MANIM: where_does_kv_live description="Zoom in on a single layer block from the previous scene. Inside it, highlight the attention sub-block with K and V projection arrows. A small grid labeled 'KV cache' fills with one row per token that's been seen."]
"Now — where does the KV cache live?"

### beat-020

[VISUAL: continue]
"Inside every layer's attention, every token deposits one row: its key, its value. The next token attends to all of them."

### beat-021

[MANIM: kv_grid_2d description="Build a 2D grid of cells on dark navy. Rows = N=4 layers (vertical), columns = L=8 tokens (horizontal). Each cell lights up in muted blue with a tiny K and V symbol as it's filled, row by row. Final shape: a flat sheet, N rows tall, L columns wide. Label: 'O(N x L)' below."]
"For one forward pass — N layers, L tokens — the cache is a flat sheet. N times L rows."

### beat-022

[MANIM: kv_grid_3d description="The same 2D grid from beat-021 is now extruded backward into a third axis — depth T=4. Four parallel sheets stack behind each other in perspective. The volume fills up with translucent cells. Rotate slowly to reveal it as a 3D box. Label: 'O(N x L x T)'."]
"Now loop the stack four times. Every loop appends a fresh row at every layer, at every token."

### beat-023

[VISUAL: continue]
"[emphasized] The cache becomes a box. Not a sheet — a box."

## Act 3 — The bottleneck made concrete

### beat-024

[VISUAL: paperPage page=6 quote="Ouro-1.4B-Thinking"]
"Here is what that box weighs."

### beat-025

[VISUAL: continue]
"[serious] At thirty-two thousand tokens, Ouro's KV cache alone — twenty-five point one seven gigabytes."

### beat-026

[VISUAL: continue]
"Its model weights? Under three. The cache is nearly ten times bigger than the model itself."

### beat-027

[PAUSE 0.6s]
(silent)

### beat-028

[MANIM: three_bars_kv description="Three vertical bars on dark navy, side by side, all starting from a common baseline. Left bar labeled 'Qwen3-1.7B' grows to a small height with the number '3.67 GB'. Middle bar labeled 'MELT-1.6B' grows slightly higher to '6.29 GB' in orange. Right bar labeled 'Ouro-1.4B' shoots up dramatically to '25.17 GB' in pink. All numbers tick up in sync with the bar growth. Hold."]
"Qwen, a standard non-looped model — three point six seven gigabytes. MELT — six point two nine. Ouro — twenty-five."

### beat-029

[VISUAL: continue]
"[pensive] For long reasoning, the cache dwarfs the model. This is why you cannot just keep adding loops."

## Act 4 — MELT's idea: rewrite, don't append

### beat-030

[VISUAL: paperPage page=1 quote="MELT maintains a single KV cache per layer that is shared across reasoning loops"]
"[curious] So MELT does something simple to say — and tricky to make work."

### beat-031

[VISUAL: continue]
"[emphasized] One KV cache per layer. Shared across every loop."

### beat-032

[VISUAL: paperPage page=2 quote="The per-layer KV cache has a fixed size independent of the reasoning depth"]
"The size of the cache no longer depends on how deep you reason."

### beat-033

[PAUSE 0.5s]
(silent)

### beat-034

[MANIM: scratchpad_metaphor description="Two side-by-side scenes on dark navy. Left labeled 'Ouro': a stack of paper sheets grows taller, each new sheet stamped 'loop 1', 'loop 2', 'loop 3', 'loop 4', the stack rising off the desk. Right labeled 'MELT': a single sheet of paper sits in place; an eraser sweeps across it and a hand rewrites it cleanly, four times. Both scenes finish their work simultaneously. Hold."]
"Think of it as two scratchpads."

### beat-035

[VISUAL: continue]
"[conversational] Ouro takes a fresh sheet for every loop — and never throws any of them out."

### beat-036

[VISUAL: continue]
"[emphasized] MELT keeps one sheet. Erases. Rewrites. In place."

### beat-037

[PAUSE 0.6s]
(silent)

### beat-038

[MANIM: melt_kv_collapse description="The 3D box from beat-022 is shown again, briefly. Then the T-axis collapses inward like an accordion until only the original 2D sheet remains. A label morphs from 'O(N x L x T)' to 'O(N x L)'. Hold the flat sheet."]
"That collapses a three-dimensional cache — back into two."

### beat-039

[VISUAL: continue]
"But it raises the obvious question."

### beat-040

[MANIM: question_card_remembering description="Centered text on dark navy: 'If you only keep one cache — how does it remember loop 1 by the time you're at loop 4?' Hold."]
"[curious] If you only keep one cache — how does it remember loop one by the time you're at loop four?"

### beat-041

[PAUSE 0.6s]
(silent)

### beat-042

[MANIM: gate_dials description="On dark navy, draw a horizontal row of 8 vertical sliders, each labeled with a small subscript i. Label above: 'z (one per dimension)'. Each slider's knob shows a value between 0 and 1. Hold."]
"[calm] MELT learns a gate. One per latent dimension — call it z."

### beat-043

[VISUAL: equationCard equationId=eq-002 reveal=stepwise]
"[slow] z is a sigmoid of an affine function of the new input and the old state."

### beat-044

[VISUAL: equationCard equationId=eq-003 reveal=stepwise]
"And the update — is GRU-style. A per-dimension convex combination."

### beat-045

[MANIM: gate_explained description="The equation h_t = z * h_{t-1} + (1-z) * x_t is displayed at the top of the frame using fit_to_frame. breakdown: z * h_{t-1} as 'keep the old state'. Then a second beat slot for breakdown: (1-z) * x_t as 'take the new input'. After both breakdowns, hold the full equation."]
"[emphasized] When z is one — keep the old state."

### beat-046

[VISUAL: continue]
"When z is zero — overwrite with the new input."

### beat-047

[VISUAL: continue]
"In between — a smooth crossfade, dimension by dimension."

### beat-048

[PAUSE 0.5s]
(silent)

### beat-049

[MANIM: ablation_simpler_aggregations description="Four small bar groups across the frame. Each compares MELT's pass@1 (orange, taller) to a variant: Mean, EMA, Last, Single-gated (all pink, shorter). Numbers fade in: AIME24 — MELT 44.8 vs Mean 29, EMA 30, Last 33, Single 34. Title above: 'simpler aggregations fail'. Hold."]
"You might ask — why not just average the loops? Or take the last one?"

### beat-050

[VISUAL: continue]
"[serious] The paper tries every shortcut. All of them drop fifteen points on the hardest math benchmarks."

### beat-051

[VISUAL: continue]
"The learned, per-dimension gate is doing real work."

### beat-052

[PAUSE 0.4s]
(silent)

### beat-053

[VISUAL: equationCard equationId=eq-004 reveal=stepwise]
"Project the latent state through W K and W V — and you get the one key, one value, that everyone attends to."

### beat-054

[VISUAL: image src="paper-md-assets/_page_3_Figure_0.jpeg"]
"That single, gated, rewritten row — is the whole MELT trick."

## Act 5 — Training MELT without breaking it

### beat-055

[MANIM: training_problem_card description="Centered text on dark navy: 'A clean architecture. A model that won't train.' Hold."]
"[pensive] A clean architecture. That, on its own, will not train."

### beat-056

[VISUAL: continue]
"MELT's per-token update is sequential — each token's gate depends on the last."

### beat-057

[VISUAL: image src="paper-md-assets/_page_4_Figure_0.jpeg"]
"So fine-tuning happens in chunks. Trade some parallelism for fidelity to the loop dynamics."

### beat-058

[PAUSE 0.5s]
(silent)

### beat-059

[MANIM: crossfade_dj_metaphor description="Two song waveform graphics side by side on dark navy. Left labeled 'LoopLM (Ouro)' in pink. Right labeled 'MELT' in orange. A horizontal fader slides from left to right; as it moves, the left fades down and the right fades up. Label below: 'alpha: 0 to 1'. Hold."]
"[conversational] And the architecture swap — that's a crossfade, not a cut."

### beat-060

[VISUAL: equationCard equationId=eq-007 reveal=stepwise]
"Phase one. Mix the new MELT key-value stream with Ouro's original — weighted by alpha."

### beat-061

[VISUAL: continue]
"[slow] Alpha climbs from zero to one. The model inherits Ouro's behavior, then slowly drifts toward MELT."

### beat-062

[PAUSE 0.5s]
(silent)

### beat-063

[MANIM: attention_alignment_grid description="On dark navy, draw an N x T grid of small cells (4 layers tall, 4 loops wide). Each cell lights up one by one and shows a tiny equation: ||o_MELT - o_LoopLM||^2. Title above: 'Phase 2: align every layer x every loop'. Hold the fully lit grid."]
"Phase two locks in what was learned. Freeze Ouro. Use it as a teacher."

### beat-064

[VISUAL: continue]
"At every layer — and every loop — pull MELT's post-attention output toward Ouro's."

### beat-065

[VISUAL: equationCard equationId=eq-008 reveal=stepwise]
"[slow] The loss adds a distillation term, averaged over all N layers and all T loops."

### beat-066

[PAUSE 0.5s]
(silent)

### beat-067

[VISUAL: paperPage page=7 quote="eliminating chunk-wise training leads to complete failure"]
"[serious] And one number sells the entire training recipe."

### beat-068

[VISUAL: continue]
"Remove chunk-wise training — keep everything else."

### beat-069

[MANIM: zero_collapse description="A row of six benchmark labels appears horizontally on dark navy: AIME24, AIME25, AIME26, AMC23, MATH500, OlympiadBench. Above each label, a number ticks up to MELT's actual score (~46.7, 33.3, 41.0, 80.2, 93.4, 64.7). Then a red strike-through animation. Each number resets and ticks back DOWN to 0.0. All six end at 0.0. Hold."]
"[emphasized] Accuracy on every benchmark — zero point zero."

### beat-070

[VISUAL: continue]
"The recipe is not optional. It is the paper."

## Act 6 — Does it actually work?

### beat-071

[PAUSE 0.6s]
(silent)

### beat-072

[VISUAL: paperPage page=1 quote="MELT achieves superior performance compared to similarly sized non-looped models, while maintaining an equivalent memory footprint"]
"So — does the architecture earn its keep?"

### beat-073

[VISUAL: image src="paper-md-assets/_page_0_Figure_6.jpeg"]
"This is the figure that lands the trade-off. AIME26 pass at one on the vertical axis. Memory at thirty-two thousand tokens on the horizontal."

### beat-074

[VISUAL: continue]
"Standard models live on the left — cheap memory, lower accuracy. Ouro lives on the right — high accuracy, brutal memory."

### beat-075

[VISUAL: continue]
"[emphasized] MELT — sits in the corner that used to be empty. Cheap memory. Looped-model accuracy."

### beat-076

[PAUSE 0.5s]
(silent)

### beat-077

[MANIM: melt_vs_baselines_summary description="Three rows of horizontal bar charts on dark navy. Row 1 labeled 'AIME26 pass@1': Qwen 31.7, Gemma 36.0, MELT 44.0 (highlighted orange), Ouro 46.7. Row 2 labeled 'MATH-500': similar comparison with MELT at 93.4. Row 3 labeled 'KV at 32k': Qwen 3.67, MELT 6.29, Ouro 25.17 — MELT clearly nearer Qwen than Ouro. Hold."]
"Across the math benchmarks — AIME, AMC, MATH-500 — MELT beats every standard transformer its size."

### beat-078

[VISUAL: continue]
"[calm] It is a hair behind Ouro on the hardest sets. Ouro keeps four times the memory."

### beat-079

[VISUAL: continue]
"MELT keeps roughly the memory of Qwen."

### beat-080

[VISUAL: continue]
"[pensive] Looped-model reasoning. Non-looped-model memory."

## Act 7 — Limits and what's next

### beat-081

[PAUSE 0.5s]
(silent)

### beat-082

[MANIM: limitations_three description="Three short text lines stacked vertically on dark navy, fading in one at a time. Line 1: 'Fixed loop count at inference.' Line 2: 'No MQA — Qwen still ~1.7x cheaper.' Line 3: 'Training is still sequential across tokens.' Hold all three."]
"[serious] Three honest caveats."

### beat-083

[VISUAL: paperPage page=7 quote="the number of recurrent loops is fixed at inference time"]
"One — the number of loops is fixed at inference. No adaptive depth — yet."

### beat-084

[VISUAL: continue]
"Two — MELT does not use Multi-Query Attention. Qwen still wins on raw memory by a factor of one point seven."

### beat-085

[VISUAL: continue]
"Three — training is still sequential across tokens. Chunks help. They are not free."

## Act 8 — Closing

### beat-086

[PAUSE 0.6s]
(silent)

### beat-087

[MANIM: closing_frame description="Centered text on dark navy fades in slowly: 'Compute and memory used to be one knob. MELT pulls them apart.' Hold."]
"[wistful] Scaling a language model used to mean making it bigger — or making it talk longer."

### beat-088

[VISUAL: continue]
"MELT lets it think longer. Inside its own hidden state. At fixed memory."

### beat-089

[PAUSE 0.8s]
(silent)

### beat-090

[VISUAL: titleCard "Memory-Efficient Looped Transformer" subtitle="arXiv 2605.07721 — May 2026"]
(silent 2.0s)
