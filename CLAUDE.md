# paper-videos — agent doctrine

You are the orchestrator for the **paper-videos** framework. Your job is to turn an academic paper into a 3Blue1Brown-style explainer video. This file is auto-loaded; treat it as your operating manual.

## Project shape

```
src/tools/        # Deterministic TS scripts you call via Bash
src/lib/          # Schema + helpers
src/remotion/     # React composition, rendered to mp4
.claude/skills/paper-video/SKILL.md   # /paper-video subcommands
.claude/agents/*.md                   # Specialist subagents you delegate to
references/usage/<area>/README.md     # Hand-curated guidance — read first for any area
references/raw-packages/{manim,remotion,3b1b-videos}/  # Full upstream — grep when usage/ is insufficient
videos/<slug>/    # One folder per video; never write outputs anywhere else
```

## The pipeline (specialist agents in order)

Two modes:

```
Paper mode (input = arxiv id / URL / PDF path):
  fetch-paper → paper-extractor → critic → storyteller → asset-fetcher → producer → visualizer → output.mp4

Topic mode (input = free-form prompt, e.g. "Galois theory"):
  new-topic → critic → storyteller → asset-fetcher → producer → visualizer → output.mp4
                  └─► (critic may opportunistically pull a paper mid-run → fetch-paper + paper-extractor → re-critic)
```

`src/lib/slug.ts:classifySource` is the canonical router. Inputs are classified as `arxiv` / `url` / `local` (paper mode) or `topic` (topic mode).

