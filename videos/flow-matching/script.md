---
slug: flow-matching
voice: pharaoh
target_minutes: 11
---

# Flow Matching for Generative Modeling — explainer

## Act 1 — Cold open: the wind that paints

### beat-001
[VISUAL: titleCard text="Flow Matching" subtitle="the wind that paints"]
(silent 1.5s)

### beat-002
[MANIM: scene="leitmotif-flow" description="2000 particles begin as a tight unit Gaussian blob in the center; particles colored cool blue."]
"Picture a million tiny dots, scattered like dust."

### beat-003
[MANIM: scene="leitmotif-flow" description="Continue: a faint vector field appears overlaid on the cloud; arrows shimmer from blue to gold."]
"Now imagine a wind starts to blow over them."

### beat-004
[MANIM: scene="leitmotif-flow" description="Particles begin moving along the vector field, leaving fading trails; trajectories curve gently."]
"Each dot follows the wind."

### beat-005
[VISUAL: pause duration=0.5s]
(silent)

### beat-006
[MANIM: scene="leitmotif-flow" description="Particles arrive at their final positions; their colors resolve into pixels of a recognizable image — a digit '7' or a small dog silhouette."]
"And after one second... the dust has rearranged itself into a photograph."

### beat-007
[VISUAL: pause duration=0.7s]
(silent)

### beat-008
[MANIM: scene="leitmotif-flow" description="Hold the resolved image. Caption fades in: 'this is generation as a flow.'"]
"That is what a flow-matching model does."

### beat-009
[VISUAL: titleCard text="The trick is teaching the wind." subtitle=""]
"The whole trick is teaching the wind."

### beat-010
[VISUAL: pause duration=0.6s]
(silent)

## Act 2 — What we have, what we want

### beat-011
[MANIM: scene="two-clouds" description="Left panel: tidy unit Gaussian blob labeled p_0. Right panel: messy swarm forming a digit or face, labeled q. A dashed arrow with a question mark connects them."]
"On the left, a thing we know how to sample — pure Gaussian noise."

### beat-012
[MANIM: scene="two-clouds" description="Highlight left cloud, glow effect."]
"Just call rand n in your favorite library. Easy."

### beat-013
[MANIM: scene="two-clouds" description="Highlight right cloud, glow effect; label 'q — data'."]
"On the right, the data — say, all the photos in the world."

### beat-014
[MANIM: scene="two-clouds" description="Right cloud highlighted with annotation 'samples yes, formula no'."]
"We have samples. We do not have a formula."

### beat-015
[VISUAL: pause duration=0.5s]
(silent)

### beat-016
[MANIM: scene="two-clouds" description="The dashed arrow with a question mark pulses between the clouds, labeled phi."]
"And we want a transport — a map that turns one into the other."

### beat-017
[MANIM: scene="two-clouds" description="The arrow morphs into a label 'phi: noise to data'."]
"That map, that wind, is the whole goal."

### beat-018
[VISUAL: pause duration=0.6s]
(silent)

## Act 3 — Vector fields and flows

### beat-019
[VISUAL: titleCard text="A one-minute crash course on flows" subtitle=""]
"So let's build that wind, slowly."

### beat-020
[MANIM: scene="vector-field-intro" description="Empty 2D plane appears with axes; a grid of small arrows materializes, all pointing in various directions."]
"A vector field is just an arrow at every point in space."

### beat-021
[MANIM: scene="vector-field-intro" description="Highlight three sample arrows at different points, each glowing briefly."]
"Stand here, the arrow points there. Stand somewhere else, it points somewhere else."

### beat-022
[MANIM: scene="vector-field-intro" description="A time slider t appears at the bottom. As t advances, all arrows rotate slightly."]
"And the arrows can change with time."

### beat-023
[MANIM: scene="vector-field-intro" description="Slider sweeps t from 0 to 1; the field morphs gently."]
"We write it v sub t of x — the wind at point x, at time t."

### beat-024
[VISUAL: pause duration=0.5s]
(silent)

### beat-025
[MANIM: scene="single-particle-flow" description="Drop a single bright particle on the field; it begins to move, tracing a curved trail that follows the local arrows."]
"Now drop a particle. It always goes where the arrow points."

