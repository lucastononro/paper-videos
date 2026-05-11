---
slug: a-new-perspective-to-xgboost
voice: pharaoh
target_minutes: 10
---

# Script — a-new-perspective-to-xgboost

## Act 0 — Teaser

### beat-001
[MANIM: scene="act0-kaggle-number" description="1. Pitch-black canvas. 2. The text '17 / 29' fades in at the center, set in a heavy serif, and grows slowly to fill a third of the frame. 3. A thin caption appears below in light gray: 'Kaggle competitions won, 2015'. 4. Hold the tableau."]
"In 2015, a single algorithm won seventeen of twenty-nine published Kaggle competitions."

### beat-002
[VISUAL: continue]
"It was written by one PhD student."

### beat-003
[MANIM: scene="act0-not-a-better-tree" description="1. The '17 / 29' shrinks to the top-left corner. 2. Centered, three small decision trees fade in side-by-side. 3. A red diagonal line is drawn through all three, crossing them out gently. 4. Hold the tableau."]
"[serious] And the trick wasn't a better tree."

### beat-004
[PAUSE 0.8s]
(silent)

### beat-005
[MANIM: scene="act0-function-space-wireframe" description="1. The crossed-out trees fade away. 2. A faint 3D wireframe surface rotates slowly into view, suggesting an abstract curved space. 3. A small caption hovers near the surface: 'function space'. 4. Hold the rotation."]
"[curious] What if I told you that every leaf of every XGBoost tree is the minimum of a parabola you can literally draw —"

### beat-006
[VISUAL: continue]
"— and that the algorithm's entire job is to find a cut where two clouds of gradients disagree the most?"

### beat-007
[PAUSE 0.6s]
(silent)

### beat-008
[VISUAL: titleCard "A New Perspective on XGBoost" subtitle="Boosting as a journey through function space"]
(silent 1.8s)

## Act 1 — Origins

### beat-009
[MANIM: scene="act1-timeline-1996" description="1. A horizontal timeline appears with three tick marks: 1996, 2001, 2014. 2. The 1996 tick lights up. 3. Above it, the text 'AdaBoost — Freund and Schapire' fades in."]
"[calm] The story starts in 1996, with AdaBoost."

### beat-010
[VISUAL: diagram src="diag-adaboost-weighted-vote"]
"Three weak classifiers, each voting on the answer — but with different weights."

### beat-011
[VISUAL: continue]
"Get a sample wrong? Its weight goes up. The next learner pays more attention to it."

### beat-012
[VISUAL: continue]
"That was the picture for five years. Boosting as weighted voting."

### beat-013
[PAUSE 0.7s]
(silent)

### beat-014
[MANIM: scene="act1-timeline-2001" description="1. The timeline reappears. 2. The 2001 tick lights up. 3. Above it, the text 'Jerome Friedman — gradient boosting' fades in. 4. A small portrait placeholder sits beside the label."]
"Then in 2001, Jerome Friedman did something strange."

### beat-015
[VISUAL: image src="img-friedman-portrait"]
"He looked at boosting and said: this isn't voting."

### beat-016
[VISUAL: continue]
"[emphasized] This is gradient descent."

### beat-017
[PAUSE 0.6s]
(silent)

### beat-018
[MANIM: scene="act1-friedman-insight" description="1. The screen splits in two. 2. Left side shows a familiar 2D loss surface with an arrow stepping down the slope, labeled 'gradient descent'. 3. Right side shows an abstract wireframe space with a single bold arrow pointing into it, labeled 'gradient descent in function space'. 4. The right side glows brighter. 5. Hold."]
"[serious] Not gradient descent on weights. Gradient descent in a space of functions."

### beat-019
[VISUAL: continue]
"Each step — each new tree — moves the model through that space."

### beat-020
[VISUAL: continue]
"This is the spine of everything that follows. Sit with it."

### beat-021
[PAUSE 0.9s]
(silent)

### beat-022
[MANIM: scene="act1-timeline-2014" description="1. The timeline returns. 2. The 2014 tick lights up. 3. Above it, the text 'Tianqi Chen — XGBoost' fades in. 4. A portrait placeholder appears."]
"Fast forward to 2014. A PhD student at the University of Washington."

