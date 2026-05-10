---
slug: video-paper-smaira
voice: pharaoh
target_minutes: 12
---

# End-to-End Learning of Visual Representations from Uncurated Instructional Videos — explainer

## Act 1 — The dream and the dirt

### beat-001
[VISUAL: titleCard "MIL-NCE" subtitle="Learning to see by listening to people who are mostly telling the truth"]
(silent 1.8s)

### beat-002
[VISUAL: paperPage page=1 focus=top]
"[curious] There are roughly one hundred million instructional clips on YouTube."

### beat-003
[VISUAL: continue]
"People narrate as they cook, build, repair. They tell you, in words, what they are doing on screen."

### beat-004
[VISUAL: paperPage page=1 focus=center highlight="0.10,0.34,0.80,0.18"]
"And so a tempting question arises. Could a model learn to see, just by listening to all of that free narration?"

### beat-005
[PAUSE 0.8s]
(silent)

### beat-006
[VISUAL: image src="img-fig1-misalignment"]
"[serious] Here is the catch."

### beat-007
[VISUAL: continue]
"People often describe a thing before they do it. Or after. Or they skip it entirely because it is obvious on screen."

### beat-008
[MANIM: misalignment_timeline description="A horizontal video timeline at top with five thumbnail squares. Below, five text bubbles with narrations. Lines connect each clip to its narration — initially all aligned vertically."]
"Imagine a clip of someone sanding a piece of wood."

### beat-009
[MANIM: misalignment_timeline description="The text bubbles slide horizontally — the bubble that says 'sanding down' drifts five seconds to the right. The connecting line bends and turns red."]
"They say the words 'sanding down' five seconds late."

### beat-010
[MANIM: misalignment_timeline description="A counter appears showing '~50% of pairs misaligned'. Several connector lines flash red as bubbles continue to drift."]
"Roughly half of all clip-narration pairs in the wild are misaligned like this."

### beat-011
[VISUAL: paperPage page=1 focus=bottom highlight="0.08,0.55,0.84,0.20"]
"[serious] This is the problem the paper exists to solve."

### beat-012
[VISUAL: continue]
"They want to learn from the noise — without cleaning it first."

### beat-013
[PAUSE 0.7s]
(silent)

## Act 2 — The setup: a joint embedding space

### beat-014
[VISUAL: titleCard "Two encoders, one room" subtitle="The joint embedding space"]
(silent 1.2s)

### beat-015
[MANIM: meeting_room description="An empty 2D plane with a soft grid (proxy for R^d). A door labeled 'f' sits on the left, a door labeled 'g' on the right. The space is empty."]
"[conversational] Picture a meeting room."

### beat-016
[MANIM: meeting_room description="A video clip thumbnail walks in through the left door labeled f. It lands as a blue dot somewhere in the plane. A short text 'a clip x' floats next to it."]
"Video clips walk in through one door."

### beat-017
[MANIM: meeting_room description="A narration string 'sanding down' walks in through the right door labeled g. It lands as an orange dot in a different spot."]
"Narration sentences walk in through another."

### beat-018
[MANIM: meeting_room_pairs description="Several blue dots (clips) and several orange dots (narrations) appear scattered. Pairs that should match are far apart; non-matching pairs are randomly close."]
"At first, they stand wherever they happen to land."

### beat-019
[VISUAL: equationCard equationId=eq-024 reveal=all]
"The function f maps a video clip into a d-dimensional vector."

### beat-020
[VISUAL: equationCard equationId=eq-026 reveal=all]
"The function g maps a narration into the same space."

### beat-021
[MANIM: meeting_room_training description="Training begins. Matching blue and orange dots drift together; mismatched pairs drift apart. The space slowly organizes into semantic clusters."]
"Training is the choreography that pulls related ones together."

### beat-022
[MANIM: dot_product_intuition description="Two arrows from the origin in R^d. The blue arrow is f(x), the orange arrow is g(y). A dotted projection line shows g(y) projecting onto f(x)."]
"How close is close? They use the dot product."