### beat-026
[MANIM: scene="single-particle-flow" description="Zoom in on the particle; show a tangent vector at its current position exactly matching the field arrow there."]
"At every instant, its velocity equals the local arrow."

### beat-027
[MANIM: scene="single-particle-flow" description="Pull back; the trail completes its journey across the plane."]
"Trace its whole journey, and you get a curve. We call it the flow."

### beat-028
[VISUAL: equationStep eq=eq-001 step=0 reveal="full-equation"]
"In symbols: the time derivative of the flow equals the field at the flow's current location."

### beat-029
[VISUAL: pause duration=0.7s]
(silent)

### beat-030
[VISUAL: equationStep eq=eq-002 step=0 reveal="initial-condition"]
"And at time zero, the particle is wherever you started it."

### beat-031
[VISUAL: pause duration=0.5s]
(silent)

### beat-032
[MANIM: scene="single-particle-flow" description="Show three different starting points launching three different trails through the same field."]
"That is it. A field, plus a start, gives you a trajectory."

## Act 4 — A flow carries a distribution

### beat-033
[MANIM: scene="cloud-pushforward" description="Replace single particle with a Gaussian cloud of 1000 particles. Time slider at t=0."]
"Now drop a whole cloud of them."

### beat-034
[MANIM: scene="cloud-pushforward" description="Particles flow forward; cloud deforms and slides across the plane, leaving faint trails."]
"Every particle obeys the same wind. The cloud as a whole drifts and stretches."

### beat-035
[MANIM: scene="cloud-pushforward" description="Below the particles, a heatmap appears showing the empirical density. As particles move, the heatmap morphs in lockstep."]
"And underneath the dots, a density. A histogram of where everyone is."

### beat-036
[MANIM: scene="cloud-pushforward" description="Annotate: 'this is p_t.' The density label tracks the heatmap."]
"We call that density p sub t."

### beat-037
[VISUAL: equationStep eq=eq-003 step=0 reveal="pushforward"]
"In notation: p sub t equals the push-forward of p naught by phi sub t."

### beat-038
[MANIM: scene="cloud-pushforward" description="Show particles labeled phi_t pointing into the heatmap."]
"Translation — apply the flow to every particle, and you get a new distribution."

### beat-039
[VISUAL: pause duration=0.6s]
(silent)

### beat-040
[VISUAL: equationStep eq=eq-004 step=0 reveal="change-of-variables"]
"The full bookkeeping uses a Jacobian determinant."

### beat-041
[VISUAL: paperPage pageIdx=2 focus="center"]
"Don't worry about it. It's just change of variables."

### beat-042
[VISUAL: pause duration=0.4s]
(silent)

### beat-043
[MANIM: scene="cloud-pushforward" description="Cloud finishes morphing into something resembling q at t=1."]
"The dream is simple. Find a wind whose flow turns Gaussian noise into the data distribution."

### beat-044
[MANIM: scene="cloud-pushforward" description="Final frame: cloud shaped like the target distribution; caption 'a continuous normalizing flow'."]
"That object is called a continuous normalizing flow."

### beat-045
[VISUAL: pause duration=0.6s]
(silent)

## Act 5 — The naive dream and why it crashes

### beat-046
[VISUAL: titleCard text="The naive dream" subtitle=""]
"So here's the obvious idea."

### beat-047
[MANIM: scene="naive-dream" description="A neural network box appears with input x, t and output v_theta(x,t)."]
"Parameterize the wind with a neural network. Call it v theta."

### beat-048
[MANIM: scene="naive-dream" description="Next to it, a target wind u_t appears as a faint reference field."]
"Suppose someone hands us the right answer — the true wind u sub t."

### beat-049
[MANIM: scene="naive-dream" description="A loss arrow connects v_theta and u_t."]
"Then training is just regression. Match the arrows."

### beat-050
[VISUAL: equationCard eq=eq-005 reveal=all]
"This is the Flow Matching loss. Average squared error between our wind and the true one."

### beat-051
[VISUAL: pause duration=0.7s]
(silent)

### beat-052
[MANIM: scene="naive-dream" description="A red strikethrough draws across the symbol u_t in eq-005."]
"Tiny problem. We don't have u sub t."

### beat-053
[MANIM: scene="naive-dream" description="A second red strikethrough draws across the p_t expectation in eq-005."]
"And the expectation is over p sub t — which we also don't have."

