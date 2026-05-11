---
slug: entropy-6-min-video
voice: pharaoh
target_minutes: 6
---

# Entropy — the average surprise

## Act 0 — Teaser

### beat-001
[MANIM: file=twenty_questions_split.py class=TwentyQuestionsSplit description="1. Show a horizontal number line spanning 1 to 1,000,000 with tick marks at each end. 2. A counter labeled 'Questions' starts at 0. 3. A vertical guide splits the range in half; counter ticks to 1; the unchosen half dims. 4. Repeat the halving — the active range shrinks visibly each step — through 5 splits, counter reaches 5. 5. Hold for 1 second."]
"[curious] Twenty yes-or-no questions can pin down a number between one and a million."

### beat-002
[MANIM: file=twenty_questions_split.py class=TwentyQuestionsSplit description="6. Continue the binary search animation from beat 1: the range halves rapidly through splits 6 through 20, the counter climbing 6, 7, 8 ... 20. 7. The final remaining cell glows gold; counter freezes at 20. 8. Hold for 1.5 seconds."]
"Why exactly twenty?"

### beat-003
[PAUSE 0.6s]
(silent)

### beat-004
[MANIM: file=twenty_to_bits.py class=TwentyToBits description="1. The numeral '20' is centered on screen, large. 2. Below it, the word 'questions' fades in. 3. 'questions' morphs into the word 'bits' with a gentle cross-dissolve. 4. A small caption appears: 'one yes-or-no = one bit'. 5. Hold for 2 seconds."]
"Each answer is one bit. Twenty answers is twenty bits."

### beat-005
[VISUAL: continue]
"[curious] But what kind of quantity is actually measured in bits — and why does a loaded coin somehow carry less of it than a fair one?"

### beat-006
[PAUSE 0.5s]
(silent)

### beat-007
[VISUAL: titleCard "Entropy" subtitle="the average surprise"]
"[serious] Entropy is the average surprise."

## Act 1 — Surprise is information

### beat-008
[MANIM: file=sun_vs_meteor.py class=SunVsMeteor description="1. Left card: a small sun icon with the headline 'The sun rose this morning.' Below it: probability label 'p ≈ 1'. 2. Right card: a meteor streak over a city skyline with headline 'A meteor hit Cleveland.' Below: 'p ≈ 0.0000001'. 3. Both cards present together for 2 seconds. 4. A label 'information' appears under each — left reads 'almost zero', right reads 'enormous'. 5. Hold for 2 seconds."]
"Consider two headlines."

### beat-009
[VISUAL: continue]
"The sun rose this morning. Almost certain. Almost no information."

### beat-010
[VISUAL: continue]
"[emphasized] A meteor hit Cleveland. Wildly unlikely. Enormous information."

### beat-011
[VISUAL: continue]
"So information is something like surprise. Rare events carry a lot of it. Common ones carry almost none."

### beat-012
[VISUAL: continue]
"That's our starting principle. Whatever measures information has to grow when probability shrinks. And we need to pin down the exact relationship."

### beat-013
[MANIM: file=two_dice_log.py class=TwoDiceLog description="1. Two six-sided dice appear side by side, both showing question marks. 2. Below them: 'P(A) = 1/6' and 'P(B) = 1/6'. 3. The dice roll and lock; their joint probability writes itself: P(A and B) = 1/6 times 1/6 = 1/36. 4. Hold for 1.5 seconds."]
"Now imagine two independent events — say, two dice rolls."

### beat-014
[VISUAL: continue]
"Their probabilities multiply. One in six, times one in six, gives one in thirty-six."

### beat-015
[MANIM: file=two_dice_log.py class=TwoDiceLog description="5. Below the multiplication, a second equation fades in: 'surprise(A and B) = surprise(A) + surprise(B)'. 6. Arrows hint that 'multiply on the left' corresponds to 'add on the right'. 7. Hold for 2 seconds."]
"But the surprise of seeing both rolls should just add up. Surprise from the first, plus surprise from the second."