### beat-023
[VISUAL: image src="img-chen-portrait"]
"Tianqi Chen took Friedman's idea and engineered it."

### beat-024
[MANIM: scene="act1-three-innovations" description="1. Three numbered cards stack vertically. 2. Card 1: 'Keep the second-order term — curvature, not just slope.' 3. Card 2: 'Regularize the trees explicitly — gamma and lambda.' 4. Card 3: 'Brutal engineering — sparsity, cache, parallel splits.' 5. Each card fades in in sequence. 6. Hold."]
"Three changes. Second-order curvature. Explicit regularization. And brutal engineering."

### beat-025
[VISUAL: continue]
"[calm] The result was XGBoost. And in 2015, it won everything."

### beat-026
[PAUSE 0.5s]
(silent)

### beat-027
[MANIM: scene="act1-transition-to-function-space" description="1. The three innovation cards fade out. 2. The wireframe function-space surface from act 0 returns, larger this time, rotating slowly. 3. Hold."]
"[curious] But to feel why XGBoost works, we have to live in Friedman's idea for a while."

### beat-028
[VISUAL: continue]
"We have to learn what function space looks like."

## Act 2 — Function space

### beat-029
[MANIM: scene="act2-fourier-axes" description="1. A clean 2D plane fades in. 2. The horizontal axis is labeled sin(x). 3. The vertical axis is labeled sin(2x). 4. A single point appears at coordinates (a, b)."]
"[calm] Imagine a plane. The horizontal axis is the function sine of x."

### beat-030
[VISUAL: continue]
"The vertical axis is sine of two x."

### beat-031
[VISUAL: continue]
"A single point on this plane — at coordinates a and b — represents one specific curve."

### beat-032
[MANIM: scene="act2-fourier-curve-from-point" description="1. The plane with the point at (a, b) is shown on the left half. 2. On the right half, a curve is drawn: a times sin(x) plus b times sin(2x). 3. The point on the plane wiggles, and the curve on the right morphs in sync. 4. Hold."]
"That curve is a times sine of x, plus b times sine of two x."

### beat-033
[VISUAL: continue]
"Move the point — the curve changes shape."

### beat-034
[VISUAL: continue]
"Every point on this plane is a different function."

### beat-035
[PAUSE 0.7s]
(silent)

### beat-036
[VISUAL: continue]
"[emphasized] The plane itself is a function space."

### beat-037
[MANIM: scene="act2-add-third-axis" description="1. The 2D plane tilts back into perspective. 2. A third axis pops out, labeled sin(3x). 3. The point now lives in three dimensions. 4. Hold."]
"Add a third axis — sine of three x. Now we have a three-dimensional function space."

### beat-038
[VISUAL: continue]
"Add a fourth. A fifth. Infinitely many."

### beat-039
[VISUAL: continue]
"Fourier showed that every reasonable periodic function lives somewhere in this infinite space."

### beat-040
[PAUSE 0.7s]
(silent)

### beat-041
[MANIM: scene="act2-break-the-analogy" description="1. The Fourier axes labeled sin(x), sin(2x), sin(3x) fade away. 2. In their place, three tiny decision-tree icons appear as the new axes. 3. The space is no longer a clean grid — the axes are at irregular angles. 4. A caption appears: 'XGBoost basis: trees, not sines.'"]
"[curious] Now break the analogy. In XGBoost, the axes are not sines."

### beat-042
[VISUAL: continue]
"Each axis is a tiny decision tree."

### beat-043
[VISUAL: continue]
"The basis isn't fixed in advance. It's built up, one tree at a time, greedily."

### beat-044
[PAUSE 0.6s]
(silent)

### beat-045
[VISUAL: equationCard equationId="eq-001" reveal="all"]
"Here is the model. The prediction y-hat is a sum of K functions — K trees."

### beat-046
[MANIM: scene="act2-tree-as-basis-vector" description="1. The equation y-hat = sum f_k stays at the top. 2. Below it, three trees are drawn in a row, labeled f_1, f_2, f_3. 3. Arrows point from each tree into a single function-space point that lights up at the end. 4. Hold."]
"Don't read this as 'a stack of trees.'"