### beat-054
[MANIM: scene="naive-dream" description="Both crossed-out symbols flash red. A frustrated question mark appears over the equation."]
"We only have samples from q. The data."

### beat-055
[VISUAL: pause duration=0.7s]
(silent)

### beat-056
[MANIM: scene="naive-dream" description="The full equation greys out under a dark overlay; caption: 'intractable.'"]
"So the dream loss is unusable. Both ingredients are unknown."

### beat-057
[VISUAL: pause duration=0.6s]
(silent)

## Act 6 — The trick: condition on a single data point

### beat-058
[VISUAL: titleCard text="The trick" subtitle="condition on one data point"]
"Here is the move that breaks the deadlock."

### beat-059
[MANIM: scene="conditional-paths-three" description="A blank 2D plane. Three colored data points appear: x_1^(a) red, x_1^(b) green, x_1^(c) blue."]
"Pick a single data sample. Call it x sub 1."

### beat-060
[MANIM: scene="conditional-paths-three" description="From the origin, a tiny red Gaussian tube grows outward toward the red x_1, narrowing as it lands."]
"Design a tiny path from noise at time zero to a tight bump around x sub 1 at time one."

### beat-061
[MANIM: scene="conditional-paths-three" description="The red tube is now annotated p_t(x | x_1)."]
"That conditional path — we choose it. We can write it down. It's easy."

### beat-062
[VISUAL: pause duration=0.5s]
(silent)

### beat-063
[MANIM: scene="conditional-paths-three" description="Repeat for the green and blue data points: green tube grows toward green x_1, blue tube toward blue x_1."]
"Do the same for every data sample. Each one gets its own little tube."

### beat-064
[MANIM: scene="conditional-paths-three" description="All three colored tubes coexist on the plane."]
"And now — the magic."

### beat-065
[VISUAL: pause duration=0.5s]
(silent)

### beat-066
[MANIM: scene="conditional-paths-three" description="Tubes fade together; their union becomes the marginal cloud p_t in white. Annotation: 'average over data'."]
"Average all of them, weighted by how often each data point appears."

### beat-067
[VISUAL: equationCard eq=eq-006 reveal=all]
"That average is the marginal probability path. p sub t of x is the integral over x sub 1."

### beat-068
[VISUAL: pause duration=0.6s]
(silent)

### beat-069
[MANIM: scene="conditional-paths-three" description="At t=1, the marginal cloud now closely matches the data distribution q."]
"At time one, that marginal is essentially the data distribution."

### beat-070
[MANIM: scene="conditional-paths-three" description="Pick one query point x in the plane. Three colored arrows appear at x — the conditional vector fields, one per data point."]
"Now zoom in on a single point x. Each conditional path has its own wind there."

### beat-071
[MANIM: scene="conditional-paths-three" description="Each arrow's length pulses with the local density of its colored tube — red dense means red arrow long."]
"And here's the key: the marginal wind is the average of those arrows."

### beat-072
[MANIM: scene="conditional-paths-three" description="The three colored arrows blend into a single black arrow — the marginal vector field at x."]
"But weighted — weighted by which data point is most likely given that x."

### beat-073
[VISUAL: pause duration=0.7s]
(silent)

### beat-074
[VISUAL: equationCard eq=eq-008 reveal=all]
"Formally: u sub t of x is the integral of u sub t of x given x_1, weighted by the posterior."

### beat-075
[MANIM: scene="conditional-paths-three" description="Highlight the weight in eq-008: p_t(x|x_1) q(x_1) / p_t(x). Annotate 'posterior over x_1'."]
"That fraction is just Bayes — given that we landed at x, how likely was each data point."

### beat-076
[VISUAL: pause duration=0.7s]
(silent)

### beat-077
[MANIM: scene="conditional-paths-three" description="Pull back to show the whole picture: marginal wind field constructed point by point from conditional fields."]
"So the marginal wind is built, point by point, from things we can write down."

### beat-078
[VISUAL: pause duration=0.5s]
(silent)

## Act 7 — The CFM miracle

### beat-079
[VISUAL: titleCard text="Same gradient" subtitle="the conditional flow matching trick"]
"But wait. Knowing u sub t is built from conditionals doesn't help if we still have to compute that ugly integral."