### beat-016
[VISUAL: continue]
"[curious] So we need a function that turns multiplication into addition."

### beat-017
[PAUSE 0.5s]
(silent)

### beat-018
[MANIM: file=log_is_forced.py class=LogIsForced description="1. Center the identity: f(x times y) = f(x) + f(y). 2. Below it, the word 'log' fades in, large. 3. An arrow from the identity to 'log' with a small caption: 'the only continuous function that does this'. 4. Hold for 2 seconds."]
"There is essentially one. The logarithm."

### beat-019
[VISUAL: continue]
"[emphasized] Logarithms turn products into sums. That's their whole job."

### beat-020
[MANIM: file=surprise_formula.py class=SurpriseFormula description="1. Write 'surprise(event with probability p) = log(1 / p)'. 2. Below it write the equivalent form: '= -log p'. 3. A small caption: 'rarer p, bigger surprise'. 4. contour: log(1/p). 5. Hold for 2 seconds."]
"So the surprise of an event with probability p is the log of one over p."

### beat-021
[VISUAL: continue]
"Equivalently, minus log p. The smaller p gets, the bigger the surprise."

## Act 2 — The bit, and the binary entropy curve

### beat-022
[MANIM: file=fair_coin_bit.py class=FairCoinBit description="1. A coin sits center-frame, slowly flipping. 2. Probabilities 'p = 1/2' on heads, 'p = 1/2' on tails. 3. Below the coin, the surprise of either outcome resolves: log_2(1/(1/2)) = log_2(2) = 1. 4. The numeral '1' is highlighted; a label 'bit' attaches. 5. Hold for 2 seconds."]
"Take a fair coin. Heads with probability one half."

### beat-023
[VISUAL: continue]
"The surprise of either outcome is log base two of two — which is exactly one."

### beat-024
[VISUAL: equationCard equationId=eq-001 reveal=stepwise]
"That is where the unit comes from. One bit. One yes-or-no question resolved."

### beat-025
[PAUSE 0.6s]
(silent)

### beat-026
[MANIM: file=loaded_coin_intro.py class=LoadedCoinIntro description="1. A coin is shown weighted on one side, tilted. 2. Probabilities update: p = 0.9 on heads, q = 0.1 on tails. 3. Flip the coin a few times — heads, heads, heads, tails, heads. 4. A thought bubble: 'I basically knew it would be heads.' 5. Hold for 2 seconds."]
"Now bias the coin. Ninety percent heads, ten percent tails."

### beat-027
[VISUAL: continue]
"Most flips are heads. Most flips carry almost no surprise. Only the rare tail tells us anything new."

### beat-028
[VISUAL: continue]
"[curious] So the average surprise of this coin — averaged over many flips — must be less than one bit."

### beat-029
[VISUAL: equationCard equationId=eq-018 reveal=stepwise]
"For a two-outcome coin with probabilities p and q, the average surprise has a name and a formula."

### beat-030
[VISUAL: continue]
"H equals minus, p log p, plus q log q. This is the binary entropy."

### beat-031
[PAUSE 0.5s]
(silent)

### beat-032
[MANIM: file=binary_entropy_curve.py class=BinaryEntropyCurve description="1. Draw axes: horizontal p from 0 to 1, vertical H in bits from 0 to 1. Label both axes. 2. Plot H(p) = -p log_2 p - (1-p) log_2 (1-p) as a smooth blue curve, arching from (0,0) up to a peak at (0.5, 1) and back down to (1,0). 3. Drop a vertical dashed guide at p = 0.5; label 'H = 1 bit' at the peak. 4. Place small coin icons under the axis: a fully-tails coin at p=0, a fair coin at p=0.5, a fully-heads coin at p=1. 5. Hold for 2 seconds."]
"Let's plot it."

### beat-033
[VISUAL: continue]
"On the horizontal axis, the probability p — anywhere from zero to one."

