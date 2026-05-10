---
slug: origins-math-regressions
voice: pharaoh
target_minutes: 12
---

# Origins — From Least Squares to Backprop

## Act 1 — A line is a network

### beat-001
[VISUAL: titleCard "ORIGINS" subtitle="From Least Squares to Backprop"]
(silent 2.0s)

### beat-002
[MANIM: scene=line_through_scatter.py class=LineThroughScatter description="1. A cloud of about thirty data points fades in on a clean axis. 2. A straight line drops into place and tilts to fit through the cloud. 3. The line settles. A small caption appears beside it reading: 'a one-neuron network'. 4. Hold the tableau."]
"[curious] When you fit a line through a cloud of points, you have already trained a neural network."

### beat-003
[VISUAL: continue]
"You just didn't call it that."

### beat-004
[PAUSE 0.8s]
(silent)

### beat-005
[MANIM: scene=line_to_neuron.py class=LineToNeuron description="1. The fitted line from the previous scene is held on the left. 2. On the right, the same equation y equals w one x plus w zero is redrawn as a single-neuron diagram: two input wires labeled x and 1, weights w one and w zero, summed into a circle, with the output y emerging on the right. 3. The two pictures glow briefly to show their equivalence. 4. Hold the tableau."]
"[calm] Inputs, weights, a sum, an output. That is a neuron. And that is a line."

### beat-006
[VISUAL: continue]
"[emphasized] The whole story of deep learning is what happens when you stack these on top of each other."

### beat-007
[PAUSE 0.6s]
(silent)

### beat-008
[VISUAL: titleCard "1805 — 1986" subtitle="A 200-year arc of one idea"]
"[conversational] Let's walk that arc. From 1805 to 1986. From a French astronomer to a Nature paper that ended an AI winter."

## Act 2 — Legendre, Gauss, and the birth of regression

### beat-009
[VISUAL: image src="legendre-portrait"]
"[calm] Eighteen-oh-five. Adrien-Marie Legendre, in Paris, is trying to compute the orbits of comets."

### beat-010
[VISUAL: image src="legendre-1805-titlepage"]
"He publishes a small appendix to a book on celestial mechanics. In it, a method he calls — the method of least squares."

### beat-011
[MANIM: scene=residuals.py class=ResidualsShrinking description="1. A scatter of points appears with a tilted line through them. 2. From each data point, a thin vertical segment drops to the line, labeled r sub i. 3. Each segment turns into a small filled square whose side is the residual. 4. The squares sum into a single accumulator on the right labeled 'sum of squared residuals'. 5. Hold."]
"[curious] For each point, measure the vertical gap to the line. That gap is the residual."

### beat-012
[VISUAL: continue]
"Square it. Add up all the squares. That sum is the error."

### beat-013
[MANIM: scene=line_tilting_loss_drops.py class=LineTiltingLossDrops description="1. The same scatter and line are shown. 2. The line begins to tilt and slide; squared residuals shrink and grow. 3. A counter on the right shows the sum-of-squares value moving down. 4. The line locks into the optimal angle; the counter reaches its minimum. 5. Hold the tableau."]
"Now tilt the line. Slide it. The error rises and falls. Find the angle and offset where the error is smallest. That is the best fit."

### beat-014
[PAUSE 0.7s]
(silent)

### beat-015
[VISUAL: image src="gauss-portrait"]
"[serious] Four years later, Carl Friedrich Gauss publishes the same method — and claims he had it in 1795, when he was eighteen."

### beat-016
[VISUAL: image src="gauss-theoria-motus"]
"His Theoria Motus adds something Legendre's appendix did not: a probabilistic justification."

### beat-017
[VISUAL: continue]
"[calm] If your measurement noise is Gaussian, then squared error is the right loss. Not absolute error. Squared."

