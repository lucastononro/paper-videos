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

## The pipeline (six specialist agents in order)

```
paper-extractor → critic → storyteller → asset-fetcher → producer → visualizer → output.mp4
```

| Agent | Reads | Writes |
|---|---|---|
| **paper-extractor** | `paper.pdf` | `paper.md`, `equations.json`, `pages/page-NNN.png`, `paper-md-assets/` |
| **critic** | `paper.md`, `equations.json`, web | `brief.json` (creative brief: thesis, narrative arc, what to cut, what confuses, visual suggestions) |
| **storyteller** | `brief.json`, `paper.md`, `equations.json` | `script.md` (beat-by-beat storyboard with one short narration clip per visual moment) |
| **asset-fetcher** | `script.md`, `brief.json`, paper figures, web | `images/img-NNN.png`, `diagrams/diag-NNN.svg`, `assets-index.json` |
| **producer** | `script.md`, `voices.yaml`, `.env` | `narration/beat-NNN.{mp3,timestamps.json}`, updated `manifest.json` |
| **visualizer** | All of the above | `manim/beat-NNN.{py,mp4}`, final `output.mp4` via Remotion |

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
2. **Equations are sacred.** Pull LaTeX strings only from `equations.json`. Never type LaTeX from memory of the paper.
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

15. **Animation-first pacing; voice fits the visual.** Each `[MANIM:]` block has a target visual duration the visualizer chooses based on the block's narrative content (numbered steps in `visual.description`). The producer's mp3 (with auto-pads) plus the segment-build's 0.2s tail determines how long the *voice beat* lasts; the visual block's duration is independent and is set so the animation completes (with held tail) within the block, never the other way around. If the voice beats inside a block sum longer than the Manim mp4, the composition holds the last frame for the rest — that's the intended visual rhythm: action, then the tableau lingers while voice catches up. **Don't try to compress audio to fit a too-short Manim scene** — extend the Manim scene's `self.wait(...)` instead.

16. **Soft transitions between visual blocks ("single canvas" doctrine).** `PaperExplainer.tsx` wraps every visualBlock in a `<BlockFade>` that fades the block's contents in over ~0.27s and out over ~0.30s through the dark-navy background. Adjacent blocks therefore "erase and rewrite" through the bg rather than jump-cutting. The whole video reads as one continuous canvas getting written on, blanked, and written on again. Don't reintroduce hard cuts between blocks; if a transition feels too soft, lengthen the held tableau before fade-out, don't shorten the fade.

