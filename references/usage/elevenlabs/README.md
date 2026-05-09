# ElevenLabs narration — prompting + tuning guide (2026)

The narrator/producer subagents' primary reference. Read every section before generating audio.

## 1. Voice catalog

Voices are defined in `voices.yaml` by alias only (e.g. `pharaoh`). Per-video `config.yaml` and per-section `script.md` frontmatter reference voices by alias — never paste a raw `voice_id` into a script.

To add a voice:
1. Browse https://elevenlabs.io/app/voice-library and copy a voice id.
2. Add an alias under `voices:` in `voices.yaml` with the settings below.
3. (Optional) Set `default_voice` to the new alias.

## 2. Default model: `eleven_v3`

In 2026 we default to **`eleven_v3`** because it supports **audio tags** — bracketed inline cues like `[curious]`, `[pause]`, `[emphasized]` that give narration the lecture-with-personality feel of a 3Blue1Brown explainer. Tags are the single biggest expressiveness lever ElevenLabs offers.

Other models still available:

| Model | When to use | Why we don't default to it |
|---|---|---|
| **`eleven_v3`** | **Default.** Audio-tag aware, expressive, supports `with-timestamps`. | — |
| `eleven_multilingual_v2` | Long single-shot narrations, very stable but tone-flat. 10 000-char limit per req. | No audio tags. Voices sound dry on lecture content. |
| `eleven_flash_v2_5` | Real-time / streaming use cases. | Disables number normalization → mangles equations. |
| `eleven_turbo_v2_5` | Cost-sensitive batch. | Lower quality vs v3 for the same price tier. |

Char limit per `eleven_v3` request: **5 000**. We send beats of <600 chars sequentially, so the limit is never relevant. Rate limit is plan-dependent (Free: ~3 concurrent, Creator: ~10, Pro: ~50).

## 3. Audio tags — the personality knob

A tag is a bracketed directive embedded in the narration text. Example:

```
[curious] Why does scaling the dot product matter? [pause] When d sub k is large,
[serious] the variance grows fast — and softmax saturates.
```

The model strips the tags before synthesis and applies them as direction. The output has the curious upturn on the first sentence, a deliberate pause, and a serious tone for the second clause. **Tags don't appear in the audio.** They also don't break `with-timestamps` — alignment data is computed on the post-strip text, so word-level sync is preserved.

### 3a. The curated subset for academic narration

We use only a small, opinionated subset. These are the tags the storyteller should reach for first. Anything outside this list, *don't use* unless you have a specific reason and have tested.

**Tone & disposition** (use 1 tag per ~3 sentences max):

| Tag | When | Example |
|---|---|---|
| `[curious]` | Opening a question or a "huh, why does this work?" beat | `[curious] What does it mean for two vectors to be similar?` |
| `[calm]` | Steady exposition, definitions, technical details | `[calm] Q is a matrix of shape n by d.` |
| `[serious]` | A claim that matters, a warning, a "the paper hand-waves this but…" | `[serious] Without scaling, gradients vanish.` |
| `[conversational]` | Hooks, framing, audience asides | `[conversational] In 2017, eight researchers tried something audacious.` |
| `[pensive]` | Reflective beats, "let's sit with this for a moment" | `[pensive] So attention isn't really new — it's just made differentiable.` |
| `[emphasized]` | Single landmark words/phrases that need stress | `[emphasized] Every position attends to every other position.` |
| `[wistful]` | Closing implications, looking back | `[wistful] One paper. Two decades of architecture, replaced.` |

**Pacing**:

| Tag | Effect | Use |
|---|---|---|
| `[pause]` | ~0.4-0.6s beat | Before a key claim, after a question, between an old idea and the next |
| `[long pause]` | ~0.8-1.2s beat | Sparingly. After a profound moment. Once or twice per video. |
| `[slow]` | Slow next phrase | When precision matters: equation step-by-step verbal walk |
| `[rushed]` | Fast next phrase | Almost never. Maybe a "these details aren't important" parenthetical. |

