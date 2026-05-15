---
name: paper-video
description: Orchestrator for the paper-videos framework. Subcommands new (scaffold), render (full pipeline), script (regenerate narration), list. Always invoked when the user types /paper-video <subcommand> ... or when bin/claude-paper-videos passes a directive.
---

# /paper-video skill

Parse the subcommand, dispatch through the pipeline. Read `CLAUDE.md` first.

## Two modes: paper and topic

The pipeline serves two kinds of videos:

- **Paper mode** — input is an arxiv id, an arxiv URL, an http(s) URL ending in `.pdf`, or a local `.pdf` path. The pipeline fetches the PDF, runs Marker + page rendering, and the critic / storyteller / asset-fetcher have access to `paper.md`, `equations.json`, `pages/`, `paper-md-assets/`.
- **Topic mode** — input is a free-form prompt like `Galois theory` or `explain backpropagation`. No paper is fetched at scaffold time. The critic does its own research (WebSearch / WebFetch) and may opportunistically pull a canonical paper later (e.g. Rumelhart-Hinton 1986 for backprop) — see below.

`src/lib/slug.ts:classifySource` is the canonical router. Its output determines which mode the orchestrator runs.

## Pipeline order

```
                  ┌─ paper mode ────────────────────────────┐
fetch-paper ─►   paper-extractor ─►                         │
                                       critic ─► storyteller ─► asset-fetcher ─► producer ─► visualizer
                  ┌─ topic mode ─────────────────────────────┘
new-topic ───────►                  (critic may pull paper-extractor mid-run via a canonical paper)
```

Each agent has its own context window. The `videos/<slug>/` folder is the persistent contract between them.

## Subcommands

### `/paper-video new <source>`

`<source>` is interpreted via `classifySource`:

- arxiv id / arxiv URL / http(s) URL ending in `.pdf` / local `.pdf` path → **paper mode**
- anything else → **topic mode**

**Both modes** start with: _"Render bottom captions over the video? (default no)"_ — one short message, default off, never re-asked in the same session.

#### Paper-mode flow

1. Resolve source → slug (arxiv id like `1706.03762` → kebab paper title; URL → infer arxiv id; local path → filename stem).
2. `npm run fetch-paper -- <source> <slug> [--captions]` → `videos/<slug>/paper.pdf` + default `config.yaml` + initial `manifest.json`.
3. Delegate **paper-extractor** subagent: produces `paper.md`, `equations.json`, `pages/page-NNN.png`, `paper-md-assets/`.
4. Print summary: paper title, page count, equation count, captions on/off, suggested next step (`/paper-video render <slug>`).

#### Topic-mode flow

1. Resolve source → slug (kebab the topic prompt, e.g. `Galois theory in 10 minutes` → `galois-theory-in-10-minutes`). Confirm the slug with the user (one short message — they can override) before scaffolding.
2. `npm run new-topic -- "<topic>" <slug> [--captions] [--target-minutes N]` → `videos/<slug>/topic.md` + `config.yaml` with `mode: topic` + initial `manifest.json`. **No paper.pdf, no paper.md, no equations.json yet.**
3. **Skip paper-extractor.** Print summary: slug, topic prompt, captions on/off, suggested next step (`/paper-video render <slug>`).

The critic decides at runtime whether the video would benefit from pulling a canonical paper. If yes, the critic emits a `pullPaper: {source: "..."}` field in `brief.json` and the orchestrator runs `fetch-paper` + `paper-extractor` _before_ the storyteller starts. The brief, script, and asset pipeline then operate as if paper-mode had been chosen from the start. This is the "harness thinks using a paper would be better" branch.

### `/paper-video render <slug>`

Asset pipeline — **always use subagents, never inline their work**. The final
mp4 render is **NOT** part of this command; it's a button-driven step the
user triggers in the editor (▶ Render in the EditorPage header). This
command stops once every beat has its narration mp3, every visual block has
its asset / Manim mp4, and the manifest is consistent.

1. Read `videos/<slug>/config.yaml` and `manifest.json`. **Determine mode** from `config.yaml.mode`:
   - `mode: topic` (or absent + no `paper.pdf`) → topic mode
   - otherwise → paper mode. If `paper.md` is missing in paper mode, run `new` first.