### beat-018
[MANIM: scene=loss_paraboloid.py class=LossParaboloid description="1. The 1D parabola E of w appears, with a small ball resting at its minimum. 2. The view lifts into 3D: a clean paraboloid bowl over the w-zero, w-one plane. 3. A red dot marks the unique minimum. 4. The bowl rotates gently. 5. Hold."]
"[pensive] And the picture you get is a bowl. One minimum. Roll a ball in, it finds the bottom."

### beat-019
[VISUAL: continue]
"[emphasized] Remember this bowl. It will reappear in every act of this video."

## Act 3 — Logistic regression: the same shape, with a squash

### beat-020
[VISUAL: image src="verhulst-portrait"]
"[calm] Eighteen-thirty-eight. Pierre-François Verhulst, a Belgian mathematician, is studying how populations grow."

### beat-021
[MANIM: scene=logistic_population.py class=LogisticPopulation description="1. A time-axis with a population curve rising. 2. Initially exponential, then bending over and saturating into an S-shape. 3. The S-curve is highlighted and the formula y equals one over one plus e to the minus x appears beside it. 4. Hold."]
"He notices populations don't grow forever. They saturate. Their curve bends over into an S."

### beat-022
[VISUAL: continue]
"[curious] That S-curve has a name. The logistic function."

### beat-023
[MANIM: scene=step_to_sigmoid.py class=StepToSigmoid description="1. A hard step function appears: zero on the left, one on the right, vertical jump at the origin. 2. The vertical jump softens, the corners round, and the step morphs continuously into a smooth sigmoid. 3. Both curves overlay for a moment. 4. The sigmoid is labeled sigma of x equals one over one plus e to the minus x. 5. Hold."]
"[pensive] Think of it as a soft step. Where a step jumps from zero to one all at once, the sigmoid eases across."

### beat-024
[MANIM: scene=neuron_with_sigmoid.py class=NeuronWithSigmoid description="1. The single-neuron diagram from act 1 reappears. 2. A small sigma-box is inserted between the sum and the output. 3. The output line is now annotated as a probability between zero and one. 4. Hold."]
"[calm] Take a weighted sum, push it through this sigmoid, and the output is now a probability between zero and one. That is logistic regression."

### beat-025
[VISUAL: continue]
"[emphasized] Same neuron. Same weighted sum. Just a softer output."

### beat-026
[PAUSE 0.6s]
(silent)

### beat-027
[VISUAL: equationStep id=eq-002 step=0]
"And eighty years from now, this exact sigmoid will reappear as equation two of a paper that changes everything."

## Act 4 — McCulloch and Pitts: a neuron is a threshold

### beat-028
[VISUAL: image src="mcculloch-portrait"]
"[calm] Nineteen-forty-three. Warren McCulloch, a neurophysiologist at the University of Illinois."

### beat-029
[VISUAL: image src="pitts-portrait"]
"[wistful] And Walter Pitts. A homeless nineteen-year-old logician who taught himself mathematics in the Chicago public library."

### beat-030
[VISUAL: image src="mcculloch-pitts-1943-paper"]
"They write a paper called 'A Logical Calculus of the Ideas Immanent in Nervous Activity.'"

### beat-031
[MANIM: scene=mp_neuron_diagram.py class=MPNeuronDiagram description="1. A cartoon biological neuron is drawn on the left, with dendrites, soma, and axon. 2. On the right, an arrow leads to an abstract diagram: several inputs feeding weights into a sum, then through a hard step function. 3. The hard-step output is binary: zero or one. 4. Hold the side-by-side."]
"[curious] Their idea — strip a real neuron down to its mathematical bones."

### beat-032
[VISUAL: continue]
"Inputs. Weights. A sum. A threshold. Above the threshold — fire, output one. Below — silent, output zero."

### beat-033
[VISUAL: continue]
"[pensive] It is logistic regression with a hard step instead of a soft sigmoid. The first mathematical model of a neuron."

## Act 5 — Rosenblatt's Perceptron — a network that learns

### beat-034
[VISUAL: image src="rosenblatt-portrait"]
"[calm] Nineteen-fifty-eight. Frank Rosenblatt at Cornell."