### beat-023
[MANIM: dot_product_intuition description="The angle between the two arrows shrinks; a numeric score ticker rises. Then the magnitudes grow; the score rises again. Annotation: 'similarity = f(x) dot g(y)'."]
"Aligned arrows give a high score. Perpendicular arrows give zero."

### beat-024
[VISUAL: equationCard equationId=eq-002 reveal=all]
"Exponentiate that score, and you get a quantity proportional to a joint probability."

### beat-025
[VISUAL: continue]
"[calm] How likely is it that this clip and this narration belong together. That is the whole scoring rule."

### beat-026
[PAUSE 0.6s]
(silent)

## Act 3 — The single-positive contrastive recipe

### beat-027
[VISUAL: titleCard "Standard NCE" subtitle="One positive against many negatives"]
(silent 1.0s)

### beat-028
[MANIM: tug_of_war_intro description="The same R^d space. A single blue clip and a single orange narration are connected by a glowing line — the 'true pair'. Around them, several gray pairs are scattered."]
"[curious] We have a scoring rule. Now we need a loss."

### beat-029
[VISUAL: continue]
"We want true pairs to score high, and random pairs to score low."

### beat-030
[MANIM: maxlik_problem description="An equation appears: p(x,y) = e^{score} / Z. The Z term explodes into a giant sum over all clip-narration combinations, with a red strike-through and the word 'intractable'."]
"Maximum likelihood would force us to normalize over every possible pair. Intractable."

### beat-031
[MANIM: nce_metaphor description="Two stacks of bills appear: one labeled 'real', one labeled 'counterfeit'. A magnifying glass moves between them. Caption: 'NCE — train a detector by contrast'."]
"[conversational] So the trick is borrowed from money-counterfeiting."

### beat-032
[VISUAL: continue]
"You don't model what real bills look like in the abstract. You train a detector by showing it real and fake side by side."

### beat-033
[VISUAL: continue]
"The contrast does the work. That is noise contrastive estimation."

### beat-034
[MANIM: nce_numerator description="A fraction begins assembling on screen. The numerator appears: e^{f(x_i) dot g(y_i)} highlighted in blue. The denominator slot is empty."]
"Build the loss in pieces. Numerator — the score of the true pair."

### beat-035
[MANIM: nce_denominator description="The denominator fills in: the same blue term plus a row of red e^{f(x') dot g(y')} terms, drawn from sampled negative pairs."]
"Denominator — the same true pair, plus a sea of negatives."

### beat-036
[MANIM: nce_softmax description="The fraction is now complete and labeled 'softmax over (1 + |N|) candidates'. A log wraps the whole thing."]
"That is a softmax. The true pair has to win, against the crowd."

### beat-037
[VISUAL: equationCard equationId=eq-004 reveal=all]
"Take the log, sum across all training pairs. That is the standard NCE loss."

### beat-038
[VISUAL: paperPage page=5 focus=center highlight="0.18,0.16,0.64,0.10"]
"[calm] Here it is in the paper. Equation four."

### beat-039
[MANIM: nce_tug_of_war description="In the embedding space, the blue clip and orange true narration get pulled together by a blue spring. Red negatives are pushed away by repulsive arrows."]
"Geometrically — the true pair gets pulled tight, the negatives get pushed away."

### beat-040
[VISUAL: continue]
"That is the entire engine of contrastive learning."

### beat-041
[PAUSE 0.7s]
(silent)

### beat-042
[MANIM: wrong_positive description="In the same embedding space, a blue clip is wired to an orange narration that is clearly unrelated — the narration label is 'next step coming up' over a clip of someone sanding."]
"[serious] But now stress-test it."

### beat-043
[MANIM: wrong_positive_pull description="The training step pulls the unrelated pair together — the blue and orange dots collide. Meanwhile, the actually-correct pair, sitting elsewhere, gets pushed apart."]
"What if the so-called positive is actually wrong?"

### beat-044
[VISUAL: continue]
"The loss does not know. It pulls the encoder confidently in the wrong direction."

### beat-045
[MANIM: wrong_positive_red_x description="A large red X appears over the gradient arrow connecting the wrongly-paired dots. Caption: 'confidently wrong gradient'."]
"And with about half the YouTube data misaligned, this is not a corner case. It is the average case."