### beat-047
[VISUAL: continue]
"[emphasized] Read it as a vector in function space, written in a learned basis."

### beat-048
[PAUSE 0.8s]
(silent)

### beat-049
[MANIM: scene="act2-greedy-step" description="1. Wireframe function-space surface returns. 2. A starting point at the origin labeled 'y-hat zero'. 3. A short arrow extends out, labeled f_1. 4. A new point appears at the arrow's tip. 5. Hold."]
"Training begins with a prediction of zero. A single point at the origin of function space."

### beat-050
[VISUAL: continue]
"Then we add the first tree. The point moves."

### beat-051
[VISUAL: continue]
"Then the second tree. It moves again."

### beat-052
[MANIM: scene="act2-polyline-forming" description="1. The function-space wireframe with the starting point. 2. A polyline of six segments grows segment-by-segment, each labeled f_1, f_2, ... f_6. 3. The path descends toward a low point on the surface. 4. Hold the tableau."]
"Each tree is one step. The ensemble is a polyline — a jagged path through function space."

### beat-053
[VISUAL: continue]
"Descending. Always descending. Toward the minimum of the loss."

### beat-054
[PAUSE 0.9s]
(silent)

### beat-055
[VISUAL: continue]
"[curious] But how do we choose each step?"

### beat-056
[VISUAL: continue]
"That's where the real surprise lives."

## Act 3 — The parabola trick

### beat-057
[VISUAL: equationCard equationId="eq-003" reveal="all"]
"[calm] At round t, here is the objective we want to minimize."

### beat-058
[VISUAL: continue]
"The loss of the previous ensemble, plus a new tree f_t."

### beat-059
[VISUAL: continue]
"For most losses — log loss, squared error, anything realistic — this is hard to optimize directly."

### beat-060
[PAUSE 0.6s]
(silent)

### beat-061
[MANIM: scene="act3-loss-curve-and-tangent-parabola" description="1. A blue wiggly loss curve l(y, prediction) is drawn across the canvas. 2. A vertical dashed line marks the current prediction at one data point. 3. A red parabola is drawn tangent to the blue curve at that point, matching slope and curvature. 4. Hold."]
"So XGBoost does something clever. It replaces the loss with a parabola."

### beat-062
[VISUAL: continue]
"[emphasized] One parabola, at every single data point."

### beat-063
[MANIM: scene="act3-parabola-with-g-and-h" description="1. The blue loss curve and red parabola from the previous scene. 2. A small g_i label points to the slope of the tangent line. 3. A small h_i label points to the curvature. 4. The formula 'parabola = g_i times f plus one-half h_i times f squared' appears below. 5. Hold."]
"The parabola is set by two numbers."

### beat-064
[VISUAL: continue]
"g sub i — the slope of the loss at that point."

### beat-065
[VISUAL: continue]
"h sub i — its curvature."

### beat-066
[VISUAL: equationCard equationId="eq-004" reveal="stepwise"]
"And here is the rewritten objective. The Taylor expansion to second order."

### beat-067
[MANIM: scene="act3-drop-constant" description="contour: l(y_i, y-hat^(t-1)). 1. The full eq-004 is shown. 2. A rounded surrounding rectangle traces the constant term l(y_i, y-hat^(t-1)). 3. The traced term fades to gray, then disappears entirely, leaving the simplified eq-005."]
"The first term is a constant — it doesn't depend on the new tree, so we drop it."

### beat-068
[VISUAL: equationCard equationId="eq-005" reveal="all"]
"What's left is the simplified per-round objective."

### beat-069
[VISUAL: continue]
"A sum, over every data point, of a parabola in the new tree's output."

### beat-070
[PAUSE 0.7s]
(silent)

### beat-071
[MANIM: scene="act3-many-points-many-parabolas" description="1. The loss curve with five red parabolas, each tangent at a different data point along the prediction axis. 2. Each parabola is labeled with its (g_i, h_i). 3. Hold."]
"[curious] Now picture this for the whole dataset. Every data point gets its own parabola."

