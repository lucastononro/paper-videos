---
name: nano-banana
description: Generate or edit images with Google's Nano Banana models (Gemini image-generation family — gemini-3.1-flash-image-preview, gemini-3-pro-image-preview, gemini-2.5-flash-image). Invoked when the user types /nano-banana <prompt> ... or asks for an image generation / edit. Wraps src/tools/nano-banana.ts which calls the REST `generateContent` endpoint directly — synchronous, single call. Uses GEMINI_API_KEY.
---

# /nano-banana skill

Generate or edit images with Nano Banana. Wraps `npm run nano-banana -- ...`,
which hits the Gemini REST `generateContent` endpoint directly. No SDK,
synchronous response (one POST, image bytes come back inline as base64).

## Quick reference

```
npm run nano-banana -- "<prompt>" [options]
```

| Flag                       | Default                              | Notes                                     |
| -------------------------- | ------------------------------------ | ----------------------------------------- |
| `-m, --model <id>`         | `gemini-3.1-flash-image-preview`     | see model list below                      |
| `-o, --out <path>`         | `nano-banana-output/<timestamp>.png` | dir if multiple images returned           |
| `-i, --image <path>`       | — (repeatable)                       | input image(s) for editing / compositing  |
| `--conversation <path>`    | —                                    | json file persisting multi-turn history   |
| `--save-text <path>`       | —                                    | also write model's text response to disk  |
| `--print-only`             | —                                    | print resolved request and exit           |

## Models

| Name             | ID                                  | When to use                                  |
| ---------------- | ----------------------------------- | -------------------------------------------- |
| Nano Banana 2    | `gemini-3.1-flash-image-preview` *(default)* | high-efficiency, up to 4K, default pick    |
| Nano Banana Pro  | `gemini-3-pro-image-preview`        | "hero" assets, harder reasoning, longer wait |
| Nano Banana v1   | `gemini-2.5-flash-image`            | bulk, lowest latency, lower fidelity         |

## Auth

`GEMINI_API_KEY` in `.env` (same key as `/veo` uses for the Gemini backend).
Get one at https://aistudio.google.com/apikey. No GCP project needed.

## Modes

| Mode                  | Inputs                                 |
| --------------------- | -------------------------------------- |
| Text → image          | `prompt`                               |
| Image edit            | `prompt` + `--image <one>`             |
| Multi-image composite | `prompt` + `--image <a> --image <b> …` |
| Iterative editing     | `prompt` + `--conversation <file.json>` (run multiple times, file is updated each turn) |

## Output

- Single image → written to `--out <path>` (or `nano-banana-output/<ts>_<hash>.png`).
- Multi-image response → `--out` is treated as a base; files are written as
  `<out-without-ext>/image-01.png`, `image-02.png`, ...
- If the model also emits text, it's printed to stderr unless
  `--save-text <path>` is set.

When attaching to a paper-video, write straight into its `images/` dir:
`--out videos/<slug>/images/img-NNN.png`.

# Prompting guide — how to talk to Nano Banana

> **THE SINGLE MOST IMPORTANT RULE: The longer and more detailed the prompt,
> the better the image. There is no upper limit that matters. A 600-word
> prompt beats a 60-word prompt beats a 6-word prompt — every time, no
> exceptions. If you are about to send a one-sentence prompt, STOP and
> expand it first.**

This is not a stylistic preference — it's how the model works. The model
rewards specificity at every level. Generic prompts ("a coffee shop logo",
"a beautiful mountain", "a cool sci-fi scene") return bland, AI-soup
results — the kind that scream "generated" the moment you see them.
Cinematic, hyper-detailed, comprehensively-specified prompts return images
that look deliberately designed by a working art director.

**Target lengths, by ambition:**

- Trivial assets (an icon, a flat illustration): 150–250 words minimum.
- Standard scene / portrait / product shot: **400–700 words.**
- Hero asset, complex composition, anything with multiple subjects, a
  specific mood, or a precise art-direction reference: **800–1500 words.**