### beat-046
[PAUSE 0.9s]
(silent)

## Act 4 — The MIL trick: a bag of plausible positives

### beat-047
[VISUAL: titleCard "MIL-NCE" subtitle="Don't pick one. Keep K."]
(silent 1.2s)

### beat-048
[MANIM: bag_intro description="Re-use the misalignment timeline. The chosen clip is highlighted at the center. A sliding window covers the K=5 nearest narrations in time."]
"[curious] Here is the move."

### beat-049
[VISUAL: continue]
"Don't pick one narration as the positive. Pick the K closest in time and call them all candidates."

### beat-050
[MANIM: bag_bracket description="A large curly bracket wraps the K=5 narrations. Above the bracket: the symbol P_i. Caption: 'the bag of positives'."]
"Call this set P sub i — the bag."

### beat-051
[VISUAL: image src="img-fig2a-bag"]
"[calm] The paper draws it like this."

### beat-052
[VISUAL: paperPage page=3 focus=top highlight="0.08,0.10,0.42,0.30"]
"Five candidate pairs, one bag. Some will match the clip. Most will not. We do not know which."

### beat-053
[MANIM: police_lineup description="A police lineup with five suspects standing in a row. A witness silhouette stands behind a one-way mirror. A speech bubble: 'one of these five is the suspect, but I'm not sure which'."]
"[conversational] Think of a police lineup."

### beat-054
[MANIM: police_lineup_compare description="Split screen. Left: standard NCE forces the witness to point at exactly one suspect — and the pointing finger lands on the wrong person. Right: MIL-NCE — the witness says 'one of them' and the entire lineup glows."]
"Standard NCE forces the witness to pick exactly one. They will often be wrong."

### beat-055
[MANIM: police_lineup_compare description="Continue right side. The lineup as a whole gets a high score because at least one suspect is a strong match. A green checkmark over the bag."]
"MIL-NCE lets the bag as a whole speak. If any one of the five is a strong match, the whole bag scores high."

### beat-056
[PAUSE 0.7s]
(silent)

### beat-057
[VISUAL: titleCard "From OR to SUM" subtitle="The probability move"]
(silent 0.8s)

### beat-058
[MANIM: or_to_sum_intro description="Five disjoint Venn-style blobs labeled (x, y_1) through (x, y_5). Each blob is a different shade of green. The blobs do not overlap."]
"[curious] We want the probability that the clip x matches at least one narration in the bag."

### beat-059
[VISUAL: continue]
"In set language — the probability of the union."

### beat-060
[MANIM: or_to_sum_assumption description="Caption fades in: 'assumption: at most one (x, y_k) is the true pair'. A bracket labels the blobs as 'mutually exclusive'."]
"[serious] Now the key assumption. At most one pair in the bag is the actually-true one."

### beat-061
[VISUAL: continue]
"That is what the paper means when it says the candidates are mutually exclusive. Worth flagging — the paper hand-waves this."

### beat-062
[MANIM: or_to_sum_disjoint description="Because the blobs are disjoint, the area of their union equals the sum of their individual areas. An equation appears below: P(union) = sum of P(each)."]
"For disjoint events, the probability of the union is just the sum of the individual probabilities."

### beat-063
[MANIM: or_to_sum_translate description="Each blob's area transforms into an exponential term e^{f(x) dot g(y_k)}. The sum equation rewrites itself in terms of the embedding scores."]
"And each individual probability is e to the dot-product of the embeddings."

### beat-064
[VISUAL: equationCard equationId=eq-003 reveal=all]
"So the probability of any-of-them lands as a sum of exponentials over the bag."

### beat-065
[VISUAL: continue]
"[emphasized] This is the load-bearing line of the whole paper."

### beat-066
[PAUSE 0.8s]
(silent)

### beat-067
[VISUAL: titleCard "Plug it in" subtitle="The numerator becomes a sum"]
(silent 0.8s)

### beat-068
[VISUAL: equationCard equationId=eq-004 reveal=all]
"Go back to the standard NCE objective."