### beat-072
[VISUAL: continue]
"Each one tangent to the true loss at that point's current prediction."

### beat-073
[PAUSE 0.6s]
(silent)

### beat-074
[MANIM: scene="act3-leaf-grouping" description="1. A small decision tree is drawn in the corner. 2. Three of the five parabolas from the previous scene are highlighted and grouped together. 3. A line connects them to a single leaf of the tree, labeled 'leaf j'. 4. A caption: 'these three points land in the same leaf'. 5. Hold."]
"Now we add the tree. Every data point falls into a leaf."

### beat-075
[VISUAL: continue]
"Inside one leaf, all the points share a single output value: w sub j."

### beat-076
[MANIM: scene="act3-summing-parabolas" description="1. The three parabolas grouped for leaf j fade together into a single, fatter parabola. 2. A new equation appears below it: '(sum g_i) times w_j plus one-half (sum h_i) times w_j squared'. 3. The minimum of the summed parabola is marked with a glowing dot. 4. Hold."]
"[emphasized] And here is the magic. The sum of parabolas is itself a parabola."

### beat-077
[VISUAL: continue]
"A bigger, deeper bowl made of all the local curvatures stacked together."

### beat-078
[VISUAL: equationCard equationId="eq-006" reveal="stepwise"]
"Written out per leaf, the objective looks like this."

### beat-079
[MANIM: scene="act3-eq006-explain" description="breakdown: (sum h_i + lambda) w_j^2 as 'leaf bowl curvature'. 1. eq-006 is shown. 2. The term (sum h_i + lambda) is slid to the side, scaled 1.6x, with the label 'leaf bowl curvature' below it. 3. Hold."]
"Sum the gradients in the leaf — call it big G. Sum the curvatures, plus lambda — call it big H."

### beat-080
[VISUAL: continue]
"Now the leaf's contribution is a parabola in w sub j alone."

### beat-081
[PAUSE 0.6s]
(silent)

### beat-082
[VISUAL: continue]
"[curious] And a parabola has a closed-form minimum."

### beat-083
[MANIM: scene="act3-newton-step" description="1. The single fat leaf parabola is shown. 2. A horizontal dashed line at the parabola's bottom. 3. A vertical dashed line from the bottom up to a label on the horizontal axis: 'w_j*'. 4. Hold."]
"Take the derivative. Set it to zero. Solve for w sub j."

### beat-084
[VISUAL: equationCard equationId="eq-007" reveal="all"]
"And out falls this formula. The optimal leaf weight."

### beat-085
[MANIM: scene="act3-eq007-contour-denominator" description="contour: H_j + lambda. 1. eq-007 is shown. 2. A rounded contour traces the denominator H_j + lambda. 3. Hold the contour for two seconds, then fade."]
"Negative big G over big H, plus lambda."

### beat-086
[VISUAL: continue]
"[serious] This is not a formula to memorize."

### beat-087
[VISUAL: continue]
"It is the bottom of a bowl we just drew."

### beat-088
[PAUSE 1.0s]
(silent)

### beat-089
[MANIM: scene="act3-lambda-effect" description="breakdown: lambda as 'ridge — flattens to zero'. 1. The leaf parabola is shown with lambda = 0; the minimum is marked. 2. Lambda increases; the parabola gets steeper; the minimum drifts toward zero. 3. The label 'ridge regression on the leaf' fades in. 4. Hold."]
"And lambda? Watch what it does. Bigger lambda — the bowl gets steeper. The minimum drifts toward zero."

### beat-090
[VISUAL: continue]
"This is ridge regression. Acting on the leaf weight."

### beat-091
[PAUSE 0.7s]
(silent)

### beat-092
[VISUAL: continue]
"[wistful] Every leaf of every XGBoost tree is a one-dimensional Newton step on a parabola you can literally draw."

## Act 4 — Splits as gradient disagreement

### beat-093
[VISUAL: equationCard equationId="eq-008" reveal="all"]
"[calm] If we plug the optimal w sub j back in, we get the value of the whole tree."