### beat-080
[MANIM: scene="cfm-miracle" description="Two equations side by side: L_FM (red strikethroughs over u_t and p_t) and a blank green panel labeled L_CFM."]
"On the left, the loss we wanted but couldn't compute."

### beat-081
[MANIM: scene="cfm-miracle" description="The right panel fills in with eq-009 in green: L_CFM with samplers t, x_1, x|x_1."]
"On the right, a new loss. A loss we can sample from."

### beat-082
[VISUAL: equationCard eq=eq-009 reveal=all]
"Sample a time. Sample a data point x_1. Sample a noisy x from its conditional path. Regress."

### beat-083
[VISUAL: pause duration=0.6s]
(silent)

### beat-084
[MANIM: scene="cfm-miracle" description="An equality sign with the word 'gradients' written inside pulses between L_FM and L_CFM."]
"And here is the theorem of the paper."

### beat-085
[MANIM: scene="cfm-miracle" description="The two losses connect via 'grad theta' equality."]
"The gradient of the conditional loss equals the gradient of the marginal one."

### beat-086
[VISUAL: pause duration=0.8s]
(silent)

### beat-087
[MANIM: scene="cfm-miracle" description="Expand the squared norm: ||v_theta||^2 - 2 <v_theta, u> + ||u||^2. Highlight the v-squared term in both losses with the same color."]
"Why? Expand both squared norms."

### beat-088
[MANIM: scene="cfm-miracle" description="The v_theta squared term in both losses is shown identical under the swap of integrals."]
"The v-theta-squared term — same expectation either way."

### beat-089
[MANIM: scene="cfm-miracle" description="The cross term is highlighted; an arrow shows it rearranges via Bayes' rule using eq-008."]
"The cross term — rearranges via Bayes, using exactly the formula we just drew."

### beat-090
[MANIM: scene="cfm-miracle" description="The u_t squared term is greyed out as 'constant in theta'."]
"And the u-squared term doesn't depend on theta. The gradient throws it away."

### beat-091
[VISUAL: pause duration=0.6s]
(silent)

### beat-092
[MANIM: scene="cfm-miracle" description="L_FM is fully greyed out; L_CFM lights up green; arrow shows 'use this one'."]
"So we minimize a loss over things we can sample, and recover the marginal field for free."

### beat-093
[VISUAL: pause duration=0.7s]
(silent)

### beat-094
[VISUAL: titleCard text="That's the whole paper, in spirit." subtitle=""]
"That, in spirit, is the whole paper."

### beat-095
[VISUAL: pause duration=0.6s]
(silent)

## Act 8 — Building the per-sample path: Gaussians

### beat-096
[VISUAL: titleCard text="Concrete: Gaussian paths" subtitle=""]
"Now let's actually pick one of those conditional paths."

### beat-097
[MANIM: scene="gaussian-path" description="A 2D Gaussian blob centered at origin with covariance I; label 'p_t(x | x_1)'."]
"The simplest choice — a Gaussian that slides and shrinks."

### beat-098
[VISUAL: equationCard eq=eq-010 reveal=all]
"At every time t, p sub t given x_1 is a Gaussian with mean mu sub t and standard deviation sigma sub t."

### beat-099
[MANIM: scene="gaussian-path" description="Time slider sweeps; the blob's center mu_t slides from 0 toward x_1, and its width sigma_t shrinks."]
"At t equals zero, mean zero and unit variance. At t equals one, centered tightly on x sub 1."

### beat-100
[VISUAL: pause duration=0.5s]
(silent)

### beat-101
[MANIM: scene="gaussian-path" description="Sample 100 points from the t=0 blob; each is colored. They all transform via psi_t toward their corresponding final positions."]
"What flow realizes that path? Just an affine map."

### beat-102
[VISUAL: equationCard eq=eq-011 reveal=all]
"psi sub t of x equals sigma sub t times x, plus mu sub t."

### beat-103
[MANIM: scene="gaussian-path" description="Each sample point's trajectory shown: scale by sigma_t, shift by mu_t."]
"Scale by sigma. Shift by mu. That's it."

### beat-104
[VISUAL: pause duration=0.6s]
(silent)

### beat-105
[MANIM: scene="gaussian-path" description="From psi_t, the velocity u_t(x|x_1) is derived on screen by taking d/dt of the affine map."]
"Take the time derivative — and the velocity drops out in closed form."