| Agent               | Reads (paper mode)                            | Reads (topic mode)                                                                  | Writes                                                                                |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **paper-extractor** | `paper.pdf`                                   | (not invoked unless critic opts in via `pullPaper`)                                 | `paper.md`, `equations.json`, `pages/page-NNN.png`, `paper-md-assets/`                |
| **critic**          | `paper.md`, `equations.json`, web             | `topic.md`, web (and writes `equations.json` from research)                         | `brief.json` (creative brief; may include `pullPaper` field in topic mode)            |
| **storyteller**     | `brief.json`, `paper.md`, `equations.json`    | `brief.json`, `topic.md`, `equations.json` (no `paperPage`/`highlightedQuote` cues) | `script.md` (beat-by-beat storyboard with one short narration clip per visual moment) |
| **asset-fetcher**   | `script.md`, `brief.json`, paper figures, web | `script.md`, `brief.json`, web (no `paper-md-assets/`)                              | `images/img-NNN.png` (web / SVG / nano-banana — see rule #27), `diagrams/diag-NNN.svg`, `assets-index.json` |
| **producer**        | `script.md`, `voices.yaml`, `.env`            | (identical)                                                                         | `narration/beat-NNN.{mp3,timestamps.json}`, updated `manifest.json`                   |
| **visualizer**      | All of the above                              | (identical)                                                                         | `manim/beat-NNN.{py,mp4}` (or `beat-NNN.mp4` + `beat-NNN.{elevenlabs,veo}.json` when the cue's `description` starts with `clip:` / `veo:` — provider chain ElevenLabs → Veo → Manim, see rule #27), final `output.mp4` via Remotion |

The orchestrator (you) drives this top-to-bottom, delegating to subagents via the Task tool. Each subagent has its own context window — the brief / script / manifest in `videos/<slug>/` are the persistent contract between them.

## The micro-beat doctrine

The atomic unit of a video is a **beat**, not a "segment". A beat is:

- **One** visual action (a Manim animation, a paper page reveal, a diagram fade-in, an equation step, a title card, a pause)
- **One** narration clip (8-40 words, 2-10 seconds), or silent for breath beats

A 12-minute video is typically **100-160 beats**, not 30 multi-sentence segments. Why:

1. Eyes follow the visual. If narration drifts away from what's on screen, attention breaks.
2. Beats need breathing room — `narrate.ts` auto-pads each mp3 with leading + trailing silence (0.25s / 0.6s defaults) and `[PAUSE 0.6-1.2s]` beats between key claims keep comprehension in mind.
3. Re-rendering one bad beat is cheap; re-rendering a 30-second monologue is not.
4. Captions stay legible.

**Beat length, in detail:** Aim for 8-40 words / 2-10 seconds of speech (was 5-25 / 1-6 in the older doctrine — the longer floor produces more substantial narration, the higher ceiling lets a full thought land without being fragmented across 4 micro-beats). Hard cap: 300 chars per beat (storyteller). If a thought needs more, split at a natural breath, not mid-sentence. Pauses between beats come for free via the audio-padding logic — do NOT also insert `[PAUSE 0.2s]` beats when the natural mp3 pad already provides the gap.

## Hard rules

1. **One video = one folder.** All artifacts for video X live in `videos/<X>/`.
2. **Equations are sacred.** Pull LaTeX strings only from `equations.json`. Never type LaTeX from memory of the paper. In topic mode `equations.json` is populated by the critic from their research (textbooks, canonical sources) rather than by Marker — same contract, different upstream.
3. **Audio drives the timeline.** Every `<Sequence>` range in Remotion comes from word-level timestamps. Do not hand-pick frames.
4. **Beats are sized for breathing.** 8-40 words of narration per beat, 2-10 seconds, ≤300 chars. Each generated mp3 is auto-padded with leading + trailing silence by `narrate.ts` (defaults 0.25s / 0.9s, configurable via `--pad-leading` / `--pad-trailing`). Word timestamps shift to keep caption sync. Effective gap between consecutive narrated beats: ~1.35s (0.9s trailing pad + 0.2s segment tail + 0.25s next-beat leading pad). Don't hand-write `[PAUSE 0.2s]` beats in addition to the natural pad — only use `[PAUSE Xs]` when you need a deliberately long beat (≥0.6s) for emphasis.
5. **Tools are JSON in / JSON out.** After running a script, read its output before continuing.
6. **Delegate to subagents.** Each pipeline stage has its own subagent — invoke via the Task tool, do not inline their work.
7. **Confirm voice before TTS.** Before any narration call, confirm the voice alias resolves to a real entry in `voices.yaml`.
8. **No secrets in code or git.** ElevenLabs key in `.env` (gitignored). If missing, stop and ask.
9. **Read `references/usage/` first.** When working in any area, the curated `README.md` and example files are your primary source. Fall back to `references/raw-packages/` only when needed.
10. **Quality gate after the first 3 narrated beats.** Producer stops, asks the user to listen, only continues after confirmation.
11. **Audio tags for personality.** Default model is `eleven_v3` — the storyteller embeds bracketed tags like `[curious]`, `[pause]`, `[serious]`, `[emphasized]`, `[wistful]` in narration text to give the video a 3Blue1Brown-style cadence. Use the curated subset in `references/usage/elevenlabs/README.md` section 3a. ≥60% of beats have NO tag; tags appear only when the narrator's tone is doing real semantic work. Avoid theatrical tags (`[laughs]`, `[shouts]`, etc.) on academic content.
12. **Voice and visual run on independent timelines (manifest v2).** The manifest has two arrays: `voice[]` (narration beats, 1:1 with TTS clips) and `visualBlocks[]` (visual spans, each with a multi-step `description`). One block can span many voice beats; one voice beat can sit under multiple blocks. The composition (`PaperExplainer.tsx`) renders them as two independent layers. The migration from the legacy `segments` schema runs automatically in `readManifest`; persistent v2 form is produced by `npm run migrate-manifest-v2 -- <slug>`. Manim mp4s **play once and hold their final frame** for the rest of the block (no looping, no resets). `manim-durations.json` and the per-mp4 last-frame PNGs are produced at bundle time by `render-remotion.ts` via ffprobe / ffmpeg. The storyteller writes per-beat `description="..."` cues; the migration concatenates them into block-level descriptions; the visualizer authors Manim scenes that progress through the numbered steps over the block's duration.
13. **LaTeX is required for Manim text.** Manim scenes MUST use `MathTex(...)` for math notation. Never substitute Unicode subscripts via `Text("vₜ")` — the default font lacks many codepoints and renders them as yellow `[20 9C]` boxes. If LaTeX is missing on the host, install **TinyTeX** (user-space, no sudo: `curl -sL https://yihui.org/tinytex/install-bin-unix.sh | sh`) rather than degrading to Unicode. After install, run `~/Library/TinyTeX/bin/universal-darwin/tlmgr install standalone preview dvisvgm xcolor amsmath amsfonts physics mathtools wasysym jknapltx fontspec babel-english`. `src/tools/render-manim.ts` auto-prepends TinyTeX to PATH so Manim picks it up.
14. **Manim scenes end on a held tableau, never `FadeOut`.** Because the composition holds the final mp4 frame for any block-time beyond mp4-time, the last frame must BE the satisfying conclusion of the visual. End scenes with `self.wait(1.5)` after the last meaningful animation (long enough that the freeze is unambiguously a tableau, not a broken render). Never call `self.play(FadeOut(everything))` at scene end — held black is indistinguishable from a broken render.

15. **Animation-first pacing; voice fits the visual.** Each `[MANIM:]` block has a target visual duration the visualizer chooses based on the block's narrative content (numbered steps in `visual.description`). The producer's mp3 (with auto-pads) plus the segment-build's 0.2s tail determines how long the _voice beat_ lasts; the visual block's duration is independent and is set so the animation completes (with held tail) within the block, never the other way around. If the voice beats inside a block sum longer than the Manim mp4, the composition holds the last frame for the rest — that's the intended visual rhythm: action, then the tableau lingers while voice catches up. **Don't try to compress audio to fit a too-short Manim scene** — extend the Manim scene's `self.wait(...)` instead.

16. **Soft transitions between visual blocks ("single canvas" doctrine).** `PaperExplainer.tsx` wraps every visualBlock in a `<BlockFade>` that fades the block's contents in over ~0.27s and out over ~0.30s through the dark-navy background. Adjacent blocks therefore "erase and rewrite" through the bg rather than jump-cutting. The whole video reads as one continuous canvas getting written on, blanked, and written on again. Don't reintroduce hard cuts between blocks; if a transition feels too soft, lengthen the held tableau before fade-out, don't shorten the fade.

17. **Visual continuity over re-emission.** When two consecutive narrated beats share the same visual moment (same `paperPage` page+focus+highlight, same Manim mp4, same equationCard, same image/diagram, identical titleCard), the storyteller MUST NOT re-emit the `[VISUAL: ...]` cue. Use `[VISUAL: continue]` (or omit the cue line entirely — the parser inherits the previous beat's visual). The migrator (`migrateToV2` in `src/lib/manifest.ts`) coalesces adjacent same-content visuals into a single `visualBlock` with one fade-in / one fade-out. Re-emitting an identical cue produces a separate block whose `BlockFade` flashes to navy and back at the boundary, even though the content didn't change — visible flicker. The fingerprint used by the coalescer is in `visualKey()`; visuals that should never coalesce (`equationStep`, `pause`) return `null` and remain as solo blocks.

18. **QA before sign-off.** Whenever any beat changes (new narration, re-rendered Manim scene, new equation step, edited highlight bbox), run `npm run qa -- <slug>` before declaring done. The deterministic checks in `src/lib/qa.ts` flag audio overlaps, gap-too-large, missing mp3s/timestamps/mp4s, equation-id typos, bbox out-of-bounds, forbidden audio tags, and adjacent same-content blocks (a regression signal for rule #17). Resolve any `error`-severity issues; warnings are advisory. The `video-qa` subagent (`/.claude/agents/video-qa.md`) reads `qa-report.json` and proposes minimal fixes — invoke it with the Task tool when the report has issues.

19. **Highlight by quote, not coordinates.** When a `paperPage` or `highlightedQuote` needs to spotlight a region, write `quote="exact phrase from the page"` (or `text="..."` for `highlightedQuote`) and let the harness resolve the bbox from the PDF text layer — see `src/lib/resolve-bbox.ts`, invoked automatically inside `rebuildSegmentsFromScript`. Manual `highlight="x,y,w,h"` is a fallback for non-text regions (figures, whitespace) and should be the rare exception. The storyteller cannot see pixel-accurate coordinates; guessed bboxes routinely miss by half a page (proven on existing manifests: a `0.2,0.06,0.6,0.08` highlight intended for the title actually covered the disclaimer banner). The resolver also bypasses aspect-ratio drift on non-letter PDFs, which manual coords don't handle. For small dense text where the viewer needs to _read_ the highlight, append `zoom=true` — the renderer crops to the bbox + padding and scales it to fill the canvas, with a tiny page-mini in the corner for spatial context. Verify with `npm run resolve-bbox -- <slug> <pageNum> <quote>` before scripting when the verbatim phrasing isn't certain.

20. **Every video opens with a teaser.** No exceptions. Acts are: `act-0` (Teaser, 15-25 seconds, 5-8 beats) → `act-1` (Why care?) → `act-2` (Setup) → ... The teaser is a showman cold-open executing the pattern _hook → stakes → (concretization) → open-loop question → title card landing as payoff_. The title card is **NOT** the first beat — it's the LAST beat of the teaser, the reward for paying attention to the hook. Generic openers (`"This paper introduces…"`, `"In this video we'll explore…"`, `"Today we'll learn about…"`) are banned. Lead with the single most surprising / consequential / contrarian fact in the paper, in concrete, specific language (specific numbers > adjectives, a contradiction > a thesis). The critic plans this as `brief.json.teaser` (`openingLine`, `stakes`, `openLoop`, `visualConcept`, `estSeconds`); the storyteller materializes it as Act 0 in `script.md`. See `.claude/agents/storyteller.md` "Teaser pattern" for the canonical shape and a worked example. The opening 5 seconds determine whether anyone sees the rest — treat them like a movie trailer, not an abstract.

21. **Live preview: sync the manifest after every per-beat operation.** The producer calls `npm run sync-manifest -- <slug>` after every `npm run narrate -- <slug> beat-NNN`. The visualizer calls it after every `npm run render-manim`. `sync-manifest` runs `rebuildSegmentsFromScript(slug, { partial: true })` — incremental mode that includes every beat whose audio is on disk, truncates cleanly at the first unfinished beat, and swaps any Manim mp4 that hasn't rendered yet for a "Rendering: <scene>…" titleCard placeholder. The editor server's chokidar watcher (`editor/server/src/watch.ts`) fires `preview:reload` on every manifest write → the player remounts with the new partial state → the user **sees the video grow live**, beat-by-beat, with the teaser landing first. This is the whole point of the live-preview architecture: the user doesn't wait for the full 12-minute video to assess quality, they hear the hook within seconds and can spot-edit it before any of the rest is generated. **Never batch all narrates and only sync at the end** — that's the old workflow and it defeats the entire live-preview UX.

22. **Equations must fit the frame; small highlights must zoom.** Two related sub-rules. (a) **Manim equations MUST use `fit_to_frame`.** A raw `MathTex(...)` for a long equation overflows the canvas — both sides crop and the user sees `;t↔(Q,K,V) = ...` instead of `Att(Q,K,V) = ...`. Every scene that renders an equation pastes the `fit_to_frame(mob, w_ratio=0.85, h_ratio=0.85)` helper at the top of the file (see `.claude/agents/visualizer.md` "Equations MUST fit the frame") and wraps every `MathTex(...)` in it. The helper is idempotent and a no-op for small equations — cost is zero. (b) **Small paper-page highlights auto-zoom.** When the storyteller writes `quote="..."` on a paperPage and the resolved bbox covers a small region (`h < 0.08` OR area < 4% of the page — typically a single-line caption, a sub-equation inside a figure, a margin note), the harness automatically sets `zoom: true`. The renderer crops to the bbox + padding and scales it up to fill the canvas (aspect-FILL via `Math.max(scaleX, scaleY)`, capped at 6×), with the page-mini in the corner preserving spatial context. The storyteller can override with explicit `zoom=true` (force zoom on larger highlights) or `zoom=false` (suppress auto-zoom).

23. **Stepwise LaTeX splitting MUST be depth-aware.** `equationCard reveal=stepwise` splits the equation at top-level `\\` so the renderer can stagger row reveals. Naive split (regex on `\\\\`) tears `\\` row separators inside `\begin{pmatrix}…\end{pmatrix}` (and bmatrix / aligned / cases / matrix), producing fragments like `s_1\begin{pmatrix}1,2,3` with no closing `\end{pmatrix}`. KaTeX renders those as red error text — the symptom in the rendered video is a literal `s_1\being{pmatrix}1,2,3` floating on screen. The canonical splitter lives at `src/lib/split-latex.ts` and tracks `\begin{…}\end{…}` nesting; `EquationCard.tsx` imports it. The QA layer (`src/lib/qa.ts`) regression-checks every equation by running splitLatex and flagging any fragment with unbalanced `\begin/\end` as an `equation:malformed-split` error — so if anyone ever reverts the depth-aware logic (or a different bug fix accidentally undoes it), `npm run qa -- <slug>` catches it before render. Don't reintroduce a regex-based splitter, even "for performance" — the matrix-tear is loud and silent at the same time (looks like a Manim-style rendering glitch, not a parser bug).

24. **Don't rename assets to defeat browser cache — overwrite in place.** When you regenerate `images/img-NNN.png`, `diagrams/diag-NNN.svg`, `pages/page-NNN.png`, or any Manim mp4, write the same filename. The harness handles cache-busting via two pieces: (a) the chokidar watcher (`editor/server/src/watch.ts`) covers `images/`, `diagrams/`, `paper-md-assets/`, `pages/`, `narration/`, `manim/*.mp4`, and `manifest.json` — any change in those paths fires a `preview:reload` event with a 600ms debounce; (b) the editor bumps a `cacheBustKey` on every reload and threads it through `PaperExplainerCore` as a `?v=<key>` query param appended to every resolved asset URL — so a regenerated file (same path, new bytes) always reaches the browser. Don't generate `img-NNN.v2.png` or rename `img-NNN.png → img-NNN-2026-05-10.png` and update `assets-index.json` — that's the old workaround from before the watcher and cache-bust were wired up. Stable filenames are an invariant the rest of the pipeline (assets-index, script.md, prepare-preview) relies on. If the player still shows stale bytes, the bug is in the watcher / cacheBustKey path, not in the asset name — report it.

25. **Equation explanations get contour + breakdown — never leave the viewer scanning.** When a beat's narration names a sub-expression of an on-screen equation ("the softmax here", "this denominator", "the temperature parameter beta"), the Manim scene MUST visibly point at that sub-expression. Two patterns, both implemented as reusable helpers in `references/usage/manim/equation-explanation.py`: (a) **`contour_flash(scene, mob)`** — a rounded `SurroundingRectangle` traces around the named part in ~0.4s, holds ~1.2s, fades ~0.35s; use for passing references (the voice names the part and moves on). (b) **`explain_part(scene, equation, part, label)`** — the part slides off-center, scales up by 1.6×, a short Tex label appears below it; the rest of the equation dims to 30%; after `hold` seconds it slides back; use when the voice unpacks the part for 3+ seconds. The visualizer paste-imports these helpers at the top of the scene file (same pattern as `fit_to_frame`). The storyteller signals which via the `[MANIM: ...]` `description="..."` text: `contour: <part>` (passing) or `breakdown: <part> as "<label>"` (sustained). Without these, the viewer hears "the softmax here" and has to scan the equation to find it — comprehension lag breaks the lecture rhythm and is the single biggest tell that a video was assembled from generic narration rather than authored as an explanation. The QA layer doesn't catch this automatically (no schema marker for "should have a contour") — it's a doctrine the storyteller and visualizer enforce on each other.

26. **Paper is optional. Two modes: paper and topic.** This framework produces educational explainer videos — academic papers are one input type, not a requirement. `src/lib/slug.ts:classifySource` routes input by shape: arxiv id / arxiv URL / http(s) URL ending in `.pdf` / local `.pdf` path → **paper mode** (`fetch-paper` → `paper-extractor` → ...). Anything else (`Galois theory`, `explain backpropagation`) → **topic mode** (`new-topic` scaffolds `topic.md` + `config.yaml` with `mode: topic` + manifest; paper-extractor is skipped). In topic mode the critic does its own web research, populates `equations.json` from canonical sources (textbooks, lecture notes, Wikipedia), and writes the brief. The critic MAY emit `pullPaper: { source: "...", whyItMatters: "..." }` in `brief.json` if a canonical paper would materially strengthen the explanation (Rumelhart-Hinton 1986 for backprop, Cox 1946 for Bayes' rule, etc.); the orchestrator then runs `fetch-paper` + `paper-extractor` mid-pipeline and re-delegates the critic to refine. The storyteller cannot emit `[VISUAL: paperPage]` or `[VISUAL: highlightedQuote]` cues in pure topic mode (no paper to point at) and instead leans on `[VISUAL: image src=...]`, `[VISUAL: diagram src=...]`, and `[MANIM: ...]`. The asset-fetcher draws from web + generated SVG only; there's no `paper-md-assets/` directory. Everything else (producer, visualizer, manifest schema, beat timing, captions) is identical between modes.

27. **Generative assets are opt-in, env-gated, and prefer ElevenLabs Studio for video.** Three tools are available to the pipeline:

    - **Nano Banana** (images) via `.claude/skills/nano-banana/SKILL.md` — uses `GEMINI_API_KEY`.
    - **ElevenLabs Studio video** (clips — primary) via `.claude/skills/elevenlabs-video/SKILL.md` — uses `ELEVENLABS_API_KEY` (same key as TTS narration). Hosts Seedance 2 / Seedance 1.x Pro, Kling 2.5 / 2.6 / 3.0, Sora 2 / 2 Pro, Veo 3 / 3.1, Wan 2.5 / 2.6 behind one consolidated API. **Requires ElevenCreative Studio access — private beta as of May 2026**, request at https://elevenlabs.io/contact-sales.
    - **Veo** (clips — fallback) via `.claude/skills/veo/SKILL.md` — uses `GEMINI_API_KEY`. Calls Google's Gemini API directly; no enterprise gating.

    **Provider preference order for video clips: ElevenLabs Studio → Veo → Manim.** ElevenLabs is preferred because (i) it consolidates the best-of-class video models behind one key the project already uses for TTS, (ii) the catalog is broader (Seedance / Kling / Sora alongside Veo), (iii) it integrates with ElevenLabs' audio tools. Fall through to Veo on access-denied (the `elevenlabs-video` tool exits with code 2 on 401/403/404 from the Studio endpoint, distinct from generic failures) OR when `ELEVENLABS_API_KEY` is missing. Fall through to Manim only when both video providers are unreachable.

    **Three gates, in this order:**

    **(a) Env check.** For each path: if its env var is absent (`ELEVENLABS_API_KEY` for ElevenLabs video, `GEMINI_API_KEY` for Veo + Nano Banana), skip that path silently — do not prompt the user. Generative assets are an enhancement, not a requirement.

    **(b) Access gate (ElevenLabs video only).** `ELEVENLABS_API_KEY` being present does NOT imply Studio video access. The `elevenlabs-video` tool detects 401/403/404 from the generation endpoint and prints a clear "request beta access OR generate manually at https://elevenlabs.io/video and save the mp4 to videos/<slug>/manim/beat-NNN.mp4" message, exits with code 2. The visualizer reads exit code 2 as "fall through to Veo for this clip" and switches transparently — the user is told once per run which provider ended up serving each clip.

    **(c) Per-run opt-in.** When at least one generative path is reachable, the orchestrator surfaces a single consolidated proposal once per `/paper-video render` invocation, AFTER the critic + storyteller have produced their drafts and the asset-fetcher + visualizer have flagged opportunities. The proposal names the chosen provider per asset, e.g.: _"Generative assets available: 3 nano-banana images (img-004, img-007, img-011) and 2 video clips (beat-002 teaser via ElevenLabs/kling-2.6, beat-127 closing via ElevenLabs/seedance-1.5-pro — fall back to Veo if Studio access denied). Approve all / approve specific / skip generative this run?"_ Approval is single-shot — once granted, asset-fetcher and visualizer call the tools as needed without re-asking per asset.

    **Outputs:**
    - Nano Banana → `videos/<slug>/images/img-NNN.png` (standard image slot).
    - ElevenLabs Studio video / Veo → `videos/<slug>/manim/beat-NNN.mp4` (same slot in the existing manim/ mp4 path; the composition's `manimClip` rendering handles both unchanged — the visualizer skips writing a `.py` for those beats).

    **Provenance is mandatory.** Every generated asset gets an entry in `assets-index.json` (for images) or in a per-beat sidecar (for clips). The sidecar filename suffix records which provider rendered the clip so future re-renders pick the same path: `.elevenlabs.json` for ElevenLabs Studio, `.veo.json` for Veo. `source` field reads `generated/nano-banana` / `generated/elevenlabs:<model>` / `generated/veo:<model>`, plus the model id and the exact prompt sent.

    **Fall back gracefully.** If the user declines or all generative paths are unreachable, the asset-fetcher reverts each generative `supportingMaterial` entry to a standard `kind: "image" | "diagram"` web/SVG ask, and the visualizer authors a Manim scene for any beat that had been earmarked for a video clip. The pipeline must work end-to-end without these tools — they're a creative escalation, not a dependency.

## How to invoke `/paper-video`

The orchestrator skill at `.claude/skills/paper-video/SKILL.md` defines four subcommands:

- `/paper-video new <arxiv_id_or_url_or_path>` — scaffold the folder, run paper-extractor.
- `/paper-video render <slug>` — full pipeline → output.mp4.
- `/paper-video script <slug>` — re-run critic + storyteller only (regenerate brief + script). Cheap iteration.
- `/paper-video list` — list videos and their state.

The shell wrapper `bin/claude-paper-videos` calls Claude with a directive prompt. When you receive that directive, parse the command and dispatch.

## Manifest contract (`videos/<slug>/manifest.json`)

Always read/write through `src/lib/manifest.ts` so the schema stays valid. Each manifest segment now corresponds to one **beat**.

Visual kinds (`visual.kind`):

- `titleCard` — `{ text, subtitle? }`
- `paperPage` — `{ pageIdx, focus, highlightBBox? }`
- `highlightedQuote` — `{ pageIdx, text, bbox? }`
- `equationStep` — `{ equationId, step }` _(stepwise reveal index 0..N)_
- `equationCard` — `{ equationId, reveal: 'stepwise' | 'all' }` _(legacy / whole-equation card)_
- `image` — `{ assetId }` _(resolved via `assets-index.json`)_
- `diagram` — `{ assetId }`
- `manimClip` — `{ sceneFile, mp4, clipDurationFrames? }`
- `pause` — `{}` _(silent breath, duration from script `[PAUSE Xs]` cue)_

## Tool catalog

| Tool                                                  | What it does                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run fetch-paper -- <id_or_url_or_path> <slug>`   | Download PDF into `videos/<slug>/paper.pdf`                                                                    |
| `npm run extract-paper -- <slug>`                     | Marker → `paper.md` + `equations.json`                                                                         |
| `npm run render-pages -- <slug>`                      | pdfjs-dist → `pages/page-NNN.png`                                                                              |
| `npm run arxiv-search -- "<query>"`                   | arXiv search, JSON to stdout                                                                                   |
| `npm run narrate -- <slug> <beat_id>`                 | ElevenLabs TTS for one beat (request stitching auto-applied)                                                   |
| `npm run render-manim -- <slug> <scene_file> <Class>` | Render one Manim scene                                                                                         |
| `npm run sync-manifest -- <slug>`                     | Incremental manifest rebuild (live-preview / partial mode). Call after every per-beat narrate or render-manim. |
| `npm run render-remotion -- <slug>`                   | Bundle + render the final mp4                                                                                  |

For web search and arXiv lookups, use the **built-in WebSearch / WebFetch tools** — no separate keys or scripts needed.

## Style notes for the final video

- 1920×1080 @ 30fps.
- Dark navy background (#0e1117), 3b1b-ish palette (see `references/usage/manim/3b1b-patterns.md`).
- Visual on the upper portion, captions bar at the bottom, narration spoken over.
- Pacing: each beat 1-6 seconds. Insert `[PAUSE 0.4-0.8s]` beats generously after key claims and heavy equation steps.
- Always end with the paper's full title + arxiv link as a closing title card.

## When in doubt

Ask the user. Do not silently choose a different voice, skip a section, fabricate equations, or ship copyrighted images.
