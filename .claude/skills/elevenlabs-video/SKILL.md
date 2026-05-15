---
name: elevenlabs-video
description: Generate short video clips with ElevenLabs' creative video models (Seedance 2 / Seedance 1.x Pro, Kling 2.5 / 2.6 / 3.0, Sora 2 / 2 Pro, Veo 3.1, Wan 2.5 / 2.6). Invoked when the user types /elevenlabs-video <prompt> ... or asks for an ElevenLabs video generation. Wraps src/tools/elevenlabs-video.ts which calls the ElevenCreative video-generation REST endpoint. Uses ELEVENLABS_API_KEY (same key as /v1/text-to-speech).
---

# /elevenlabs-video skill

Generates a video clip with one of ElevenLabs' hosted video models. Wraps
`npm run elevenlabs-video -- ...`. The same `ELEVENLABS_API_KEY` you use for
narration is the auth — `xi-api-key` header.

## Access status (read this first, May 2026)

ElevenLabs launched Image & Video on Nov 17, 2025 as a **dashboard-only beta**
at https://elevenlabs.io/video. The accompanying **ElevenCreative Studio API
is private beta — "available upon request, contact sales"** as of this
writing. The official `@elevenlabs/elevenlabs-js` npm SDK does NOT yet expose
a video-generation namespace (only audio / dubbing / studio-voiceover-projects
as of v2.47).

**What this means for the tool:**

