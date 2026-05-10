---
slug: regressions-made-simple
voice: pharaoh
target_minutes: 11
---

# Regressions, Made Simple — explainer

## Act 1 — The seed: a line through points

### beat-001
[VISUAL: titleCard "Regressions, Made Simple" subtitle="Eight models. One idea."]
(silent 1.8s)

### beat-002
[MANIM: scatter_dots_appear]
"[curious] Imagine a cloud of points. Each one is a measurement of something you care about — and you want a rule that explains them."

### beat-003
[MANIM: journey_strip_stop_1]
"We are about to take a journey through eight models. Eight stops. And by the end, they will all be the same idea."

### beat-004
[VISUAL: continue]
"Stop one. The simplest possible thing — a line."

### beat-005
[MANIM: line_through_scatter]
"A line has two knobs. A slope. An intercept. Pick those two numbers and the line is decided."

### beat-006
[VISUAL: equationCard equationId=eq-001 reveal=all]
"y equals w times x, plus b. Slope w. Intercept b. The whole model."

### beat-007
[MANIM: line_wiggling_searching]
"[curious] But which line? They can't all be the best. We need a definition of best."

### beat-008
[PAUSE 0.7s]
(silent)

### beat-009
[MANIM: residuals_red_segments]
"Drop a vertical segment from every point to the line. That gap is the model's mistake on that point. The residual."

### beat-010
[VISUAL: continue]
"[calm] Square each one. Average them. That single number is what we want to make small."

### beat-011
[VISUAL: equationCard equationId=eq-002 reveal=stepwise]
"The mean squared error. The average of squared mistakes."

### beat-012
[MANIM: mse_tax_metaphor]
"Think of it as a tax on disagreement. Small mistakes barely cost anything. Big mistakes cost a lot more."

### beat-013
[MANIM: line_sliding_to_optimum]
"Slide the line. Watch the total red shrink. The minimum is the best fit."

### beat-014
[VISUAL: continue]
"[emphasized] That's it. That's regression."

### beat-015
[PAUSE 0.8s]
(silent)

### beat-016
[MANIM: residuals_perpendicular_reveal]
"And there is a hidden picture worth seeing. At the optimum, the residuals are perpendicular to the fit. The best line is an orthogonal projection of the data."

### beat-017
[VISUAL: continue]
"[pensive] Hold that thought. Every model in this video is a variation on this one image."

## Act 2 — More dimensions, then bent dimensions

### beat-018
[MANIM: journey_strip_stop_2]
"[conversational] Stop two. Houses don't depend only on size. They depend on size, location, age, neighborhood. We need many slopes at once."

### beat-019
[MANIM: scatter_3d_with_plane]
"Now each input is a vector. Many features. The line becomes a plane — and in higher dimensions, a hyperplane."

### beat-020
[VISUAL: equationCard equationId=eq-003 reveal=all]
"y hat equals w transpose x plus b. Same shape as before. Just more knobs."

### beat-021
[MANIM: matrix_anatomy_reveal]
"Stack every data point as a row. Stack every feature as a column. You get the matrix X — and a single line of math swallows the whole dataset."

### beat-022
[VISUAL: continue]
"[calm] What your eyes can't see, the matrix can."

### beat-023
[VISUAL: equationCard equationId=eq-004 reveal=all]
"Setting the gradient of MSE to zero gives a closed-form answer. The normal equations. The optimal weights, in one line."

### beat-024
[MANIM: journey_strip_stop_3]
"Stop three. A plane is still flat. But a lot of the world isn't."

### beat-025
[MANIM: curved_data_line_misses]
"Reaction time versus drug dose. Horsepower versus fuel efficiency. These curve. A line will systematically miss them."

### beat-026
[MANIM: polynomial_features_reveal]
"[curious] So here's a trick. Don't change the model. Change the inputs."

### beat-027
[VISUAL: equationCard equationId=eq-005 reveal=all]
"Replace x with x, x squared, x cubed, and so on. Now linear in the new features means polynomial in the original x."