### beat-035
[VISUAL: image src="mark-i-perceptron"]
"He builds a machine. Not a simulation. Actual hardware."

### beat-036
[VISUAL: continue]
"[curious] Four hundred photocells wired into a grid. Behind them, motorized potentiometers serve as adjustable weights. They click and turn as the machine learns."

### beat-037
[VISUAL: image src="nyt-1958-perceptron-clipping"]
"[serious] The New York Times calls it the embryo of an electronic computer that the Navy expects will be able to walk, talk, see, write, and reproduce itself."

### beat-038
[PAUSE 0.7s]
(silent)

### beat-039
[VISUAL: continue]
"[pensive] The press, as always, was a bit ahead of the math."

### beat-040
[MANIM: scene=perceptron_decision_boundary.py class=PerceptronDecisionBoundary description="1. A 2D plane appears with red and blue dots scattered across it, mostly separable. 2. A straight decision boundary appears at a random angle, misclassifying many points. 3. A misclassified red dot pulses; the line rotates a step toward correctly classifying it. 4. Several updates play out, each rotating or translating the line. 5. The line settles into a clean separating position, with all dots correctly colored. 6. Hold the tableau."]
"[curious] But Rosenblatt had something genuinely new — a learning rule."

### beat-041
[VISUAL: continue]
"For each example: if the neuron classifies it wrong, nudge the weights toward the right answer."

### beat-042
[VISUAL: continue]
"[calm] Formally — w sub i becomes w sub i plus eta times the error times x sub i. The error is just desired minus actual."

### beat-043
[VISUAL: continue]
"[pensive] Picture a bouncer at a club drawing a chalk line on the floor. Every time someone is misclassified at the door, the bouncer redraws the line a little. Eventually, if the crowd can be separated at all, the line settles."

### beat-044
[VISUAL: continue]
"[emphasized] Rosenblatt proved this. If the data is linearly separable, the rule converges in finite steps."

### beat-045
[PAUSE 0.7s]
(silent)

### beat-046
[VISUAL: image src="rosenblatt-portrait"]
"[wistful] Rosenblatt died in a sailing accident in 1971, at forty-three. He never saw the rest of this story."

## Act 6 — Widrow and Hoff: gradient descent on a neuron

### beat-047
[VISUAL: image src="widrow-portrait"]
"[calm] Nineteen-sixty. Bernard Widrow at Stanford."

### beat-048
[VISUAL: image src="hoff-portrait"]
"And his graduate student Ted Hoff — who would, a decade later, co-invent the Intel 4004, the first microprocessor."

### beat-049
[VISUAL: image src="adaline-hardware"]
"They build a machine called ADALINE. Adaptive linear neuron."

### beat-050
[MANIM: scene=ball_in_parabola.py class=BallInParabola description="1. A clean parabola E of w is drawn. 2. A ball appears on the upper-right side of the curve. 3. At the ball, a tangent line is drawn; an arrow shows the negative-slope direction. 4. The ball steps down the curve, tangent recomputed, arrow re-drawn, repeat. 5. The ball arrives at the bottom of the parabola. 6. Hold."]
"[curious] Their twist — instead of Rosenblatt's discrete update, train the neuron by rolling down the squared-error bowl. Directly. Step by step. Following the slope."

### beat-051
[VISUAL: continue]
"This is gradient descent on a neuron. Twenty-six years before backprop."

### beat-052
[VISUAL: continue]
"[emphasized] The bowl from act two. The same bowl. With a ball rolling on it."

## Act 7 — The XOR cliff: Minsky, Papert, and the AI winter

### beat-053
[VISUAL: image src="minsky-portrait"]
"[serious] Nineteen-sixty-nine. Marvin Minsky and Seymour Papert, at MIT."

### beat-054
[VISUAL: image src="papert-portrait"]
"They publish a small, precise, devastating book."

### beat-055
[VISUAL: image src="perceptrons-1969-book-cover"]
"It is called Perceptrons. And inside it is a proof."