1. If you have **enterprise/beta access** (request via https://elevenlabs.io/contact-sales or the Studio dashboard), `npm run elevenlabs-video` will work end-to-end against the REST endpoint.
2. If you don't, the tool detects a 401/403/404 and prints a clear "dashboard-only — generate at https://elevenlabs.io/video and save the mp4 to `videos/<slug>/manim/beat-NNN.mp4` manually" message. The pipeline falls back to Veo (`/veo`) without breaking.
3. The endpoint path and request shape baked into the tool are **provisional best-guesses** modeled on ElevenLabs' existing public REST conventions (`/v1/sound-generation`, `/v1/music`). Once ElevenLabs publishes official docs, override via `ELEVENLABS_VIDEO_PATH` env var in `.env` (e.g. `/v1/video-generation`) until the default is patched.

The skill exists now so that (a) the pipeline's prompt logic and provider-preference order are correct, and (b) the tool is ready to flip on the moment access is granted. **Do not treat the endpoint URL as load-bearing** — if it doesn't work, fall back to Veo and tell the user.

## Quick reference

```
npm run elevenlabs-video -- "<prompt>" [options]
```

| Flag                      | Default                       | Notes                                                          |
| ------------------------- | ----------------------------- | -------------------------------------------------------------- |
| `-m, --model <id>`        | `kling-2.6`                   | see model list below                                            |
| `-o, --out <path>`        | `elevenlabs-video-output/<timestamp>.mp4` | or directory if `--count>1`                          |
| `-a, --aspect <ratio>`    | `16:9`                        | `16:9`, `9:16`, `1:1` (model-dependent)                        |
| `-d, --duration <seconds>`| `8`                           | typical: `4`, `5`, `8`, `10` (model-dependent)                 |
| `-r, --resolution <res>`  | (model default)               | `720p`, `1080p`, `4k` (model-dependent)                        |
| `-c, --count <n>`         | `1`                           | up to 4                                                         |
| `--seed <n>`              | —                             | reproducibility                                                 |
| `--negative <text>`       | —                             | exclude content                                                 |
| `--audio` / `--no-audio`  | `--no-audio` (default)        | request native audio (Seedance 2 / Wan 2.6 only)                |
| `--image <path>`          | —                             | first frame (local, `https://`, or `data:`)                     |
| `--last-frame <path>`     | —                             | last frame (requires `--image`)                                 |
| `--reference <path>`      | — (repeatable, ≤3)            | reference images for character/style continuity                 |
| `--camera <mode>`         | —                             | `pan_left`, `tilt_up`, `push_in`, etc. (model-dependent)        |
| `--poll-interval <s>`     | `10`                          | how often to poll the operation                                 |
| `--print-only`            | —                             | print resolved request and exit (no API call)                   |

## Models

ElevenLabs hosts a rotating catalog of top-tier video models. The IDs below
are the names exposed in the dashboard model picker (May 2026). The script
sends `model` in the request body; the actual id keys may differ
(`seedance-2.0` vs `seedance_2_0`) — the tool normalizes from the friendly
name. Override with `--model-id-raw <exact-string>` if needed.

### Bytedance — Seedance

| Friendly id        | Strengths                                                                                  | Caveats                                              |
| ------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `seedance-2`       | **Most capable on ElevenCreative.** Multimodal (text+image+video+audio in one pass). Joint A/V generation in a single shot. | **NOT available in the US.** Geo-restricted at ElevenLabs' end. |
| `seedance-1-pro`   | Dynamic multi-shot sequences, stable physics. Good cinematic baseline.                     | No native audio.                                     |
| `seedance-1.5-pro` | Enhanced temporal stability, precise transitions. Best Seedance for paper-video b-roll.    | No native audio.                                     |

### Kuaishou — Kling

| Friendly id   | Strengths                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `kling-2.5`   | Balanced quality + speed. Strong on complex motion / physics.                                        |
| `kling-2.6`   | **Default.** Enhanced motion fidelity, smoother transitions. Best general-purpose model in 2026.     |
| `kling-3.0`   | 4K output, advanced motion dynamics, up to 6 cuts in a single generation. Best for "hero" assets.    |

### OpenAI — Sora

| Friendly id   | Strengths                                                                            |
| ------------- | ------------------------------------------------------------------------------------ |
| `sora-2`      | Realistic physics-aware videos, high-speed generation.                               |
| `sora-2-pro`  | Highest-fidelity professional output, precise multi-shot control. Slower.            |

### Google — Veo

| Friendly id   | Strengths                                                                |
| ------------- | ------------------------------------------------------------------------ |
| `veo-3.1`     | Professional-grade with start/end frames and image references.           |
| `veo-3.1-fast`| High-speed iteration variant.                                            |
| `veo-3`       | Production-ready with integrated narrative audio generation.             |

(If you specifically want Veo and don't have ElevenLabs Studio API access, use the standalone `/veo` skill — it talks to the Gemini API directly with `GEMINI_API_KEY`.)

### Alibaba — Wan

| Friendly id  | Strengths                                                                       |
| ------------ | ------------------------------------------------------------------------------- |
| `wan-2.5`    | Cinematic motion with high prompt fidelity.                                     |
| `wan-2.6`    | Unified multimodal platform with native audio sync.                             |

## Picking a model

- **Default for paper-videos b-roll**: `kling-2.6`. Good motion, US-available, broad style range, fast enough.
- **Hero / closing card / teaser headline**: `kling-3.0` or `sora-2-pro`. Slower but higher fidelity.
- **Atmospheric / metaphor beats**: `seedance-1.5-pro`. Strong on slow motion and held tableaus.
- **Need synced audio in the clip itself** (rare for paper-videos — the producer's narration usually overlays): `seedance-2` (non-US) or `wan-2.6`. Most paper-video clips should pass `--no-audio` (the default).
- **Character continuity across multiple clips** (a recurring figure across the teaser, mid, closer): `kling-3.0` + `--reference char.png` (3 reference images supported).

## Auth

`ELEVENLABS_API_KEY` in `.env` — the same key already used by `src/tools/narrate.ts`. No additional key needed.

**Access tier required:** ElevenCreative Studio API access (private beta). If your key doesn't have video scope, the tool returns the access-denied error described in "Access status" above.

## Modes

| Mode                 | Inputs                                            |
| -------------------- | ------------------------------------------------- |
| Text → video         | `prompt`                                          |
| Image → video        | `prompt` + `--image <first-frame>`                |
| First + last frame   | `prompt` + `--image <first>` + `--last-frame <last>` |
| Reference-guided     | `prompt` + 1–3 `--reference <path>` (character / style refs) |

## Output

- Single video → `--out <path>` (default `elevenlabs-video-output/<timestamp>_<hash>.mp4`).
- Multi-video response → `--out` is treated as a base directory; files written as `video-01.mp4`, `video-02.mp4`, ...
- When attaching to a paper-video, write straight into its `manim/` directory: `--out videos/<slug>/manim/beat-NNN.mp4`. The composition treats it identically to a Manim mp4 (same `visual.kind === 'manimClip'`, same hold-last-frame logic).

# Prompting guide — how to talk to ElevenLabs' video models

The same length-and-specificity rule that governs Nano Banana applies here.
A one-sentence prompt is a bug. **400–800 words of cinematographic detail is the sweet spot for paper-video b-roll**; 800–1500 for hero assets.

## The seven cinematographic beats every prompt should hit

Order matters — earlier mentions weigh more.

1. **Subject** — concrete nouns. "A weathered fisherman", not "an old man".
2. **Action / pose / motion** — what is the subject doing, where is the body weight, where is the gaze. Video especially needs explicit motion direction.
3. **Setting** — interior / exterior, time of day, weather, season, geography. Specific places when iconic ("a Tokyo back-alley after rain", "a Cuban tobacco field at dusk").
4. **Camera** — shot type (extreme close-up, medium, wide, overhead, low-angle hero), lens (35mm, 85mm portrait, anamorphic), movement (dolly-in, pan-left, push-in, hand-held tracking). For a still or held shot, say so explicitly.
5. **Lighting** — direction, hardness, color temperature, motivation. "Golden-hour rim light from camera-left, soft bounce fill, deep navy shadows" is good; "nice lighting" is not.
6. **Color, mood, texture** — palette in words ("muted teal-and-amber dual-tone"), film stock if you want a look (Kodak Portra 400, Cinestill 800T tungsten cast, Fuji Velvia saturation), grain, contrast.
7. **End state** — for video, this is the SINGLE most important addition over still-image prompting. The viewer's last impression is the held frame. End with explicit language: _"…ending on a held wide tableau as the camera reaches the ridge."_ Without this, all of these models tend to keep moving the camera through the final frame and the clip ends mid-motion.

## Practical patterns

- **Cinematographic vocabulary works.** "Anamorphic lens flare," "Steadicam mid-shot," "Roger Deakins lighting," "key + rim + practical lights," "volumetric fog," "Dutch angle," "matte foreground." These models have absorbed film-school language — use it.
- **Describe motion concretely.** "Camera dollies slowly forward at walking pace" beats "moving camera". "Subject's hand lifts gradually over 3 seconds" beats "subject moves hand".
- **Specify what the camera sees, not what the subject thinks.** Video can't show interior states; describe the body language that implies them.
- **Materials & textures by name.** "Brushed copper", "weathered teak", "blown borosilicate", "raw silk dupioni" beat generic nouns.
- **Concrete numbers and references.** "1970s East-German Trabant 601 in faded sea-foam, parked on wet cobblestones" beats "an old car on a street".
- **Quality tags last, not first.** "4K, photorealistic, hyper-detailed" is a tail garnish — it doesn't compensate for a thin scene description. Put your effort into the scene.
- **No people / generic faces.** ElevenLabs' upstream models (Kling, Sora especially) silently reject prompts naming real people, famous brands, copyrighted characters. Rephrase generically — "a 1970s European fisherman", not a named person.

## Example: thin vs. fat prompt

❌ **Thin** *(don't)*

> Cinematic drone shot over misty mountains at sunrise.

✅ **Fat** *(do)*

> A slow, ascending drone push-in over a misty mountain valley at golden-hour sunrise. The camera starts at low altitude tracking the spine of a forested ridge, then climbs steadily over 6 seconds until it clears the treetops and reveals an undulating sea of fog filling the valley below, with a single distant peak catching the first warm sun. Lighting: deep golden-amber rim light from camera-right at a low angle, motivated by the rising sun just out of frame; cooler blue-grey ambient fill in the fog itself. Color grade: muted teal-and-amber dual-tone, highlights pushed toward warm honey (#E8B274), shadows pulled toward muted teal-grey (#3A4A5A), mid contrast. Texture: 35mm anamorphic feel with subtle horizontal lens flare across the foreground branches, very fine Kodak Vision3 250D-grade grain, no digital sharpening. Mood: contemplative, slightly melancholy, the camera moves as if reluctant to disturb the stillness. Reference: the opening minute of "Arrival" (2016) and the misty-valley plates from "The Lord of the Rings" extended cuts. End the shot on a HELD wide tableau as the camera reaches its final altitude — the camera stops, motion settles, the only remaining movement is gentle ripple in the fog. No people, no buildings, no text, no watermark.

Both prompts ask for the same thing. The first returns generic stock footage. The second returns a clip you could cut into a paper-video teaser.

## When invoking from the orchestrator

When the user types `/elevenlabs-video <free-form>`, treat the whole tail as the prompt. **Do not silently shorten it. Do not pass a short prompt unchanged.** Expand it to 400+ words covering the seven beats above before generating; show the user the expanded prompt first so they can redirect.

Mapping natural-language hints onto flags:

- "vertical / portrait / shorts" → `--aspect 9:16`
- "square / instagram" → `--aspect 1:1`
- "8 seconds" / "10 seconds" → `--duration <n>` (model-dependent ceiling)
- "no audio / silent" → `--no-audio` (the default — paper-video narration overlays)
- "1080p / 4k" → `--resolution 1080p|4k`
- "from this image" + path → `--image <path>`
- "transition from X to Y" + two paths → `--image X --last-frame Y`
- "make N variations" → `--count N`
- "use seedance / kling / sora" → `-m <id>` (default `kling-2.6`)
- "for paper-video <slug>" → `--out videos/<slug>/manim/beat-NNN.mp4` (the composition treats it as a `manimClip`)

If the access-denied error fires (401/403/404), tell the user:

> ElevenLabs Studio API access isn't enabled for your account. Two options:
> (1) Request access at https://elevenlabs.io/contact-sales, OR (2) generate
> manually at https://elevenlabs.io/video and save the mp4 to
> `videos/<slug>/manim/beat-NNN.mp4`. Until then, the visualizer will fall
> back to `/veo` (Gemini API, `GEMINI_API_KEY`) for cinematic clips.

If `ELEVENLABS_API_KEY` is missing entirely, tell the user to add it before running. Don't try to substitute another tool — the visualizer's preference chain (ElevenLabs → Veo → Manim) is enforced in their prompt.

## Tips

- Operations are long-running (45–180s depending on model and duration). The script polls every 10s and prints elapsed time. `--poll-interval 5` for faster feedback during dev.
- Most models accept image inputs as base64 (script handles this automatically from `--image <path>`).
- `--print-only` shows the resolved request body without spending quota — useful when you're not sure of the parameter shape.
- Generated videos default to landing in `elevenlabs-video-output/` (gitignored).
- For paper-video pipelines, the visualizer writes directly into `videos/<slug>/manim/beat-NNN.mp4` so the composition picks it up as a `manimClip` — same path as Manim renders, no schema change needed.