### beat-028
[MANIM: degree_zoo_curves]
"Same regression. Different ingredients. A line. A parabola. A cubic. A degree-nine swoosh."

### beat-029
[VISUAL: continue]
"[emphasized] It's still linear regression. We just gave it richer food."

### beat-030
[MANIM: degree_9_monster_through_points]
"And now look at the degree-nine curve. It passes through every training point. Training error — zero."

### beat-031
[MANIM: degree_9_held_out_disaster]
"[serious] Then we drop in a held-out point. The curve misses by a comical margin."

### beat-032
[PAUSE 0.8s]
(silent)

### beat-033
[VISUAL: continue]
"[serious] Something is broken. We have built a monster."

## Act 3 — The crisis and the cure

### beat-034
[MANIM: journey_strip_stop_4]
"[curious] Stop four. Before we fix the problem, we need to name it."

### beat-035
[MANIM: bias_variance_grid_low_complexity]
"Imagine fitting the same kind of model to many different samples of the same underlying truth. Low-complexity fits. They all look nearly identical to each other."

### beat-036
[VISUAL: continue]
"[calm] Stable across samples. But all systematically wrong. We call this bias."

### beat-037
[MANIM: bias_variance_grid_high_complexity]
"Now do it with the high-complexity monster. Every fit looks wildly different. They thrash with the noise."

### beat-038
[VISUAL: continue]
"That wild sample-to-sample wobble is variance."

### beat-039
[VISUAL: equationCard equationId=eq-006 reveal=stepwise]
"Total error decomposes into three things. Bias squared. Variance. And irreducible noise."

### beat-040
[MANIM: u_curve_complexity_vs_error]
"[emphasized] Plot held-out error against complexity. You get a U. Too simple, biased. Too complex, wild. The sweet spot is in between."

### beat-041
[PAUSE 0.7s]
(silent)

### beat-042
[VISUAL: continue]
"[pensive] This isn't a model. It's a diagnosis. We've named the disease."

### beat-043
[MANIM: journey_strip_stop_5]
"Stop five. The cure."

### beat-044
[MANIM: regularization_metaphor_pricetag]
"[conversational] Here's the move. We don't forbid complexity. We charge for it."

### beat-045
[VISUAL: continue]
"The model is free to use big weights — but it has to pay. Lambda is the price tag."

### beat-046
[VISUAL: equationCard equationId=eq-007 reveal=all]
"Add the squared weights to the loss. This is ridge regression. L2."

### beat-047
[VISUAL: equationCard equationId=eq-008 reveal=all]
"Or add the absolute values. This is lasso. L1."

### beat-048
[VISUAL: continue]
"Same MSE. Different penalties. The difference looks small. The consequence is huge."

### beat-049
[MANIM: contour_ellipses_setup]
"[curious] Here's why. Draw the level sets of MSE as concentric ellipses around the unconstrained optimum."

### beat-050
[MANIM: contour_ridge_circle]
"For ridge, the constraint is a circle. We grow the smallest ellipse that touches it."

### beat-051
[MANIM: contour_ridge_contact_offaxis]
"The contact point sits somewhere on the circle. Generically, off-axis. So all weights shrink — but none hit exactly zero."

### beat-052
[MANIM: contour_lasso_diamond]
"Now swap the circle for a diamond. Same ellipses. But the diamond has corners — and the corners sit on the axes."

### beat-053
[MANIM: contour_lasso_corner_hit]
"[emphasized] The ellipse touches a corner. The corner is on the w-two-equals-zero axis. So w-two becomes exactly zero."

### beat-054
[PAUSE 1.0s]
(silent)

### beat-055
[VISUAL: continue]
"[serious] Lasso doesn't just shrink. It selects. It deletes features."

### beat-056
[MANIM: contour_side_by_side_summary]
"That single picture — the ellipse first kissing the diamond on a corner — is the entire reason L1 produces zeros and L2 doesn't."

### beat-057
[VISUAL: continue]
"[pensive] We tamed complexity by charging for it. Not forbidding it."