### beat-056
[MANIM: scene=xor_not_separable.py class=XORNotSeparable description="1. A unit square is drawn with four corner points: bottom-left and top-right colored red (XOR output 0), top-left and bottom-right colored blue (XOR output 1). 2. A truth table appears beside it showing the XOR pattern. 3. A straight line is drawn through the square; it sweeps through every angle from horizontal to vertical and back. 4. At every angle, at least one point is on the wrong side; misclassified points pulse red. 5. The line gives up and disappears. 6. Hold the tableau with the four points lonely on the square."]
"[curious] Consider the XOR function. Four points on a unit square."

### beat-057
[VISUAL: continue]
"Two corners output one. The other two corners output zero. Diagonally opposite."

### beat-058
[VISUAL: continue]
"[serious] Now try to separate them with a single straight line."

### beat-059
[VISUAL: continue]
"[pause] You cannot."

### beat-060
[PAUSE 0.8s]
(silent)

### beat-061
[VISUAL: continue]
"[calm] No matter how you rotate the line, no matter where you place it, at least one point ends up on the wrong side."

### beat-062
[VISUAL: continue]
"[emphasized] A single-layer perceptron cannot learn XOR. Ever."

### beat-063
[VISUAL: image src="perceptrons-1969-book-cover"]
"[wistful] The book's reception was brutal. Funding for connectionist research collapsed. The first AI winter began."

### beat-064
[VISUAL: continue]
"For seventeen years, the question hung in the air — could you fix this with more layers? And if you could, how on earth would you train them?"

## Act 8 — Stack the layers, but how do you train the middle?

### beat-065
[MANIM: scene=mlp_solves_xor.py class=MLPSolvesXOR description="1. The XOR scatter from act 7 reappears. 2. A small 2-2-1 multi-layer perceptron diagram fades in beside it: two input units, two hidden sigmoid units, one output. 3. As the network trains, the decision boundary in the scatter morphs from a straight line into a curved region wrapping the diagonal pair. 4. All four points end up correctly classified. 5. Hold."]
"[curious] The fix, in principle, is simple. Stack two layers of neurons instead of one."

### beat-066
[VISUAL: continue]
"With a hidden layer in between, you can carve curved decision boundaries. XOR becomes solvable."

### beat-067
[MANIM: scene=mlp_as_nested_regressions.py class=MLPAsNestedRegressions description="1. A clean three-layer MLP is drawn: input, hidden, output. 2. One hidden neuron is highlighted; a small inset zooms in to show it as its own logistic-regression panel — inputs, weights, sum, sigmoid, output. 3. The inset closes, another hidden neuron is highlighted, same inset opens. 4. Then the output neuron is highlighted with the same inset. 5. The whole network gently glows: 'logistic regressions, all the way through.' 6. Hold."]
"[pensive] And here is the thesis of this video, returning."

### beat-068
[VISUAL: continue]
"[emphasized] Every neuron in this stacked network is just a logistic regression. The whole network is logistic regressions feeding logistic regressions."

### beat-069
[VISUAL: continue]
"Russian nesting dolls. Open the outer one — inside is another regression. Open that — another. All the way down."

### beat-070
[PAUSE 0.7s]
(silent)

### beat-071
[VISUAL: continue]
"[curious] But there is a problem."

### beat-072
[VISUAL: continue]
"Rosenblatt's rule needs a target. It needs to know what each neuron should output, so it can compute the error."

### beat-073
[VISUAL: continue]
"[serious] The output neuron has a target — the label. We know what it should say."

### beat-074
[VISUAL: continue]
"[pause] But the hidden neurons? What should they say?"

### beat-075
[PAUSE 0.9s]
(silent)

### beat-076
[VISUAL: continue]
"[pensive] Nobody tells you. There is no label for a hidden unit."

### beat-077
[VISUAL: continue]
"[emphasized] So how do you adjust their weights?"

### beat-078
[PAUSE 0.8s]
(silent)