- A one-sentence prompt is almost always wrong. If your prompt fits in a
  tweet, you have not yet done the work.

**Why longer wins, every time:**

1. **The model averages over what you didn't say.** Anything you leave
   unspecified — lighting direction, camera height, color temperature,
   material finish, mood, era, time of day, weather, subject's gaze,
   composition rule, focal length — gets filled in with the statistical
   median of training data. Median = generic. Every detail you add
   replaces median with intent.
2. **Earlier tokens weigh more.** A 600-word prompt that establishes the
   subject + scene + mood in the first paragraph pins the model's
   trajectory early. A short prompt with the same first sentence has
   nothing to reinforce it.
3. **Specificity compounds.** "A man" averages across all men. "A 67-year-old
   Greek fisherman with sun-scarred forearms, deep-set eyes, three days of
   silver stubble, wearing a cobalt-blue cable-knit sweater darned at the
   elbow, holding a rope-burned hand against the rail of a 1970s wooden
   caique" is one image. The second prompt does not just describe a
   different man — it eliminates 99.9% of the possibility space the first
   prompt left open. That elimination is where image quality comes from.
4. **Cinematic vocabulary is free.** The model has absorbed film-school
   and photography terminology fluently. "85mm portrait lens, shallow
   depth of field, golden-hour rim light from camera-left, Kodak Portra
   400 grain, muted teal-and-amber dual-tone grade" costs you 20 seconds
   to write and changes the output category entirely. Use it.

**Rule of thumb when expanding a brief:** every noun should grow an
adjective; every adjective should grow a comparison or measurement; every
scene should grow a light source and a camera position; every subject
should grow an action and an expression; every palette should grow named
colors (or hex codes); every style should grow two references.

## The seven beats every prompt should hit

Order matters — earlier mentions weigh more.

1. **Subject** — what or who, in concrete nouns. ("A 70-year-old fisherman", not "an old man".)
2. **Action / pose / expression** — what is the subject doing, where is their weight, where are they looking, what does their face tell us.
3. **Setting** — interior or exterior, time of day, weather, season, geography. Name specific places when the look is iconic (a Tokyo back-alley after rain, a Cuban tobacco field at dusk).
4. **Composition & framing** — shot type (extreme close-up, medium shot, wide, overhead, low-angle hero shot), lens (35mm, 85mm portrait, anamorphic), aspect, where the subject sits in the frame, what's in the foreground / midground / background.
5. **Lighting** — direction, hardness, color temperature, motivation. ("Golden-hour rim light from camera-left, soft fill bouncing off a white wall, deep navy shadows" is good; "nice lighting" is not.)
6. **Color, mood, texture** — palette in words ("muted teal and rust"), film stock if you want a look (Kodak Portra 400, Cinestill 800T tungsten cast, Fuji Velvia saturation), grain, contrast.
7. **Style anchor** — what tradition does this live in? Photographic? Painterly? 3D render? Studio Ghibli? Editorial fashion? Wes-Anderson-symmetry? Vermeer chiaroscuro? Name two or three references; the model will average them.

## Practical writing patterns

- **Cinematic vocabulary works.** "Anamorphic lens flare," "shallow depth of field," "Steadicam mid-shot," "Roger Deakins lighting," "key + rim + practical lights," "volumetric fog," "Dutch angle." The model has absorbed film-school language — use it.
- **Specify what the camera sees, not what the subject thinks.** "Her hand trembles as she lifts the cup" > "she is nervous". Images cannot show interior states; describe the body language that implies them.
- **Materials & textures by name.** "Brushed copper", "weathered teak", "blown borosilicate", "raw silk dupioni" beat "metallic", "wood", "glass", "fabric".
- **Concrete numbers and references.** "1970s East-German Trabant 601 in faded sea-foam, parked on wet cobblestones" beats "an old car on a street".
- **Negative descriptions sparingly.** Saying "no people, no text, no watermark" sometimes helps with editing tasks. Don't lead with negatives.
- **Quality tags last, not first.** "8K, photorealistic, hyper-detailed, award-winning" is a tail garnish — it doesn't compensate for a thin scene description. Put your effort into the scene.