## Act 4 — The same machinery, now classifying

### beat-058
[MANIM: journey_strip_stop_6]
"[curious] Stop six. Pivot."

### beat-059
[MANIM: yes_no_question_card]
"What if the answer isn't a number on a line — it's a category? Will the patient relapse, yes or no?"

### beat-060
[VISUAL: continue]
"Linear regression has no concept of yes-or-no. We need to predict probability."

### beat-061
[MANIM: real_line_squeeze_into_unit]
"Probabilities live in zero to one. But w transpose x plus b can be any real number. We need to squeeze the real line into the unit interval."

### beat-062
[MANIM: sigmoid_curve_reveal]
"Enter the sigmoid. A gorgeous S-curve."

### beat-063
[VISUAL: equationCard equationId=eq-009 reveal=all]
"Sigma of z equals one over one plus e to the minus z."

### beat-064
[MANIM: sigmoid_asymptotes_and_half]
"Big positive z, output near one. Big negative z, output near zero. At z equals zero, output is one half — maximum uncertainty."

### beat-065
[VISUAL: equationCard equationId=eq-010 reveal=all]
"Wrap the linear function in the sigmoid. That's logistic regression. The predicted probability of the positive class."

### beat-066
[PAUSE 0.6s]
(silent)

### beat-067
[MANIM: mse_on_probability_fail]
"[curious] But MSE no longer fits. If our model says probability point-nine-nine when the truth is zero, MSE barely flinches. Squared error treats that as a polite mistake."

### beat-068
[VISUAL: continue]
"[serious] It isn't. It's a disaster. The model was confidently, completely wrong."

### beat-069
[MANIM: neg_log_p_curve]
"So we use a different loss. Plot minus log of p as p crawls toward zero. The loss climbs to infinity."

### beat-070
[VISUAL: continue]
"[emphasized] The loss screams when you're confidently wrong."

### beat-071
[MANIM: log_vs_squared_side_by_side]
"Side by side. Squared error stays bounded. Cross-entropy explodes. That asymptote is the entire point."

### beat-072
[VISUAL: equationCard equationId=eq-011 reveal=stepwise]
"For both labels, in one line — minus y log p hat, minus one minus y times log one minus p hat. Cross-entropy."

### beat-073
[PAUSE 0.7s]
(silent)

### beat-074
[MANIM: sigmoid_height_map_2d]
"[curious] One last surprise. The sigmoid is curvy. So you might expect logistic regression's decision boundary to be curvy too."

### beat-075
[MANIM: decision_boundary_slice_at_half]
"Slice the probability surface at p equals one half. The line that appears on the floor — straight."

### beat-076
[VISUAL: continue]
"[serious] Logistic regression is a linear classifier in disguise. Which means a circle of one class, surrounded by another, defeats it."

### beat-077
[VISUAL: continue]
"We need nonlinear boundaries. Without engineering them by hand."

## Act 5 — Forests, networks, and the realization

### beat-078
[MANIM: journey_strip_stop_7]
"[conversational] Stop seven. A different idea entirely. Don't fit one global function. Partition."

### beat-079
[MANIM: tree_growing_splits]
"A decision tree asks yes-or-no questions. At each leaf, predict the average of the training points that landed there."

### beat-080
[MANIM: tree_piecewise_constant_surface]
"The result is a piecewise-constant surface. Completely nonlinear. No calculus required."

### beat-081
[MANIM: deep_tree_overfitting]
"[serious] But one deep tree memorizes the data. It's the degree-nine monster all over again. High variance."

### beat-082
[PAUSE 0.6s]
(silent)

### beat-083
[MANIM: parliament_of_trees]
"[curious] Here is the fix. Build many trees, each on a slightly different sample. Average their predictions."

### beat-084
[VISUAL: continue]
"A parliament of mediocre trees. No single one is wise. But they vote — and the average is wiser than any of them."