2. Confirm voice alias with the user (one short message) unless already specified in this session.
3. Delegate, in order:
   - **critic** → `brief.json`. In paper mode the critic reads `paper.md` + `equations.json`. In topic mode the critic reads `topic.md` and does its own web research. The critic may also emit `pullPaper: { source: "..." }` in topic mode if they want to ground the video in a canonical paper — if present, the orchestrator runs `npm run fetch-paper -- <source> <slug>` + delegates **paper-extractor** _now_, then re-delegates critic to refine with the paper.
   - **storyteller** → `script.md`. Works in both modes; in topic mode it cannot emit `[VISUAL: paperPage]` or `[VISUAL: highlightedQuote]` cues unless the critic pulled a paper. Equation cues (`[VISUAL: equationCard]`, `[VISUAL: equationStep]`) reference ids in `equations.json`, which the critic populates in topic mode from their research.
   - **Generative-asset opt-in gate** (CLAUDE.md hard-rule #27): after the script lands, scan `brief.json.supportingMaterial` for entries with `generate: "nano-banana" | "elevenlabs:<model>" | "veo:<model>"` AND grep `script.md` for `[MANIM: ... description="clip: ..."]` and legacy `description="veo: ..."` cues. Determine per asset which provider will serve it: images → nano-banana (needs `GEMINI_API_KEY`); clips → ElevenLabs Studio (preferred, needs `ELEVENLABS_API_KEY`) with Veo as the fallback (needs `GEMINI_API_KEY`). If at least one path is reachable, surface ONE consolidated opt-in to the user that names the provider per asset — e.g. _"Generative assets proposed: 2 nano-banana images (img-004 portrait, img-011 closing card) + 1 cinematic clip (8s teaser drone, beat-002) primary ElevenLabs/kling-2.6 → Veo fallback. Approve all / approve specific / skip generative this run?"_ Record the answer for the rest of this run so asset-fetcher and visualizer don't re-ask. If **all** generative env vars are missing, skip the prompt entirely and tell asset-fetcher / visualizer to use fall-backs (web/SVG/Manim).
   - **asset-fetcher** → `images/`, `diagrams/`, `assets-index.json`. In topic mode there's no `paper-md-assets/` to draw from — every image is web-fetched or generated. Generated images (nano-banana) go in `images/img-NNN.png` with full prompt provenance in `assets-index.json`. If the opt-in was declined, generative entries revert to web-fetch / SVG. The asset-fetcher does NOT handle clip assets — those belong to the visualizer.
   - **producer** → `narration/beat-*.{mp3,timestamps.json}` + updated `manifest.json` segments.
     - Quality gate after first 3 narrated beats. STOP, ask user to listen, continue only on confirmation.
   - **visualizer** → `manim/beat-*.{py,mp4}` for Manim scenes AND `manim/beat-*.mp4` + `manim/beat-*.{elevenlabs,veo}.json` sidecars for cinematic clips. **Do NOT run `npm run render-remotion`.** Beats with `description="clip: ..."` (or legacy `description="veo: ..."`) route through the visualizer's provider chain: ElevenLabs Studio → Veo → Manim. The mp4 always lands in the same `manim/beat-NNN.mp4` slot (composition treats every mp4 there as a `manimClip`); the sidecar's filename suffix records which provider rendered it. If the opt-in was declined or both video keys are unset, the visualizer authors a Manim scene from the same description text.
4. Tell the user: "Assets ready — click ▶ Render in the editor to produce output.mp4." Do NOT run the Remotion render yourself unless the user explicitly asks.

### `/paper-video script <slug>`

Cheap iteration on the narrative — re-run critic + storyteller only.

1. Confirm with user whether to delete existing `narration/` (will require re-TTS) or keep audio for unchanged beats.
2. Delegate **critic** → updated `brief.json`.
3. Delegate **storyteller** → updated `script.md`.
4. Do NOT re-run producer / visualizer / Remotion render unless user asks.

### `/paper-video list`

Walk `videos/*/`, report each:

- Mode (`paper` or `topic`, from `config.yaml.mode` or by checking whether `paper.pdf` exists)
- Has `paper.pdf`? `paper.md`? `topic.md`? `brief.json`? `script.md`? `narration/`? `output.mp4`?
- Beat count, output duration if rendered, last modified.
  Print as a table.

## Cross-cutting reminders

- All paths are relative to repo root.
- **Idempotence**: if a target file exists and is non-empty, ask before overwriting.
- **Long-running steps**: run Manim or Remotion renders in background only when there are many segments and you want to do other prep concurrently. Otherwise foreground is fine.
- **When delegating**: give the subagent the slug + any user-specified guidance. They read the rest from the filesystem.
- **Quality gates are mandatory**: producer must stop after first 3 narrated beats and check with the user.