## Example: a thin prompt vs. a fat one

❌ **Thin** *(don't)*

> A coffee shop logo for Bean Dream.

✅ **Fat** *(do)*

> Hand-lettered logo for a third-wave coffee shop called "Bean Dream". The
> typography is a single condensed script in deep espresso-brown ink with a
> slight letterpress impression — letters that look hand-pulled, not
> digitally drawn, with one small fleck of bleed where the nib over-pressed.
> A tiny illustration nests above the "D": a single coffee cherry, half in
> shadow, the leaf curling toward the type. The mark sits centered on a
> warm cream paper background with a faint linen texture, soft top-down
> lighting suggesting a flat-lay shot at golden hour through a north-facing
> window. Palette: ivory cream (#F2EBD9), espresso brown (#3B241B), a
> single muted cherry red (#9C2F2A). Style: editorial minimalism in the
> vein of Aesop packaging and 1960s Penguin paperbacks. No drop shadow, no
> gradients, no extraneous decorative elements. Composition: 1:1 square,
> mark fills the center 60% of the frame, generous breathing room.

Both prompts ask for "a coffee shop logo." The first returns a stock
logo-generator output. The second returns something that could ship.

## Editing prompts (when `--image` is set)

When you pass an input image, the prompt becomes an instruction, not a
description from scratch. Be surgical and concrete about what changes,
what is preserved.

- Bad: "make it cooler"
- Good: "Keep the subject, pose, hair, clothing, and background identical.
  Shift the color grade to a cool teal-and-orange dual-tone: highlights
  pushed toward warm orange (#E8B274), shadows pulled toward muted teal
  (#3A6B7A). Add a subtle anamorphic horizontal lens flare across the eyes
  from a light source just out of frame on the left. Increase contrast by
  about 20%, deepen the blacks but preserve detail in the darkest folds of
  the jacket. Do not alter facial features, expression, or skin texture."

## When invoking from the orchestrator

When the user types `/nano-banana <free-form>`, treat the whole tail as
the prompt. **Do not silently shorten it. Do not pass a short prompt
through unchanged.**

If the user gave you a short brief (anything under ~200 words), your job
before calling the tool is to expand it into a fat, cinematic,
multi-paragraph prompt covering every one of the seven beats above. Aim
for 400+ words at minimum, 800+ for anything that matters. Show the user
the expanded prompt before generating so they can redirect — but default
to expansion, not pass-through. **A short prompt sent to the API is a bug
in this skill, not a feature.**

Mapping natural-language hints:

- "edit this" + a path → `--image <path>`
- "combine these" + multiple paths → multiple `--image` flags
- "iterate on this" / "keep going" → `--conversation <slug>.json` and
  reuse the same file across calls
- "use the pro model" / "hero asset" / "I need this perfect" → `-m gemini-3-pro-image-preview`
- "fast" / "draft" / "thumbnails" → keep default (or `gemini-2.5-flash-image` for bulk)
- "for paper-video <slug>" → `--out videos/<slug>/images/img-NNN.png`

If `GEMINI_API_KEY` is missing, tell the user to add it to `.env` before
running.

## Tips

- Calls are synchronous and usually return in 5–15 seconds. No polling.
- Up to 4K output on Nano Banana 2 — just describe high resolution and
  fine detail in the prompt; no separate resolution flag.
- Conversation mode is single-file: the json captures every turn (user
  text + model response, including the previous image as base64) so
  subsequent edits stay coherent.
- Use `--print-only` first when you're unsure — it shows the resolved
  body without spending API quota.
- Generated images land in `nano-banana-output/` by default (gitignored).