### beat-106
[VISUAL: equationCard eq=eq-015 reveal=all]
"u sub t of x given x_1 — sigma prime over sigma times x minus mu, plus mu prime."

### beat-107
[VISUAL: pause duration=0.7s]
(silent)

### beat-108
[MANIM: scene="gaussian-path" description="Annotate eq-015: 'pick mu_t, pick sigma_t, get u_t for free.'"]
"Choose your mean and variance schedules. The wind comes for free."

### beat-109
[VISUAL: pause duration=0.5s]
(silent)

## Act 9 — Diffusion is a special case

### beat-110
[VISUAL: titleCard text="A quick detour" subtitle="diffusion is just one schedule"]
"Here's a fun aside, especially if you came in thinking about diffusion."

### beat-111
[MANIM: scene="diffusion-special-case" description="A parameter dial labeled '(mu_t, sigma_t)'. As we sweep it, an underlying curve morphs from one shape to another."]
"All those diffusion models? They're one specific choice of mu sub t and sigma sub t."

### beat-112
[MANIM: scene="diffusion-special-case" description="Dial sweeps; labels appear: 'VE', 'VP', 'linear'."]
"Variance preserving, variance exploding — they're all just dials on the same family."

### beat-113
[VISUAL: equationCard eq=eq-019 reveal=all]
"Plug their schedule into our formula, out pops the diffusion velocity field."

### beat-114
[MANIM: scene="diffusion-special-case" description="Caption fades in: 'one knob, many models.'"]
"Flow matching is a strict generalization, not a competitor."

### beat-115
[VISUAL: pause duration=0.6s]
(silent)

## Act 10 — The punch line: optimal transport paths are straight lines

### beat-116
[VISUAL: titleCard text="The simplest schedule of all" subtitle=""]
"So if all those choices are valid, what's the simplest one we could pick?"

### beat-117
[VISUAL: pause duration=0.4s]
(silent)

### beat-118
[VISUAL: equationCard eq=eq-020 reveal=all]
"Make the mean linear in t. mu sub t equals t times x_1."

### beat-119
[MANIM: scene="ot-path-build" description="A 2D plane, point x_1 marked. As t goes 0 to 1, mu_t slides linearly from origin to x_1."]
"At t equals zero, the mean is at the origin. At t equals one, it's at the data point. A straight line in between."

### beat-120
[MANIM: scene="ot-path-build" description="Standard deviation curve sigma_t shown shrinking linearly from 1 to sigma_min."]
"And let sigma also be linear — shrinking from one to nearly zero."

### beat-121
[VISUAL: pause duration=0.5s]
(silent)

### beat-122
[VISUAL: equationCard eq=eq-022 reveal=all]
"The flow it produces — psi sub t of x — is literally the straight line from a noise sample to a data sample."

### beat-123
[MANIM: scene="ot-path-build" description="Many particles starting from noise at t=0; each glides on a perfectly straight line to a corresponding x_1 at t=1."]
"Every particle just walks in a straight line. From its noise to its target."

### beat-124
[VISUAL: pause duration=0.7s]
(silent)

### beat-125
[VISUAL: equationCard eq=eq-021 reveal=all]
"And the velocity? Plug into our formula — it collapses."

### beat-126
[MANIM: scene="ot-path-build" description="eq-021 simplifies on screen: it's a constant in t, equal to (x_1 - x_0) when sigma_min is small."]
"Effectively, the velocity is constant. It's just x_1 minus x_0."

### beat-127
[VISUAL: pause duration=0.6s]
(silent)

### beat-128
[VISUAL: equationCard eq=eq-023 reveal=all]
"So the loss reduces to this. v theta evaluated at psi_t of x_0 — should match x_1 minus x_0."

### beat-129
[VISUAL: titleCard text="predict the displacement." subtitle=""]
"In English. The network just learns to point from a noise sample toward a data sample."

### beat-130
[VISUAL: pause duration=0.9s]
(silent)

### beat-131
[MANIM: scene="ot-vs-diffusion" description="Split-screen. Same noise seed. Left labeled 'Diffusion': particles wiggle along curved, overshooting trajectories from noise toward an image. Right labeled 'OT (flow matching)': particles glide on perfectly straight lines, arriving simultaneously."]
"Same noise. Same target. Diffusion's particles wiggle and overshoot."