### beat-079
[VISUAL: titleCard "1986" subtitle="An answer arrives"]
(silent 1.5s)

## Act 9 — 1986: Rumelhart, Hinton, Williams, and the chain rule

### beat-080
[VISUAL: image src="rumelhart-portrait"]
"[calm] David Rumelhart. A cognitive psychologist at UC San Diego."

### beat-081
[VISUAL: image src="hinton-1986-portrait"]
"Geoffrey Hinton. A British computer scientist, then at Carnegie Mellon."

### beat-082
[VISUAL: image src="williams-portrait"]
"And Ronald Williams, also at UCSD."

### beat-083
[VISUAL: image src="rumelhart-hinton-williams-trio-1986"]
"In October 1986, they publish four pages in Nature."

### beat-084
[VISUAL: paperPage page=0 focus=top]
"It is titled — Learning representations by back-propagating errors."

### beat-085
[VISUAL: paperPage page=0 quote="We describe a new learning procedure, back-propagation, for networks of neurone-like units." zoom=true]
"[serious] The abstract opens with one sentence."

### beat-086
[VISUAL: continue]
"A new learning procedure, back-propagation, for networks of neurone-like units."

### beat-087
[VISUAL: paperPage page=0 quote="The ability to create useful new features distinguishes back-propagation from earlier, simpler methods such as the perceptron-convergence procedure" zoom=true]
"[emphasized] And here is what makes it new — the ability to create useful new features. The hidden units finally learn."

### beat-088
[PAUSE 0.8s]
(silent)

### beat-089
[VISUAL: paperPage page=0 focus=bottom]
"[calm] The derivation begins on the bottom of page one."

### beat-090
[VISUAL: equationStep id=eq-001 step=0]
"Equation one — the forward pass. The total input to a unit j is a weighted sum of the outputs of the units feeding it."

### beat-091
[VISUAL: continue]
"[calm] x sub j equals the sum over i of y sub i times w sub j i."

### beat-092
[VISUAL: continue]
"This is just our weighted sum from 1805. From Legendre. Wearing 1986 notation."

### beat-093
[VISUAL: equationStep id=eq-002 step=0]
"[calm] Equation two — the activation. y sub j equals one over one plus e to the minus x sub j."

### beat-094
[VISUAL: continue]
"[pensive] Verhulst's logistic curve. Verbatim."

### beat-095
[VISUAL: equationStep id=eq-003 step=0]
"Equation three — the loss. E equals one half, sum over cases, sum over output units, of y minus d, squared."

### beat-096
[VISUAL: continue]
"[wistful] Sum of squared errors. Gauss, 1809. Same loss. A hundred and seventy-seven years later."

### beat-097
[PAUSE 0.9s]
(silent)

### beat-098
[VISUAL: continue]
"[emphasized] Everything so far is two centuries old. The new idea is the next page."

### beat-099
[VISUAL: paperPage page=1 quote="The backward pass starts by computing" zoom=true]
"[curious] How do we compute the gradient of the loss with respect to a weight buried two layers deep?"

### beat-100
[VISUAL: continue]
"[pensive] Picture a bucket brigade — but in reverse. The error sits at the output. Each layer passes it backward to the layer before, scaling it as it goes. By the time the brigade reaches the input weights, every weight has its own personal share of the blame."

### beat-101
[PAUSE 0.7s]
(silent)

### beat-102
[VISUAL: equationStep id=eq-004 step=0]
"[slow] First — the gradient at the output. Differentiate the loss. You get partial E partial y equals y minus d. The error itself."

### beat-103
[VISUAL: continue]
"[calm] How wrong was the output? That much."

### beat-104
[MANIM: scene=sigmoid_derivative.py class=SigmoidDerivative description="1. The sigmoid curve sigma of x is drawn at the top of the canvas. 2. Below it, its derivative bump appears, peaking at 0.25 at x equals zero. 3. The bump is annotated y times one minus y. 4. A few sample points on the sigmoid drop down to corresponding points on the bump. 5. Hold."]
"[curious] Now — push that gradient through the sigmoid. We need its derivative."