### beat-085
[VISUAL: equationCard equationId=eq-012 reveal=all]
"y hat is the average over T trees. This is the random forest — Breiman, two thousand and one."

### beat-086
[MANIM: fifty_trees_ghost_overlay]
"Fifty noisy step functions, ghosted on top of each other. The variance averages out. The bias stays low. A smooth curve emerges."

### beat-087
[VISUAL: continue]
"[calm] Twenty-plus years later, this is still one of the best models on tabular data."

### beat-088
[MANIM: journey_strip_stop_8]
"[curious] Stop eight. The last one. And the strangest."

### beat-089
[PAUSE 0.5s]
(silent)

### beat-090
[MANIM: relu_kink_single]
"Take the simplest possible nonlinearity. Max of zero and z. The ReLU. It's a hinge — flat below zero, a straight line above."

### beat-091
[MANIM: linear_then_relu_then_linear]
"Now compose. A linear regression. A ReLU bend. Another linear regression — applied to the bent representation."

### beat-092
[VISUAL: equationCard equationId=eq-013 reveal=stepwise]
"y hat equals W-two times ReLU of W-one x plus b-one, plus b-two. A one-hidden-layer neural network."

### beat-093
[VISUAL: continue]
"[emphasized] Two regressions. With a kink between them."

### beat-094
[PAUSE 0.7s]
(silent)

### beat-095
[MANIM: target_curve_sin]
"Now watch what that small change buys us. Here is a target — a smooth wiggly curve. Our job is to fit it."

### beat-096
[MANIM: relu_approx_one_unit]
"One ReLU. A single bend. Way off."

### beat-097
[MANIM: relu_approx_two_units]
"Two ReLUs. Two bends. Closer."

### beat-098
[MANIM: relu_approx_five_units]
"Five ReLUs. The kinks are finding their right places."

### beat-099
[MANIM: relu_approx_thirty_units]
"Thirty ReLUs. Indistinguishable from the target."

### beat-100
[PAUSE 1.0s]
(silent)

### beat-101
[VISUAL: continue]
"[serious] With enough hidden units, this composition can approximate any continuous function on a bounded domain. To arbitrary accuracy."

### beat-102
[VISUAL: continue]
"Cybenko, nineteen eighty-nine. Hornik, nineteen ninety-one. The universal approximation theorem."

### beat-103
[PAUSE 0.8s]
(silent)

### beat-104
[VISUAL: continue]
"[emphasized] A model that is just two regressions, with a bend between them — has unlimited expressiveness."

### beat-105
[MANIM: gradient_descent_landscape]
"[calm] One catch. There is no closed form for the weights. So we walk downhill."

### beat-106
[VISUAL: equationCard equationId=eq-014 reveal=all]
"Compute the gradient. Take a small step against it. Repeat. This is gradient descent — and the chain rule, essentially, gives us every gradient we need."

### beat-107
[MANIM: parameter_trajectory_into_basin]
"The parameters wander into a basin. The loss settles. The fit appears."

## Closing — the realization

### beat-108
[PAUSE 1.0s]
(silent)

### beat-109
[MANIM: journey_strip_all_lit]
"[pensive] Eight stops. Look at them lit up together."

### beat-110
[VISUAL: continue]
"The line. The hyperplane. The polynomial. The U-curve. Ridge and lasso. The sigmoid. The forest. The neural net."

### beat-111
[PAUSE 0.7s]
(silent)

### beat-112
[VISUAL: diagram src="closing-eight-models-collapse"]
"[wistful] Eight models, that look like eight different ideas — and every one of them does the same three things."

### beat-113
[VISUAL: continue]
"Pick a function. Define a loss. Make the loss small."

### beat-114
[PAUSE 1.0s]
(silent)

### beat-115
[VISUAL: continue]
"[emphasized] Fit a function. Punish your mistakes. Repeat."

### beat-116
[PAUSE 1.2s]
(silent)

### beat-117
[VISUAL: titleCard "Eight models. One idea." subtitle="Fit a function. Punish your mistakes. Repeat."]
(silent 2.5s)