### beat-132
[MANIM: scene="ot-vs-diffusion" description="Continue the split-screen: OT side reaches the target faster and cleaner."]
"The straight-line paths arrive cleanly, and they arrive sooner."

### beat-133
[VISUAL: pause duration=0.7s]
(silent)

### beat-134
[MANIM: scene="ot-vs-diffusion" description="Caption pops in: 'this is optimal transport.'"]
"And the wild thing? This straight-line schedule is the optimal transport solution."

### beat-135
[MANIM: scene="ot-vs-diffusion" description="Annotate the OT line with 'shortest path between the two Gaussians.'"]
"The shortest possible path between the noise distribution and a data sample."

### beat-136
[VISUAL: pause duration=0.7s]
(silent)

### beat-137
[VISUAL: titleCard text="The simplest choice was the best choice." subtitle=""]
"The simplest choice you could have written down — turns out to be the best one."

### beat-138
[VISUAL: pause duration=0.8s]
(silent)

## Act 11 — Does it actually work?

### beat-139
[VISUAL: titleCard text="And here is the kicker..." subtitle=""]
"And dear fellow scholars, here is the kicker."

### beat-140
[VISUAL: image src="imagenet-128-samples" alt="ImageNet-128 unconditional samples grid from Figure 1 of the paper"]
"These are unconditional ImageNet samples, generated by a flow matching model with optimal transport paths."

### beat-141
[VISUAL: image src="imagenet-128-samples" alt="ImageNet-128 unconditional samples grid — slow zoom"]
"They were not cherry picked. The model was simply asked: turn this noise into something."

### beat-142
[VISUAL: pause duration=0.6s]
(silent)

### beat-143
[VISUAL: diagram src="nfe-bar-chart" alt="Bar chart of ODE function evaluations to reach FID under 10, FM-OT vs DDPM vs Score SDE"]
"And the headline number is sampling efficiency."

### beat-144
[VISUAL: diagram src="nfe-bar-chart" alt="Highlighting FM-OT bar — much shorter than the diffusion bars"]
"For the same image quality, flow matching with OT paths needs far fewer ODE steps than diffusion."

### beat-145
[VISUAL: pause duration=0.5s]
(silent)

### beat-146
[VISUAL: image src="ot-vs-diffusion-trajectories" alt="Figure 6 from paper — diffusion vs OT sampling trajectories at the same noise seed"]
"You can literally watch it happen. Same seed, same target."

### beat-147
[VISUAL: image src="ot-vs-diffusion-trajectories" alt="Continue showing trajectory comparison"]
"The OT paths converge on the picture before the diffusion paths even know which way to bend."

### beat-148
[VISUAL: pause duration=0.6s]
(silent)

### beat-149
[VISUAL: titleCard text="Faster training. Faster sampling. Same model class." subtitle=""]
"Faster training. Faster sampling. Same neural network you would have trained anyway."

### beat-150
[VISUAL: pause duration=0.7s]
(silent)

## Act 12 — Outro and citation

### beat-151
[VISUAL: titleCard text="In one sentence" subtitle=""]
"So let's compress the whole paper into one sentence."

### beat-152
[VISUAL: pause duration=0.4s]
(silent)

### beat-153
[MANIM: scene="leitmotif-flow" description="Reprise the opening particle cloud morphing into a recognizable image, slower and dimmer in the background."]
"Regress your network on a per-sample velocity."

### beat-154
[MANIM: scene="leitmotif-flow" description="Continue the leitmotif; particles flow on straight lines now, not curves."]
"Choose straight lines from noise to data."

### beat-155
[MANIM: scene="leitmotif-flow" description="Particles arrive at the final image."]
"And let the wind paint."

### beat-156
[VISUAL: pause duration=0.9s]
(silent)

### beat-157
[VISUAL: titleCard text="Flow Matching for Generative Modeling" subtitle="Lipman, Chen, Ben-Hamu, Nickel, Le — arXiv:2210.02747"]
"Flow Matching for Generative Modeling. Lipman, Chen, Ben-Hamu, Nickel, and Le. Two thousand twenty-two."

### beat-158
[VISUAL: pause duration=1.5s]
(silent)