17. **Visual continuity over re-emission.** When two consecutive narrated beats share the same visual moment (same `paperPage` page+focus+highlight, same Manim mp4, same equationCard, same image/diagram, identical titleCard), the storyteller MUST NOT re-emit the `[VISUAL: ...]` cue. Use `[VISUAL: continue]` (or omit the cue line entirely — the parser inherits the previous beat's visual). The migrator (`migrateToV2` in `src/lib/manifest.ts`) coalesces adjacent same-content visuals into a single `visualBlock` with one fade-in / one fade-out. Re-emitting an identical cue produces a separate block whose `BlockFade` flashes to navy and back at the boundary, even though the content didn't change — visible flicker. The fingerprint used by the coalescer is in `visualKey()`; visuals that should never coalesce (`equationStep`, `pause`) return `null` and remain as solo blocks.

18. **QA before sign-off.** Whenever any beat changes (new narration, re-rendered Manim scene, new equation step, edited highlight bbox), run `npm run qa -- <slug>` before declaring done. The deterministic checks in `src/lib/qa.ts` flag audio overlaps, gap-too-large, missing mp3s/timestamps/mp4s, equation-id typos, bbox out-of-bounds, forbidden audio tags, and adjacent same-content blocks (a regression signal for rule #17). Resolve any `error`-severity issues; warnings are advisory. The `video-qa` subagent (`/.claude/agents/video-qa.md`) reads `qa-report.json` and proposes minimal fixes — invoke it with the Task tool when the report has issues.

19. **Highlight by quote, not coordinates.** When a `paperPage` or `highlightedQuote` needs to spotlight a region, write `quote="exact phrase from the page"` (or `text="..."` for `highlightedQuote`) and let the harness resolve the bbox from the PDF text layer — see `src/lib/resolve-bbox.ts`, invoked automatically inside `rebuildSegmentsFromScript`. Manual `highlight="x,y,w,h"` is a fallback for non-text regions (figures, whitespace) and should be the rare exception. The storyteller cannot see pixel-accurate coordinates; guessed bboxes routinely miss by half a page (proven on existing manifests: a `0.2,0.06,0.6,0.08` highlight intended for the title actually covered the disclaimer banner). The resolver also bypasses aspect-ratio drift on non-letter PDFs, which manual coords don't handle. For small dense text where the viewer needs to *read* the highlight, append `zoom=true` — the renderer crops to the bbox + padding and scales it to fill the canvas, with a tiny page-mini in the corner for spatial context. Verify with `npm run resolve-bbox -- <slug> <pageNum> <quote>` before scripting when the verbatim phrasing isn't certain.

20. **Every video opens with a teaser.** No exceptions. Acts are: `act-0` (Teaser, 15-25 seconds, 5-8 beats) → `act-1` (Why care?) → `act-2` (Setup) → ... The teaser is a showman cold-open executing the pattern *hook → stakes → (concretization) → open-loop question → title card landing as payoff*. The title card is **NOT** the first beat — it's the LAST beat of the teaser, the reward for paying attention to the hook. Generic openers (`"This paper introduces…"`, `"In this video we'll explore…"`, `"Today we'll learn about…"`) are banned. Lead with the single most surprising / consequential / contrarian fact in the paper, in concrete, specific language (specific numbers > adjectives, a contradiction > a thesis). The critic plans this as `brief.json.teaser` (`openingLine`, `stakes`, `openLoop`, `visualConcept`, `estSeconds`); the storyteller materializes it as Act 0 in `script.md`. See `.claude/agents/storyteller.md` "Teaser pattern" for the canonical shape and a worked example. The opening 5 seconds determine whether anyone sees the rest — treat them like a movie trailer, not an abstract.

21. **Live preview: sync the manifest after every per-beat operation.** The producer calls `npm run sync-manifest -- <slug>` after every `npm run narrate -- <slug> beat-NNN`. The visualizer calls it after every `npm run render-manim`. `sync-manifest` runs `rebuildSegmentsFromScript(slug, { partial: true })` — incremental mode that includes every beat whose audio is on disk, truncates cleanly at the first unfinished beat, and swaps any Manim mp4 that hasn't rendered yet for a "Rendering: <scene>…" titleCard placeholder. The editor server's chokidar watcher (`editor/server/src/watch.ts`) fires `preview:reload` on every manifest write → the player remounts with the new partial state → the user **sees the video grow live**, beat-by-beat, with the teaser landing first. This is the whole point of the live-preview architecture: the user doesn't wait for the full 12-minute video to assess quality, they hear the hook within seconds and can spot-edit it before any of the rest is generated. **Never batch all narrates and only sync at the end** — that's the old workflow and it defeats the entire live-preview UX.

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
- `equationStep` — `{ equationId, step }` *(stepwise reveal index 0..N)*
- `equationCard` — `{ equationId, reveal: 'stepwise' | 'all' }` *(legacy / whole-equation card)*
- `image` — `{ assetId }` *(resolved via `assets-index.json`)*
- `diagram` — `{ assetId }`
- `manimClip` — `{ sceneFile, mp4, clipDurationFrames? }`
- `pause` — `{}` *(silent breath, duration from script `[PAUSE Xs]` cue)*

## Tool catalog

| Tool | What it does |
|---|---|
| `npm run fetch-paper -- <id_or_url_or_path> <slug>` | Download PDF into `videos/<slug>/paper.pdf` |
| `npm run extract-paper -- <slug>` | Marker → `paper.md` + `equations.json` |
| `npm run render-pages -- <slug>` | pdfjs-dist → `pages/page-NNN.png` |
| `npm run arxiv-search -- "<query>"` | arXiv search, JSON to stdout |
| `npm run narrate -- <slug> <beat_id>` | ElevenLabs TTS for one beat (request stitching auto-applied) |
| `npm run render-manim -- <slug> <scene_file> <Class>` | Render one Manim scene |
| `npm run sync-manifest -- <slug>` | Incremental manifest rebuild (live-preview / partial mode). Call after every per-beat narrate or render-manim. |
| `npm run render-remotion -- <slug>` | Bundle + render the final mp4 |

For web search and arXiv lookups, use the **built-in WebSearch / WebFetch tools** — no separate keys or scripts needed.

## Style notes for the final video

- 1920×1080 @ 30fps.
- Dark navy background (#0e1117), 3b1b-ish palette (see `references/usage/manim/3b1b-patterns.md`).
- Visual on the upper portion, captions bar at the bottom, narration spoken over.
- Pacing: each beat 1-6 seconds. Insert `[PAUSE 0.4-0.8s]` beats generously after key claims and heavy equation steps.
- Always end with the paper's full title + arxiv link as a closing title card.

## When in doubt

Ask the user. Do not silently choose a different voice, skip a section, fabricate equations, or ship copyrighted images.