### beat-069
[MANIM: substitution description="Equation eq-004 on screen. The numerator e^{f(x_i) dot g(y_i)} pulses blue, then physically detaches from the fraction and floats to the side."]
"Look at the numerator. A single exponential. The score of one positive pair."

### beat-070
[MANIM: substitution description="The single term morphs into a sum: Σ over (x,y) in P_i of e^{f(x) dot g(y)}. The new sum slides into the slot the old numerator vacated."]
"Replace it. With the sum we just derived — over the whole bag."

### beat-071
[MANIM: substitution description="The denominator is highlighted briefly to confirm it is unchanged. Caption: 'denominator: same negatives, plus the bag itself'."]
"The denominator stays the same. Negatives are still negatives."

### beat-072
[VISUAL: equationCard equationId=eq-001 reveal=stepwise]
"And what falls out is MIL-NCE."

### beat-073
[VISUAL: continue]
"The numerator — a sum over the bag P sub i."

### beat-074
[VISUAL: continue]
"The denominator — that same sum, plus the negatives N sub i."

### beat-075
[VISUAL: continue]
"Wrapped in a log, summed over training samples. That is the entire objective."

### beat-076
[VISUAL: paperPage page=4 focus=center highlight="0.18,0.18,0.64,0.10"]
"[emphasized] And here it is in the paper. Equation one."

### beat-077
[VISUAL: continue]
"One symbol changed. A single exponential became a sum of exponentials."

### beat-078
[PAUSE 1.0s]
(silent)

### beat-079
[VISUAL: image src="img-fig2b-diagram"]
"[calm] The geometry — green triangles are the bag, red squares are the negatives."

### beat-080
[VISUAL: paperPage page=3 focus=top highlight="0.52,0.10,0.40,0.30"]
"The loss maximizes the ratio of green-bag-mass to red-negative-mass."

## Act 5 — Why the sum, and not the max

### beat-081
[VISUAL: titleCard "Why sum and not max?" subtitle="A gradient argument"]
(silent 1.0s)

### beat-082
[MANIM: max_alternative description="The MIL-NCE numerator on screen. A new alternative pops up beside it: max over the bag, instead of sum. Caption: 'Max+NCE — pick the best candidate, ignore the rest.'"]
"[curious] A natural objection. Why not just take the best candidate from the bag?"

### beat-083
[VISUAL: equationCard equationId=eq-006 reveal=all]
"That alternative has a name. Max plus NCE."

### beat-084
[VISUAL: continue]
"Numerator equals the largest single score in the bag. Sounds smarter — it commits."

### beat-085
[MANIM: gradient_max description="A bag of K candidates as small dots. A gradient arrow flows backward only through the single highest-scoring candidate. The other four sit gray and inert."]
"But here is what max actually does to the gradient."

### beat-086
[VISUAL: continue]
"All the learning signal flows through one candidate per step. The other four contribute nothing."

### beat-087
[MANIM: gradient_sum description="Same bag of K candidates. Now five gradient arrows flow back, one through each candidate, weighted by softmax-of-current-scores. Each arrow has a thickness proportional to its weight."]
"Sum is different. The gradient flows through every candidate, weighted by its current score."

### beat-088
[VISUAL: continue]
"[serious] In a noisy bag, max can latch onto the wrong winner early and never recover."

### beat-089
[VISUAL: continue]
"Sum hedges. It lets the model figure out, over training, which candidate is really right."

### beat-090
[MANIM: attn_alternative description="A third panel: Attn+NCE. A weighted average inside the numerator, attention weights computed by a separate cross-modal block. Most weight ends up on one candidate."]
"There is a third option — attention-weighted. Most of the weight still ends up on one candidate. Same problem."

### beat-091
[VISUAL: paperPage page=6 focus=top highlight="0.12,0.45,0.40,0.18"]
"[calm] And the ablation agrees. Table 2d."

### beat-092
[VISUAL: continue]
"MIL-NCE beats max. Beats attention. Across most downstream tasks."

### beat-093
[PAUSE 0.7s]
(silent)