### beat-034
[VISUAL: continue]
"On the vertical axis, the entropy H, measured in bits."

### beat-035
[MANIM: file=binary_entropy_curve.py class=BinaryEntropyCurve description="6. A tracking dot appears at p = 0 on the curve (which sits at H = 0). 7. The dot slides slowly rightward along the arch toward p = 0.5, the y-value rising smoothly to 1.0. 8. As it climbs, a side label reads 'maximum uncertainty'. 9. Hold the dot at the peak for 1.5 seconds."]
"At p equals zero, the coin always lands tails. No surprise, ever. H is zero."

### beat-036
[VISUAL: continue]
"As p grows, the coin becomes less predictable — and surprise grows along with it."

### beat-037
[VISUAL: continue]
"[emphasized] Until p reaches one half. There, the coin is maximally unpredictable. H peaks at exactly one bit."

### beat-038
[MANIM: file=binary_entropy_curve.py class=BinaryEntropyCurve description="10. The tracking dot continues past p = 0.5, sliding rightward toward p = 1. 11. The curve falls symmetrically; the y-value drops back toward 0. 12. The side label updates: 'certain again — surprise vanishes'. 13. Dot lands at (1, 0). 14. Hold for 2 seconds."]
"Push p past one half toward one — and the coin becomes predictable again. Almost always heads."

### beat-039
[VISUAL: continue]
"Entropy falls. Back to zero at p equals one."

### beat-040
[VISUAL: continue]
"[pause] A perfectly symmetric arch."

### beat-041
[MANIM: file=binary_entropy_curve.py class=BinaryEntropyCurve description="15. Highlight the point at p = 0.9, H ≈ 0.47 bits, with a callout pin. 16. A label reads 'loaded 90/10 coin: H ≈ 0.47 bits'. 17. Compare to the peak at p=0.5 with label '1 bit'. 18. Hold for 2.5 seconds."]
"And here is our loaded coin. At p equals zero point nine, entropy is only about zero point four seven bits."

### beat-042
[VISUAL: continue]
"[emphasized] Less than half the information of a fair flip. The teaser's puzzle, solved."

### beat-043
[PAUSE 0.7s]
(silent)

## Act 3 — Generalizing: H = -Σ p log p

### beat-044
[MANIM: file=many_outcomes_intro.py class=ManyOutcomesIntro description="1. Replace the coin with a six-sided die. 2. Below the die, six small bars labeled p_1 through p_6 with varying heights summing to 1. 3. A caption: 'what if there are more than two outcomes?'. 4. Hold for 2 seconds."]
"Two outcomes was just a warm-up. What if a source has many more?"

### beat-045
[VISUAL: continue]
"A die. A letter of the alphabet. A pixel value. Anything with a list of probabilities."

### beat-046
[MANIM: file=expected_surprise_build.py class=ExpectedSurpriseBuild description="1. List outcomes 1 through n in a column. Next to each, write p_i and surprise_i = log(1/p_i). 2. Highlight the i-th row. 3. A label: 'surprise of outcome i = log(1/p_i)'. 4. Hold for 2 seconds."]
"Each outcome has its own surprise — log of one over its probability."

### beat-047
[MANIM: file=expected_surprise_build.py class=ExpectedSurpriseBuild description="5. To the right of the column, build the expectation: weight each surprise_i by p_i. 6. Write the sum: sum over i of p_i times log(1/p_i). 7. contour: p_i times log(1/p_i). 8. Hold for 2 seconds."]
"To get the average surprise, we weight each one by how often it actually shows up."

### beat-048
[VISUAL: continue]
"Then we sum. That is literally the expected value of the surprise across all outcomes."

### beat-049
[MANIM: file=expected_surprise_build.py class=ExpectedSurpriseBuild description="9. Rewrite log(1/p_i) as -log p_i; pull the minus sign out of the sum. 10. Show the final form: H = -sum p_i log p_i. 11. breakdown: the whole expression as 'average surprise'. 12. Hold for 2.5 seconds."]
"Pull the minus sign out front, and you arrive at the formula at the heart of information theory."

