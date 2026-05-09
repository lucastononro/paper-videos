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
2. `npm run fetch-paper -- <source> <slug>` → `videos/<slug>/paper.pdf` + default `config.yaml` + initial `manifest.json`.
3. Delegate **paper-extractor** subagent: produces `paper.md`, `equations.json`, `pages/page-NNN.png`, `paper-md-assets/`.
4. Print summary: paper title, page count, equation count, suggested next step (`/paper-video render <slug>`).

### `/paper-video render <slug>`

Full pipeline — **always use subagents, never inline their work**.

1. Read `videos/<slug>/config.yaml` and `manifest.json`. If `paper.md` is missing, run `new` first.
2. Confirm voice alias with the user (one short message) unless already specified in this session.
3. Delegate, in order:
   - **critic** → `brief.json` (creative brief: thesis, narrative arc, what to cut, criticisms, visual suggestions)
   - **storyteller** → `script.md` (beat-by-beat storyboard, 5-25 words narration per beat, 120-200 beats for 12 minutes)
   - **asset-fetcher** → `images/`, `diagrams/`, `assets-index.json` (resolves every `[VISUAL: image src=...]` and `[VISUAL: diagram src=...]` cue)
   - **producer** → `narration/beat-*.{mp3,timestamps.json}` + updated `manifest.json` segments
     - Quality gate after first 3 narrated beats. STOP, ask user to listen, continue only on confirmation.
   - **visualizer** → `manim/beat-*.{py,mp4}`, then `npm run render-remotion -- <slug>` → `output.mp4`
4. Verify `videos/<slug>/output.mp4` exists, size > 5 MB. Report duration, beat count, file size.

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