**Reactions** (use VERY rarely — at most 1-2 per 10-min video):

| Tag | When |
|---|---|
| `[sighs]` | A "the paper is wrong about this" lament. Sparingly. |
| `[chuckles]` | A genuinely amusing moment in the explanation. Maybe once per video. |

### 3b. Tags we DO NOT use (for academic narration)

These exist in the v3 library but undermine credibility on technical content:

- `[laughs]`, `[giggles]`, `[shouts]`, `[whispers]` (whispers may exist in voice library but never on math)
- `[mischievous]`, `[playfully]`, `[sarcastic]`, `[deadpan]`, `[childlike]`
- `[crying]`, `[gasps]`, `[trembling]`, `[tired]`, `[robotic]`
- Accent / character tags (`[British accent]`, `[pirate voice]`)

If you find a beat tempted to use one of these, the script is wrong — fix the words, not the delivery.

### 3c. Tag placement rules

- **One tag per beat is the target.** Two is the hard ceiling. Three+ tags in 25 words sounds glitchy.
- **Tags persist** until contradicted or sentence-end. `[serious] foo. bar.` — both sentences serious. `[serious] foo. [calm] bar.` — second sentence calm.
- **Place tags before the words they modify.** `[curious] Why does this work?` — yes. `Why does this work [curious]?` — no.
- **Don't stack opposing tags.** `[serious][playfully]` is contradictory and produces confusion.
- **Tags can stack only when complementary**: `[curious][slow]` works.
- **Spacing is optional**: `[curious]hello` and `[curious] hello` both work. We prefer the spaced form for readability.
- **Mid-sentence tags** are allowed but rare: `… so we have, [emphasized] one — single — formula.`

### 3d. Tag budget per beat

- Beat is 5-10 words: at most **1 tag** (usually at the start).
- Beat is 11-25 words: at most **2 tags** (start + one mid-beat shift if needed).
- Pause beats: no tags — they're already silent.
- Silent display beats (titleCards): no tags — no audio.

### 3e. Tag-rich example — beat sequence

```
beat-007  [MANIM: rnn_sequential]
"[conversational] For years, sequence models meant recurrence. Each step waited for the last."

beat-009  [MANIM: rnn_long_path]
"[curious] To connect position one to position one hundred? [pause] You walked through every step in between. [serious] Slow. Gradients faded."

beat-011  [MANIM: qkv_intro]
"[calm] The Transformer drops the chain. It uses three new objects."

beat-022  [MANIM: softmax_step]
"Pass it through softmax. [emphasized] Now the scores sum to one — they are weights."

beat-029  [MANIM: scaling_intuition]
"[serious] When d sub k is large, dot products grow. Softmax saturates. [pause] Gradients vanish."
```

Notice: most beats have ZERO tags. Tags appear only when the narrator's tone is doing real semantic work.

## 4. Voice settings (still apply, interpreted differently for v3)

```yaml
stability: 0.50            # Maps roughly to v3 "Natural" mode. See below.
similarity_boost: 0.75     # default; protects voice identity
style: 0.10                # mild warmth; emotional range comes from tags, not style
use_speaker_boost: false   # no latency benefit for offline render
output_format: mp3_44100_128
```

### Stability ↔ v3 mode mapping

ElevenLabs v3 conceptually replaces the stability slider with three "stability modes". Our `voices.yaml` slider value maps as:

| `stability` value | v3 mode | Behavior |
|---|---|---|
| 0.20 - 0.40 | **Creative** | Highly responsive to tags, more variation, occasional drift |
| **0.50 - 0.65** | **Natural** ← *default* | Balanced expressiveness and accuracy |
| 0.70 - 0.90 | **Robust** | Consistent prosody, tags muted, safest for very long narrations |

Use 0.50 (Natural) for academic narration. Drop to 0.40 if tags are not landing emotionally. Raise to 0.65 if the voice drifts mid-segment.

### Voice compatibility