### beat-105
[VISUAL: continue]
"[slow] And here is the small miracle. The derivative of the sigmoid is — y times one minus y."

### beat-106
[VISUAL: continue]
"[emphasized] Just the output, multiplied by one minus the output. No exponentials, no x. Pure y."

### beat-107
[VISUAL: equationStep id=eq-006 step=0]
"[calm] So partial E partial x equals partial E partial y, times y, times one minus y."

### beat-108
[VISUAL: continue]
"[pensive] One line. That is why this whole derivation fits on a single page of Nature."

### beat-109
[PAUSE 0.6s]
(silent)

### beat-110
[VISUAL: equationStep id=eq-008 step=0]
"[slow] One more chain-rule step. From the input x, down to a weight w."

### beat-111
[VISUAL: continue]
"[calm] Partial E partial w equals partial E partial x, times the activity of the unit on the other end of the wire."

### beat-112
[VISUAL: continue]
"[pensive] So if you have the gradient at this layer, you have the gradient on every weight feeding into it."

### beat-113
[PAUSE 0.7s]
(silent)

### beat-114
[VISUAL: paperPage page=2 quote="\\partial E/\\partial y_i = \\sum_i \\partial E/\\partial x_j \\cdot w_{ji}" zoom=true]
"[serious] And now — the equation that earns the name back-propagation."

### beat-115
[VISUAL: equationStep id=eq-010 step=0]
"[slow] Partial E partial y at any hidden unit equals — the sum, over the units it feeds, of partial E partial x times the connecting weight."

### beat-116
[VISUAL: continue]
"[curious] Read that carefully. The gradient at a hidden unit is built entirely from the gradients of the units above it. Plus the weights you already know."

### beat-117
[VISUAL: continue]
"[emphasized] Which means — once you have the gradient at the top, you can compute it at the layer below. Then the layer below that. All the way down."

### beat-118
[PAUSE 1.0s]
(silent)

### beat-119
[MANIM: scene=chain_rule_cascade.py class=ChainRuleCascade description="1. A 3-layer MLP fades in. 2. Forward pass animates: values flow left-to-right through the network, each unit lighting briefly. 3. The network rests. 4. The error appears as a glowing red dot at the output. 5. Backward pass: red gradients flow right-to-left along the same wires, multiplied by sigma-prime equals y times one-minus-y at each unit. 6. Each weight gets its own personal gradient deposited on it. 7. Hold the network with all weights now glowing red, gradients deposited."]
"[pensive] Forward pass — values flow left to right. Backward pass — gradients flow right to left, along the same wires, scaled by y times one minus y at each unit."

### beat-120
[VISUAL: continue]
"[calm] At the end, every single weight in the network knows how to change."

### beat-121
[PAUSE 0.7s]
(silent)

### beat-122
[VISUAL: continue]
"[serious] Now — the chain rule itself is from Leibniz. 1676. It is older than calculus textbooks."

### beat-123
[VISUAL: continue]
"[emphasized] What was new in 1986 was applying it recursively, layer by layer, in software, to assign blame to weights you cannot directly see."

### beat-124
[VISUAL: continue]
"[pensive] That is the conceptual leap. Not the calculus. The credit assignment."

### beat-125
[PAUSE 0.9s]
(silent)

### beat-126
[VISUAL: equationStep id=eq-011 step=0]
"[calm] Now use the gradients. Equation eight — change each weight by minus epsilon times its gradient."

### beat-127
[VISUAL: continue]
"Take a small step downhill. Repeat."

### beat-128
[MANIM: scene=ball_zigzag_vs_momentum.py class=BallZigzagVsMomentum description="1. A long, narrow valley loss-surface is drawn in 3D. 2. On the left, a ball does plain gradient descent: it zigzags slowly down the valley floor, taking many tiny steps. 3. On the right, the same setup but with momentum: the ball glides smoothly down the valley floor, accelerating through the trough. 4. Both balls reach the minimum, but the right one arrives first. 5. Hold."]
"[curious] One last refinement. Equation nine. Add a momentum term."