### beat-094
[MANIM: scene="act4-similarity-score" description="breakdown: G_j^2 / (H_j + lambda) as 'similarity score s(I_j)'. 1. eq-008 is shown. 2. The term G_j^2 / (H_j + lambda) is slid out, scaled 1.6x, labeled 'similarity score'. 3. Hold."]
"Each leaf contributes a term: big G squared, over big H plus lambda."

### beat-095
[VISUAL: continue]
"Call this the similarity score of the leaf."

### beat-096
[PAUSE 0.5s]
(silent)

### beat-097
[MANIM: scene="act4-gradient-cloud" description="1. A 2D scatter of about thirty points appears. 2. Each point is colored: red points have positive gradient (pull up), blue points have negative gradient (pull down). 3. The points are intermixed. 4. Hold."]
"Now imagine the data. Each point has a gradient — a direction it wants the model to move."

### beat-098
[VISUAL: continue]
"Red points pull up. Blue points pull down."

### beat-099
[MANIM: scene="act4-similarity-meaning" description="1. The scattered points are enclosed in one circle labeled 'leaf I'. 2. Below, a single number 'similarity = G^2 / (H + lambda)' grows. 3. When points are mostly one color (aligned), the number is large; when mixed, it shrinks. 4. Hold on the large-number version."]
"[emphasized] If a leaf's points all pull in the same direction, the gradients add up. Similarity is high."

### beat-100
[VISUAL: continue]
"If they pull against each other, the gradients cancel. Similarity is low."

### beat-101
[VISUAL: continue]
"Similarity measures how coherently the gradients agree."

### beat-102
[PAUSE 0.8s]
(silent)

### beat-103
[MANIM: scene="act4-bad-split" description="1. The intermixed cloud of red and blue points. 2. A vertical line cuts the cloud roughly in half. 3. Both halves remain mixed red and blue. 4. Two bars at the bottom show 'similarity_left' and 'similarity_right' — both small. 5. Hold."]
"So what should a split do? A bad split cuts through the mess — both sides still mixed."

### beat-104
[VISUAL: continue]
"Both similarity scores stay small. Nothing was gained."

### beat-105
[MANIM: scene="act4-good-split" description="1. The same cloud, now arranged so that red points cluster on the right and blue on the left. 2. A vertical cut separates them cleanly. 3. Two bars at the bottom: similarity_left tall (pure blue), similarity_right tall (pure red). 4. Hold."]
"[curious] A good split separates the colors. Reds on one side, blues on the other."

### beat-106
[VISUAL: continue]
"Both new similarity scores are large. The gradients in each side now agree."

### beat-107
[PAUSE 0.6s]
(silent)

### beat-108
[VISUAL: equationCard equationId="eq-009" reveal="stepwise"]
"Subtract the parent's similarity from the sum of the children's, and you get the gain."

### beat-109
[MANIM: scene="act4-eq009-walkthrough" description="contour: s(I_L). 1. eq-009 is shown. 2. A contour traces the left-side term s(I_L). 3. Hold."]
"Similarity of the left side —"

### beat-110
[MANIM: scene="act4-eq009-walkthrough-2" description="contour: s(I_R). 1. eq-009 is shown. 2. A contour traces the right-side term s(I_R). 3. Hold."]
"— plus similarity of the right —"

### beat-111
[MANIM: scene="act4-eq009-walkthrough-3" description="contour: s(I). 1. eq-009 is shown. 2. A contour traces the parent term. 3. Hold."]
"— minus the parent's similarity —"

### beat-112
[MANIM: scene="act4-eq009-walkthrough-4" description="contour: gamma. 1. eq-009 is shown. 2. A contour traces the lone gamma at the end. 3. Hold."]
"— minus gamma."

### beat-113
[PAUSE 0.6s]
(silent)

### beat-114
[VISUAL: continue]
"[serious] That gamma is not a regularization mystery. It's a toll booth."

### beat-115
[MANIM: scene="act4-gamma-toll-booth" description="1. A sequence of five candidate splits with gain bars of varying heights. 2. A horizontal red line marks gamma. 3. Splits below the line are crossed out. 4. As gamma rises, more splits get crossed out. 5. The remaining tree shrinks. 6. Hold."]
"Every new leaf costs gamma. The split happens only if the gain in similarity pays the toll."