- **Library voices and Instant Voice Clones (IVC):** full v3 tag support.
- **Professional Voice Clones (PVC):** less reliable for v3. Tags may produce muted effects. Test before bulk generation.
- **Older v1 voices:** variable. Test 3-5 critical tags before a full render.

## 5. Prompt engineering — writing text for the best TTS output

Tags are the personality. The text quality is the foundation. The same tags produce dramatically different results depending on the underlying writing.

### 5a. Punctuation drives micro-timing (still matters even with tags)

| Mark | Effect | When to use |
|---|---|---|
| `,` | ~0.1-0.2s pause, natural breath | Mid-sentence, between clauses |
| `—` (em-dash) or `...` | ~0.3-0.5s pause | Setup-then-payoff beats |
| `.` | Natural sentence boundary, ~0.4-0.6s pause | Always end full sentences |

Use `[pause]` only for emphatic beats; use `,` and `—` for the regular flow.

### 5b. Numbers, equations, Greek letters

The visual on screen carries the symbols; the narration spells them out phonetically:

| Don't write | Write instead |
|---|---|
| `x_1` | `x sub one` |
| `α` or `\alpha` | `alpha` |
| `√(x² + y²)` | `the square root of x squared plus y squared` |
| `\frac{a}{b}` | `a over b` |
| `Q · K^T / √d_k` | `Q dot K transpose, divided by the square root of d sub k` |

**Never** write raw LaTeX in narration text.

### 5c. Sentence shape

- **10-20 words per sentence** is the sweet spot.
- Break long derivations across multiple short sentences.
- Open every segment with a short framing sentence.

### 5d. Capitalization

- Don't use ALL-CAPS for emphasis — sounds jarring. Use `[emphasized]` or stress-words instead.
- Proper nouns: `Transformer` not `TRANSFORMER`. Acronyms: `B E R T` (spelled) on first mention.

### 5e. Common mistakes to avoid

1. SSML `<break time="...">` tags — **not supported in v3 or v2**. Use `[pause]` or punctuation.
2. Tag-spam (3+ tags per beat) — sounds glitchy.
3. Conflicting tags (`[serious][playful]`) — hurts coherence.
4. ALL-CAPS mid-sentence emphasis.
5. Raw digits in equation contexts (`The value is 3.14159`).
6. Using `[laughs]` / `[giggles]` / etc. on academic content — undermines credibility.

## 6. Multi-segment prosody consistency (request stitching)

The producer subagent calls `narrate.ts` once per beat. Cross-beat prosody flows naturally because `narrate.ts` auto-populates the `previous_text` and `next_text` fields from the surrounding beats' narration. You don't have to think about it.

If you regenerate a single beat in the middle, the surrounding context is still applied automatically.

## 7. Word-level timestamps

The `with-timestamps` endpoint returns character-level alignment. `src/lib/timeline.ts` collapses runs of non-space chars into words. Tags are stripped from the alignment data, so words sync correctly even for tag-rich narration.

## 8. Quality gate before full render

After the first 3 narrated beats, **stop** and listen:

```bash
afplay videos/<slug>/narration/beat-001.mp3   # macOS
```

Check:
- **Tone match.** Does the voice sound like the visual asks it to? If a `[curious]` beat lands flat, fix the writing first; if it's still flat, drop stability to 0.40.
- **Mispronounced math.** Always a phrasing fix in the script, not a settings change.
- **Awkward pacing.** Punctuation fix — add a comma or em-dash before the awkward phrase.
- **Tags read aloud** (i.e., you hear "open bracket curious close bracket"). The voice is not v3-compatible. Switch model to `eleven_multilingual_v2` for that voice or pick a different voice.

## 9. Cost guard

ElevenLabs free tier ≈ 10 000 chars/month. Starter ≈ 30 000. v3 charges per character of *input text* (tags don't count as billable chars in most tiers — verify on your plan).

Estimate before generating: sum `script.md` segment lengths × 1.05 for safety. If you'd exceed the user's plan, stop and ask.
