---
slug: fireship-style-performers
voice: pharaoh
target_minutes: 3
---

# Rethinking Attention with Performers — Fireship cut

## Act 0 — Teaser

### beat-001
[MANIM: scene="big_o_n_squared_pulse" steps="(1) Black canvas. (2) The text 'O(n^2)' slams in, huge, white. (3) It pulses red twice. (4) A small subtitle appears below: 'attention.' (5) Hold."]
"Attention is O(n squared)."

### beat-002
[MANIM: scene="memory_blowup_bars" steps="(1) Three bar-chart bars labeled 1k, 16k, 64k tokens. (2) The 1k bar is tiny. (3) 16k is medium. (4) 64k explodes off the top of the screen, turns red, leaves the frame."]
"Double the tokens — quadruple the compute. Square the memory."

### beat-003
[VISUAL: paperPage page=1 quote="scales quadratically with the number of tokens"]
"That wall is why your context window is eight thousand, not eight million."

### beat-004
[VISUAL: paperPage page=1 quote="linear (as opposed to quadratic) space and time complexity"]
"Performers tear it down. With a kernel trick from 2007."

### beat-005
[MANIM: scene="open_loop_question_card" steps="(1) Black canvas. (2) Text fades in: 'how do you skip an L-by-L matrix...' (3) Second line fades in below: '...without computing it?' (4) Hold."]
"How do you skip an L-by-L matrix without ever computing it?"

### beat-006
[VISUAL: titleCard "PERFORMERS" subtitle="attention, but linear"]
"[emphasized] Performers. Attention, but linear."

## Act 1 — The O(n^2) wall

### beat-007
[VISUAL: equationStep equationId=eq-001 step=0]
"Standard attention. Softmax of Q K transpose, times V."

### beat-008
[VISUAL: continue]
"That middle term — A — is L by L."

### beat-009
[MANIM: scene="L_by_L_matrix_grows" steps="(1) A small grid labeled 'A: L x L' appears. (2) L=1k — grid is fine. (3) L=16k — grid swells, fills screen. (4) L=64k — grid floods red, overflowing. (5) Caption: 'one matrix. one head. one layer.'"]
"L is your sequence length. Sixteen thousand tokens? That's a quarter-billion entries."

### beat-010
[VISUAL: continue]
"Per attention head. Per layer. Just to hold the scores."

### beat-011
[VISUAL: paperPage page=2 quote="incompatible with end-to-end processing of long sequences" zoom=true]
"The paper's words, not mine."

### beat-012
[MANIM: scene="bottleneck_recap_card" steps="(1) Bold text: 'O(L^2 d) compute' (2) Below: 'O(L^2) memory' (3) Both glow red. (4) Hold."]
"O of L squared d compute. O of L squared memory. That's the wall."

### beat-013
[VISUAL: continue]
"Every long-context paper since 2018 has been a workaround. Sparsity. Sliding windows. Hashing tricks."

### beat-014
[VISUAL: continue]
"Performers don't sparsify. They keep softmax full-rank — and just refuse to write the matrix down."

## Act 2 — The kernel trick

### beat-015
[MANIM: scene="kernel_metaphor_card" steps="(1) Left side: a giant grid labeled 'lookup table'. (2) Right side: a small box labeled 'hash function'. (3) Arrow from left to right. (4) Caption fades in: 'don't materialize. fingerprint.'"]
"Forget materializing the matrix. Give every token a fingerprint instead."

### beat-016
[VISUAL: equationStep equationId=eq-003 step=0]
"Any kernel can be written as the expected dot product of two feature maps, phi."

### beat-017
[VISUAL: continue]
"[emphasized] Softmax is a kernel."

### beat-018
[VISUAL: equationStep equationId=eq-006 step=0]
"Drop the square root of d. The softmax kernel is just exp of x dot y."

### beat-019
[VISUAL: paperPage page=4 quote="positive random feature map unbiased approximation" zoom=true]
"And there's an identity that rewrites that exp as an expectation."

### beat-020
[VISUAL: equationStep equationId=eq-007 step=0]
"Sample omega from a Gaussian. Read off phi of x — exp of omega-transpose x, minus half x squared."

### beat-021
[VISUAL: continue]
"Positive. Bounded. Unbiased."

### beat-022
[MANIM: scene="sin_cos_blows_up" steps="(1) Two curves on axes. (2) Sin/cos curve oscillates near zero — labeled 'classical features: variance explodes'. (3) Exp curve stays smooth and positive — labeled 'positive features: well-behaved'. (4) Caption: 'this is the contribution.'"]
"Classical sin-cos features blow up near zero. Exp doesn't. That's the paper's actual fix."

## Act 3 — The linear-time rewrite

### beat-023
[MANIM: scene="kernel-trick" steps="(1) Three labeled blocks appear in a row: [phi(Q): L x r]  [phi(K)^T: r x L]  [V: L x d]. (2) Parens slide in around the first two: '(phi(Q) phi(K)^T) V'. The middle product highlights as 'L x L' in red. (3) The parens slide right, regrouping: 'phi(Q) (phi(K)^T V)'. The new middle product highlights green as 'r x d'. (4) Dimension labels appear under each block: nowhere does L x L appear. (5) Final card: 'O(L r d) — linear in L.' Hold."]
"Same equation. Move the parentheses."

### beat-024
[VISUAL: continue]
"Group it left — phi-Q times phi-K-transpose first — and you rebuild the L by L matrix. Quadratic."

### beat-025
[VISUAL: continue]
"Group it right — phi-K-transpose times V first — and the middle is r by d. Independent of L."

### beat-026
[VISUAL: equationStep equationId=eq-004 step=0]
"That's Equation 4. The brackets are the trick."

### beat-027
[VISUAL: continue]
"O of L r d. [emphasized] Linear."

### beat-028
[VISUAL: paperPage page=6 quote="forward and backward pass speed" zoom=true]
"On the same GPU: eight thousand tokens choking becomes sixty-four thousand, fine."

### beat-029
[PAUSE 0.6s]
(silent)

## Act 4 — The fine print

### beat-030
[VISUAL: paperPage page=1 quote="provable accuracy" zoom=true]
"It's an approximation. But provably unbiased."

### beat-031
[MANIM: scene="favor_plus_callout" steps="(1) Text: 'FAVOR+' big and bold. (2) Below in smaller type: 'Fast Attention Via positive Orthogonal Random features'. (3) Tiny note: 'orthogonal omega-samples cut variance further.' (4) Hold."]
"FAVOR+ adds orthogonal samples. Lower variance. Same idea."

### beat-032
[VISUAL: paperPage page=1 quote="fully compatible" zoom=true]
"Drop-in compatible with pretrained Transformers. Small finetune. Done."

### beat-033
[VISUAL: titleCard "Rethinking Attention with Performers" subtitle="arxiv.org/abs/2009.14794"]
(silent 1.8s)