### beat-094
[VISUAL: paperPage page=6 focus=center highlight="0.55,0.50,0.42,0.20"]
"And how big should the bag be? Table 2c sweeps it."

### beat-095
[VISUAL: paperPage page=6 focus=center highlight="0.62,0.055,0.37,0.22" zoom=true]
"Going from one candidate to five — a big jump. Past five — diminishing returns. They settle on K equals five."

## Act 6 — What this buys you

### beat-096
[VISUAL: titleCard "No labels. Better numbers." subtitle="The empirical payoff"]
(silent 1.0s)

### beat-097
[VISUAL: paperPage page=7 focus=center highlight="0.55,0.18,0.42,0.40"]
"[curious] The headline result. Table three."

### beat-098
[VISUAL: continue]
"They train from scratch on uncurated YouTube. No human labels. Anywhere."

### beat-099
[VISUAL: continue]
"Then they freeze the encoder and test on action recognition benchmarks."

### beat-100
[MANIM: results_bar_chart description="A bar chart with three bars on HMDB-51 accuracy. Bar 1: prior self-supervised SOTA. Bar 2: fully-supervised on Kinetics. Bar 3: 'Ours, no labels' — the tallest, highlighted gold."]
"On HMDB-51 — they beat every prior self-supervised method."

### beat-101
[MANIM: results_bar_chart description="Bars rearrange. New chart for UCF-101. Same pattern: 'Ours' is tallest, sitting next to the supervised baseline."]
"On UCF-101 — same story."

### beat-102
[VISUAL: paperPage page=8 focus=top highlight="0.45,0.10,0.30,0.18"]
"And the Kinetics-700 finetune comparison."

### beat-103
[VISUAL: continue]
"[serious] Pretraining on uncurated YouTube outperforms pretraining on ImageNet labels."

### beat-104
[VISUAL: continue]
"On the same backbone. Same finetuning recipe. Just a better starting point."

### beat-105
[VISUAL: image src="img-fig3-retrieval"]
"[calm] And qualitatively — given a clip, the model retrieves narrations that genuinely describe what is happening."

### beat-106
[VISUAL: continue]
"From a soundtrack the model was never told to trust."

### beat-107
[PAUSE 0.9s]
(silent)

## Act 7 — Why this matters beyond MIL-NCE

### beat-108
[VISUAL: titleCard "The lesson" subtitle="Soften the positive"]
(silent 1.0s)

### beat-109
[MANIM: lesson_recap description="Two side-by-side panels. Left: 'Standard recipe — clean the data, keep one positive'. Right: 'MIL-NCE recipe — keep all plausible positives, let the loss decide'."]
"[pensive] Step back from MIL-NCE for a moment."

### beat-110
[VISUAL: continue]
"The conventional move with noisy supervision is to clean it. Filter, align, throw out the bad pairs."

### beat-111
[VISUAL: continue]
"This paper does the opposite. It keeps the mess and softens the loss."

### beat-112
[MANIM: lesson_generalize description="Three boxes appear: 'attention', 'mixture models', 'Boltzmann distributions'. Arrows from a central 'soft any' label point to all three."]
"And summing-instead-of-maxing — that pattern shows up everywhere. Attention. Mixture models. Boltzmann distributions."

### beat-113
[VISUAL: continue]
"A soft 'any' beats a hard 'argmax' whenever you do not know which option is right."

### beat-114
[PAUSE 1.0s]
(silent)

### beat-115
[MANIM: closing_recap description="The misalignment timeline returns. Then the bag of K positives slides over it. Then the MIL-NCE equation appears beneath. The whole video's spine in one frame."]
"[wistful] One paper. One symbol changed."

### beat-116
[VISUAL: continue]
"A hundred million unlabeled YouTube clips, turned into a video representation that beats labels."

### beat-117
[PAUSE 0.8s]
(silent)

### beat-118
[VISUAL: titleCard "End-to-End Learning of Visual Representations from Uncurated Instructional Videos" subtitle="Miech, Alayrac, Smaira, Laptev, Sivic, Zisserman — arXiv:1912.06430"]
(silent 2.5s)
