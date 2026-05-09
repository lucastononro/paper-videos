---
slug: attention-is-all-you-need
voice: pharaoh
target_minutes: 5
---

# Attention Is All You Need — explainer

## Act 1 — Why care?

### beat-001
[VISUAL: titleCard "Attention Is All You Need" subtitle="Vaswani et al., 2017"]
(silent)

### beat-002
[VISUAL: paperPage page=1 focus=top highlight="0.20,0.06,0.60,0.06"]
"In 2017, eight researchers at Google published a quiet bombshell."

### beat-003
[PAUSE 0.5s]
(silent)

### beat-004
[VISUAL: highlightedQuote pageIdx=0 text="The first transduction model relying entirely on self-attention, without recurrence or convolution." bbox="0.10,0.20,0.80,0.10"]
"This was the claim."

### beat-005
[PAUSE 0.6s]
(silent)

### beat-006
[VISUAL: titleCard "No recurrence." subtitle="No convolution. Just attention."]
(silent)

## Act 2 — The setup

### beat-007
[MANIM: rnn_sequential]
"For years, sequence models meant recurrence. Each step waiting for the last."

### beat-008
[PAUSE 0.4s]
(silent)

### beat-009
[MANIM: rnn_long_path]
"To connect position one to position one hundred, you walked through every step in between. Slow. And gradients faded over long distances."

### beat-010
[PAUSE 0.6s]
(silent)

### beat-011
[MANIM: qkv_intro]
"The Transformer drops the chain entirely. It uses three new objects."

### beat-012
[MANIM: qkv_labels]
"Q, the queries. K, the keys. V, the values."

### beat-013
[PAUSE 0.5s]
(silent)

### beat-014
[MANIM: qkv_lookup]
"Think of it as a soft, differentiable database lookup."

### beat-015
[PAUSE 0.6s]
(silent)

## Act 3 — The core idea

### beat-016
[VISUAL: titleCard "Scaled Dot-Product Attention"]
(silent)

### beat-017
[VISUAL: equationCard equationId=eq-001 reveal=all]
"Here's the formula. Let's build it from scratch."

### beat-018
[PAUSE 0.5s]
(silent)

### beat-019
[MANIM: dot_product_scores]
"Take a query Q. And a set of keys K. The dot product of Q with each key gives a similarity score."

### beat-020
[PAUSE 0.4s]
(silent)

### beat-021
[MANIM: scaling_step]
"Divide each score by the square root of d sub k. We'll see why in a moment."

### beat-022
[MANIM: softmax_step]
"Pass the scaled scores through softmax. Now they sum to one. They are weights."

### beat-023
[PAUSE 0.5s]
(silent)

### beat-024
[MANIM: weighted_sum_step]
"Use those weights to take a weighted sum of the values V. That's the output. That's all attention is."

### beat-025
[PAUSE 0.7s]
(silent)

### beat-026
[VISUAL: equationCard equationId=eq-001 reveal=all]
"Q dot K transpose, scaled, softmaxed, multiplied by V."

### beat-027
[PAUSE 0.6s]
(silent)

## Act 4 — Why it works

### beat-028
[VISUAL: titleCard "Why divide by the square root of d sub k?"]
(silent)

### beat-029
[MANIM: scaling_intuition]
"When d sub k is large, dot products grow. Softmax then saturates on the largest score. Gradients vanish."

### beat-030
[MANIM: scaling_intuition_fix]
"Scaling by the square root of d sub k keeps the variance in check. Softmax stays sharp but trainable."

### beat-031
[PAUSE 0.6s]
(silent)

### beat-032
[MANIM: parallel_attention]
"And here is the kicker. Every position attends to every other position, all in parallel. Long-range connections are one operation away."

### beat-033
[PAUSE 0.6s]
(silent)

## Act 5 — Implications

### beat-034
[VISUAL: paperPage page=10 focus=top]
"This single mechanism replaced two decades of recurrent architecture."

### beat-035
[VISUAL: paperPage page=10 focus=center]
"It powers GPT. BERT. Almost every modern language model."

### beat-036
[PAUSE 0.6s]
(silent)

### beat-037
[VISUAL: titleCard "Attention is all you need." subtitle="(it really is)"]
(silent)

### beat-038
[VISUAL: titleCard "Vaswani et al., 2017" subtitle="arxiv.org/abs/1706.03762"]
(silent)