### beat-129
[VISUAL: equationStep id=eq-012 step=0]
"[slow] Delta w at time t equals minus epsilon times the gradient, plus alpha times delta w at time t minus one."

### beat-130
[VISUAL: continue]
"[pensive] A heavy ball rolling on the loss surface. Without inertia, it zigzags in narrow valleys. With inertia, it glides through."

### beat-131
[PAUSE 0.7s]
(silent)

### beat-132
[VISUAL: paperPage page=2 focus=center]
"[wistful] One small note for the historical record. Paul Werbos derived backpropagation in his Harvard PhD thesis in 1974. Twelve years before this paper. Yann Le Cun rediscovered it independently in 1985."

### beat-133
[VISUAL: continue]
"But it was Rumelhart, Hinton, and Williams — in Nature, in October 1986 — who finally made the field listen."

## Act 10 — Every modern net is a nested regression

### beat-134
[MANIM: scene=deep_net_morph.py class=DeepNetMorph description="1. The 3-layer MLP from act 9 fades in. 2. More hidden layers grow in: it becomes 5 layers, then 8, then 12. 3. Every neuron in the network briefly highlights and is annotated 'logistic regression', one after another, in waves. 4. The annotations fade but a faint glow remains on each neuron. 5. The full deep network rests. 6. Hold."]
"[calm] Today's neural networks are deeper. Much deeper. Tens of layers. Sometimes hundreds."

### beat-135
[VISUAL: continue]
"[pensive] But every single neuron inside one of them is still a logistic regression. Every layer is still a stack of them."

### beat-136
[VISUAL: continue]
"[emphasized] And training is still — the chain rule. Applied recursively. Exactly as written in 1986."

### beat-137
[PAUSE 0.8s]
(silent)

### beat-138
[MANIM: scene=timeline_frieze.py class=TimelineFrieze description="1. A horizontal timeline appears spanning the full canvas. 2. Tick marks appear at 1805, 1809, 1838, 1943, 1958, 1960, 1969, 1986, and 'today' on the far right. 3. Above each tick, the corresponding portrait fades in — Legendre, Gauss, Verhulst, McCulloch and Pitts, Rosenblatt, Widrow and Hoff, Minsky and Papert, Rumelhart Hinton Williams. 4. Below each tick, a small icon: a fitted line, an S-curve, a hard-step neuron, the Mark I, a parabola, the XOR square, an MLP. 5. The whole frieze settles. 6. Hold."]
"[wistful] Eighteen-oh-five. Legendre fits a line."

### beat-139
[VISUAL: continue]
"Eighteen-oh-nine. Gauss gives squared error its meaning."

### beat-140
[VISUAL: continue]
"Eighteen-thirty-eight. Verhulst draws the S-curve."

### beat-141
[VISUAL: continue]
"Nineteen-forty-three. McCulloch and Pitts make the neuron mathematical."

### beat-142
[VISUAL: continue]
"Nineteen-fifty-eight. Rosenblatt's machine learns."

### beat-143
[VISUAL: continue]
"Nineteen-sixty-nine. Minsky and Papert close the door."

### beat-144
[VISUAL: continue]
"Nineteen-eighty-six. Rumelhart, Hinton, and Williams open it again."

### beat-145
[PAUSE 1.0s]
(silent)

### beat-146
[VISUAL: continue]
"[pensive] Two centuries. One idea. Minimize squared error. Repeat, stack, and finally — teach the middle layers to fix themselves."

### beat-147
[PAUSE 0.8s]
(silent)

### beat-148
[VISUAL: titleCard "Learning representations by back-propagating errors" subtitle="Rumelhart, Hinton, Williams — Nature 323, 533-536 (1986)"]
"[wistful] That is where modern deep learning begins."

### beat-149
[PAUSE 1.5s]
(silent)