### beat-116
[VISUAL: continue]
"Low gamma — every road is open. The tree grows sprawling and baroque."

### beat-117
[VISUAL: continue]
"High gamma — only the most profitable cuts survive. The tree stays short and fat."

### beat-118
[PAUSE 0.8s]
(silent)

### beat-119
[VISUAL: continue]
"[wistful] Finding the best split is no longer brute-force search."

### beat-120
[VISUAL: continue]
"It is asking, geometrically: where do the gradients disagree most?"

## Act 5 — The journey, traced

### beat-121
[MANIM: scene="act5-replay-function-space" description="1. The wireframe function-space surface from act 2 returns. 2. The starting point at the origin is labeled y-hat zero. 3. Hold for a beat before any motion."]
"[calm] Now we can replay the whole picture."

### beat-122
[VISUAL: continue]
"We started at a prediction of zero. A point at the origin of function space."

### beat-123
[MANIM: scene="act5-step-by-step-journey" description="1. The function-space surface with starting point. 2. For each of six steps: compute gradients and curvatures (visualized as tiny colored arrows scattered briefly), find the best split (a tiny tree icon flashes in the corner), drop a Newton step into each leaf (the tree fills in), then a new segment of the polyline extends. 3. Six segments labeled f_1 through f_6. 4. The path descends toward a marked low point labeled L*. 5. Hold on the completed polyline."]
"At every round, three things happen."

### beat-124
[VISUAL: continue]
"One — at every data point, we compute the gradient and the curvature of the loss."

### beat-125
[VISUAL: continue]
"Two — we search for splits where the gradients disagree most, paying gamma per leaf."

### beat-126
[VISUAL: continue]
"Three — inside each leaf, we take a one-dimensional Newton step, shrunk by lambda."

### beat-127
[VISUAL: continue]
"That tree becomes f sub t. We add it to the ensemble. The point moves."

### beat-128
[PAUSE 0.7s]
(silent)

### beat-129
[VISUAL: continue]
"Then we do it again. And again."

### beat-130
[VISUAL: continue]
"There's one more knob — eta, the learning rate. It shrinks every step, deliberately weakening each tree."

### beat-131
[VISUAL: continue]
"So the next tree has work to do."

### beat-132
[PAUSE 0.6s]
(silent)

### beat-133
[MANIM: scene="act5-final-tableau" description="1. The completed polyline through function space, all six segments labeled. 2. The final point sits near a low marked L*. 3. A caption fades in: 'every tree is one step. every step is found by asking where the gradients disagree.' 4. Hold on this tableau — this is the closing image of the synthesis."]
"[emphasized] Every tree is one step. Every step is found by asking where the gradients disagree."

### beat-134
[VISUAL: continue]
"[wistful] That is XGBoost."

### beat-135
[PAUSE 1.0s]
(silent)

## Act 6 — Closing

### beat-136
[MANIM: scene="act6-what-we-skipped" description="1. A clean dark canvas. 2. A short bulleted list fades in line-by-line: 'sparsity-aware splits', 'histogram approximation', 'cache-aware blocks', 'column subsampling', 'system engineering'. 3. The bullets stay; a gray strikethrough crosses each one. 4. Hold."]
"[conversational] We did not cover sparsity-aware splits, the histogram approximation, cache-aware blocks, or the engineering that made it fast."

### beat-137
[VISUAL: continue]
"That is a whole other video. Maybe a whole other library."

### beat-138
[PAUSE 0.6s]
(silent)

### beat-139
[VISUAL: continue]
"[pensive] We covered one thing — the geometry."

### beat-140
[VISUAL: continue]
"Trees as basis vectors. Leaves as Newton steps. Splits as gradient disagreement."

### beat-141
[VISUAL: continue]
"A journey through function space."

### beat-142
[PAUSE 0.9s]
(silent)

### beat-143
[VISUAL: titleCard "A New Perspective on XGBoost" subtitle="Chen and Guestrin, KDD 2016 — arXiv:1603.02754"]
(silent 2.5s)
