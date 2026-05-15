---
name: veo
description: Generate video clips with Google's Veo model (text-to-video, image-to-video, first/last frame, video extension/editing, reference-image-to-video). Invoked when the user types /veo <prompt> ... or asks for a Veo generation. Wraps src/tools/veo.ts which calls the REST API directly — Gemini API by default (uses GEMINI_API_KEY), Vertex AI as opt-in (uses gcloud + GOOGLE_CLOUD_PROJECT).
---

# /veo skill

Generates a video clip with Veo. Wraps `npm run veo -- ...`, which calls the
REST API directly. No SDK dependency.

> **Note (May 2026):** the paper-videos pipeline prefers `/elevenlabs-video`
> over `/veo` because ElevenLabs Studio hosts a broader catalog (Seedance +
> Kling + Sora + Veo + Wan) behind one key the project already uses for TTS.
> `/veo` is the **fallback** when ElevenLabs Studio API access isn't enabled
> (the Studio video API is private beta as of this date — request at
> https://elevenlabs.io/contact-sales). Invoking `/veo` directly is fine and
> bypasses that preference; the Gemini-API path still works first-class.

## Quick reference

```
npm run veo -- "<prompt>" [options]
```

Common options:

| Flag                              | Default                     | Notes                                                 |
| --------------------------------- | --------------------------- | ----------------------------------------------------- |
| `-m, --model <id>`                | `veo-3.1-generate-preview`  | see model list below                                  |
| `-o, --out <path>`                | `veo-output/<timestamp>.mp4`| or directory if `--count>1`                           |
| `-a, --aspect <ratio>`            | `16:9`                      | `16:9`, `9:16`, `1:1`                                 |
| `-d, --duration <seconds>`        | `8`                         | `4`, `6`, or `8`                                      |
| `-r, --resolution <res>`          | (model default)             | `720p`, `1080p`, `4k` (Veo 3 only)                    |
| `-c, --count <n>`                 | `1`                         | 1-4                                                   |
| `--seed <n>`                      | —                           | reproducibility                                       |
| `--negative <text>`               | —                           | exclude content                                       |
| `--audio` / `--no-audio`          | (field omitted)             | request native audio (Veo 3 standard model only; the fast/lite variants reject this field entirely — leave it off there) |
| `--image <path>`                  | —                           | first frame (local, `gs://`, or `https://`)           |
| `--last-frame <path>`             | —                           | last frame (requires `--image`)                       |
| `--video <path>`                  | —                           | input clip for extension/editing                      |
| `--mask <path>`                   | —                           | mask for video editing (requires `--video`)           |
| `--mask-mode <m>`                 | —                           | `insert`, `remove`, `remove_static`, `outpaint`       |
| `--reference <path>`              | — (repeatable, ≤3)          | reference images (assets) — exclusive with image/video|
| `--camera <mode>`                 | —                           | `pan_left`, `tilt_up`, `push_in`, etc.                |
| `--storage-uri <gcsUri>`          | —                           | GCS output bucket (Vertex AI; e.g. `gs://b/out/`)     |
| `--vertex` / `--gemini`           | auto                        | force backend                                         |
| `--project <id>`                  | `$GOOGLE_CLOUD_PROJECT`     | Vertex AI only                                        |
| `--location <loc>`                | `us-central1`               | Vertex AI only                                        |
| `--poll-interval <s>`             | `10`                        | how often to poll the operation                       |
| `--print-only`                    | —                           | print resolved request and exit (no API call)         |

## Model IDs

| Model                                  | Notes                                  |
| -------------------------------------- | -------------------------------------- |
| `veo-3.1-generate-preview` *(default)* | Highest quality                        |
| `veo-3.1-fast-generate-preview`        | Faster, still high quality             |
| `veo-3.1-generate-001`                 | Stable GA                              |
| `veo-3.1-lite-generate-preview`        | Cheapest                               |
| `veo-2.0-generate-exp`                 | Only model that supports style refs    |

## Backends

Auto-detected from the environment:

- **Gemini API** (default) — needs `GEMINI_API_KEY` in `.env` (get one at
  https://aistudio.google.com/apikey).
- **Vertex AI** — set `GOOGLE_CLOUD_PROJECT` in `.env` and run
  `gcloud auth login` once. Pass `--vertex` to force this backend even if
  both keys are present. Required if you want `--storage-uri` GCS output.

If neither is configured the script exits with a clear error.

## Generation modes

| Mode             | Required inputs                                | Example                                              |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Text-to-video    | `prompt`                                       | `npm run veo -- "drone over misty mountains"`       |
| Image-to-video   | `prompt` + `--image`                           | `npm run veo -- "she turns and walks" --image f.png`|
| First+last frame | `prompt` + `--image` + `--last-frame`          | controlled transitions                                |
| Video extension  | `prompt` + `--video`                           | continue an existing clip                             |
| Video editing    | `prompt` + `--video` + `--mask` + `--mask-mode`| insert/remove/outpaint                                |
| Reference→video  | `prompt` + 1–3 `--reference`                   | guide with assets (veo-2.0-generate-exp for style)    |

## Output

- Inline bytes (no `--storage-uri`): mp4 is written to `--out` (default
  `veo-output/<timestamp>_<hash>.mp4`).
- GCS uri (`--storage-uri ...` on Vertex): a `.uri.txt` pointer file is
  written next to where the mp4 would go, and the script prints a `gsutil cp`
  command to fetch it.
- `--count > 1`: `--out` is treated as a directory; files are named
  `video-01.mp4`, `video-02.mp4`, ...

## When invoking from the orchestrator

When the user types `/veo <free-form prompt>`, treat the whole tail as the
prompt and pass it as the first positional. Map natural-language hints onto
flags before shelling out:

- "vertical / portrait / shorts" → `--aspect 9:16`
- "square / instagram" → `--aspect 1:1`
- "4 seconds / 6 seconds / 8 seconds" → `--duration <n>`
- "no audio / silent" → `--no-audio`
- "1080p / 4k" → `--resolution 1080p|4k`
- "from this image" + a path → `--image <path>` (image-to-video mode)
- "transition from X to Y" + two paths → `--image X --last-frame Y`
- "continue / extend this clip" + a path → `--video <path>`
- "make 4 variations" → `--count 4`

When the user wants the output attached to a paper-video, write it directly
into the folder: `--out videos/<slug>/veo/<beat-or-name>.mp4`.

If `GEMINI_API_KEY` is missing **and** `GOOGLE_CLOUD_PROJECT` is missing,
tell the user to add one of them to `.env` before running. Don't try to
substitute another model.

## Tips

- Veo operations typically take 30–90s. The script polls every 10s and
  prints elapsed time.
- Veo 3.1 does **not** support style reference images — use
  `veo-2.0-generate-exp` for style references (asset refs work on Veo 3.1).
- `--print-only` is useful for previewing the resolved request without
  spending quota.
- Generated videos default to landing in `veo-output/` (gitignored).
