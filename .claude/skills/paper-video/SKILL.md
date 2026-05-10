---
name: paper-video
description: Orchestrator for the paper-videos framework. Subcommands new (scaffold), render (full pipeline), script (regenerate narration), list. Always invoked when the user types /paper-video <subcommand> ... or when bin/claude-paper-videos passes a directive.
---

# /paper-video skill

Parse the subcommand, dispatch through the six-agent pipeline. Read `CLAUDE.md` first.

## Pipeline order

```
paper-extractor → critic → storyteller → asset-fetcher → producer → visualizer
```

Each agent has its own context window. The `videos/<slug>/` folder is the persistent contract between them.

## Subcommands

### `/paper-video new <arxiv_id_or_url_or_path>`

1. Resolve source → slug (arxiv id like `1706.03762` → kebab paper title; URL → infer arxiv id; local path → filename stem).
2. **Ask the user once**, in one short message: *"Render bottom captions over the video? (default no)"* — if they say yes, pass `--captions` to the next step. Default to off when the answer is unclear or skipped. Never re-ask if the user has already answered for this slug in this session.
3. `npm run fetch-paper -- <source> <slug> [--captions]` → `videos/<slug>/paper.pdf` + default `config.yaml` (with `captions: true|false`) + initial `manifest.json`.
4. Delegate **paper-extractor** subagent: produces `paper.md`, `equations.json`, `pages/page-NNN.png`, `paper-md-assets/`.
5. Print summary: paper title, page count, equation count, captions on/off, suggested next step (`/paper-video render <slug>`).

### `/paper-video render <slug>`

Asset pipeline — **always use subagents, never inline their work**. The final
mp4 render is **NOT** part of this command; it's a button-driven step the
user triggers in the editor (▶ Render in the EditorPage header). This
command stops once every beat has its narration mp3, every visual block has
its asset / Manim mp4, and the manifest is consistent.

1. Read `videos/<slug>/config.yaml` and `manifest.json`. If `paper.md` is missing, run `new` first.
2. Confirm voice alias with the user (one short message) unless already specified in this session.
3. Delegate, in order:
   - **critic** → `brief.json` (creative brief: thesis, narrative arc, what to cut, criticisms, visual suggestions)
   - **storyteller** → `script.md` (beat-by-beat storyboard, 5-25 words narration per beat, 120-200 beats for 12 minutes)
   - **asset-fetcher** → `images/`, `diagrams/`, `assets-index.json` (resolves every `[VISUAL: image src=...]` and `[VISUAL: diagram src=...]` cue)
   - **producer** → `narration/beat-*.{mp3,timestamps.json}` + updated `manifest.json` segments
     - Quality gate after first 3 narrated beats. STOP, ask user to listen, continue only on confirmation.
   - **visualizer** → `manim/beat-*.{py,mp4}` only. **Do NOT run `npm run render-remotion`.**
4. Tell the user: "Assets ready — click ▶ Render in the editor to produce output.mp4." Do NOT run the Remotion render yourself unless the user explicitly asks.

### `/paper-video script <slug>`

Cheap iteration on the narrative — re-run critic + storyteller only.

1. Confirm with user whether to delete existing `narration/` (will require re-TTS) or keep audio for unchanged beats.
2. Delegate **critic** → updated `brief.json`.
3. Delegate **storyteller** → updated `script.md`.
4. Do NOT re-run producer / visualizer / Remotion render unless user asks.

### `/paper-video list`

Walk `videos/*/`, report each:
- Has `paper.pdf`? `paper.md`? `brief.json`? `script.md`? `narration/`? `output.mp4`?
- Beat count, output duration if rendered, last modified.
Print as a table.

## Cross-cutting reminders

- All paths are relative to repo root.
- **Idempotence**: if a target file exists and is non-empty, ask before overwriting.
- **Long-running steps**: run Manim or Remotion renders in background only when there are many segments and you want to do other prep concurrently. Otherwise foreground is fine.
- **When delegating**: give the subagent the slug + any user-specified guidance. They read the rest from the filesystem.
- **Quality gates are mandatory**: producer must stop after first 3 narrated beats and check with the user.