### beat-050
[VISUAL: equationCard equationId=eq-111 reveal=stepwise]
"H equals minus, the sum over i of p sub i, times log p sub i."

### beat-051
[VISUAL: continue]
"[emphasized] Entropy is the average surprise."

### beat-052
[PAUSE 0.8s]
(silent)

### beat-053
[VISUAL: equationCard equationId=eq-017 reveal=stepwise]
"Shannon's original paper writes it with a constant K out front — but K just sets the units."

### beat-054
[VISUAL: continue]
"Choose log base two, set K to one, and the answers come out in bits."

### beat-055
[VISUAL: equationCard equationId=eq-111 reveal=stepwise]
"That is the formula. That is all of it."

## Act 4 — Why it matters: compression

### beat-056
[MANIM: file=compression_tape.py class=CompressionTape description="1. A horizontal tape labeled 'one million fair coin flips' fills the screen, divided into a million tiny cells. 2. Below it, the storage cost reads '1,000,000 bits'. 3. H(0.5) = 1 bit is shown to the side. 4. Hold for 2 seconds."]
"So why does this formula matter beyond philosophy?"

### beat-057
[VISUAL: continue]
"A million flips of a fair coin take a million bits to store. One bit per flip. No shortcut."

### beat-058
[MANIM: file=compression_tape.py class=CompressionTape description="5. The tape transforms: now labeled 'one million loaded coin flips, p = 0.9'. 6. The H value updates to ≈ 0.47 bits. 7. The tape visibly shrinks to about 47 percent of its original length. 8. Storage cost reads '≈ 470,000 bits'. 9. Hold for 2.5 seconds."]
"But a million flips of the loaded coin — entropy zero point four seven — can be compressed to roughly four hundred seventy thousand bits."

### beat-059
[VISUAL: continue]
"[emphasized] Less than half the storage. With zero loss."

### beat-060
[PAUSE 0.5s]
(silent)

### beat-061
[MANIM: file=compression_floor.py class=CompressionFloor description="1. A vertical bar labeled 'bits per symbol' with a horizontal line at height H. 2. Below H, the region is shaded red and labeled 'impossible'. 3. Above H, shaded green, labeled 'achievable with enough cleverness'. 4. The line H itself is labeled 'the floor — entropy'. 5. Hold for 2.5 seconds."]
"This is Shannon's deepest result. Entropy is a hard floor."

### beat-062
[VISUAL: continue]
"No matter how clever your encoding, you cannot do better than H bits per symbol on average."

### beat-063
[VISUAL: continue]
"It is why zip files exist. It is why JPEGs work. It is why your phone can compress your voice into something a network can carry."

### beat-064
[PAUSE 0.5s]
(silent)

### beat-065
[MANIM: file=thermo_aside.py class=ThermoAside description="1. Split screen. Left: a swirl of gas molecules in a box with a label 'thermodynamics'. Right: the formula H = -sum p log p with a label 'information'. 2. A single line of text appears between them: 'same shape, two stories'. 3. Hold for 2.5 seconds."]
"And the entropy you might know from physics? Same formula shape. Different story. Both correct."

## Act 5 — Outro: Shannon, 1948

### beat-066
[VISUAL: image src="img-shannon-portrait"]
"This formula has a single author."

### beat-067
[VISUAL: continue]
"Claude Shannon, working at Bell Labs, in nineteen forty-eight."

### beat-068
[VISUAL: continue]
"He called the paper, modestly, A Mathematical Theory of Communication."

### beat-069
[PAUSE 0.6s]
(silent)

### beat-070
[VISUAL: equationCard equationId=eq-111 reveal=all]
"[emphasized] Entropy is the average surprise."

### beat-071
[VISUAL: titleCard "A Mathematical Theory of Communication" subtitle="Claude E. Shannon, 1948"]
(silent 2.5s)
