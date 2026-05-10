# paper-videos

Turn an academic paper into a 3Blue1Brown-style explainer video — with a live editor that shows the video being built beat-by-beat as the agent pipeline runs.

You point at an arXiv id, URL, or local PDF. The pipeline drafts a script in the showman cold-open style, narrates it with ElevenLabs, animates the math with Manim, and assembles the result with Remotion. The editor at `localhost:5173` lets you watch it materialize, scrub the partial timeline, spawn pin-point spot-edit threads on individual beats, and click a single button to render the final mp4.

```
arXiv id  →  fetch PDF + extract paper  →  critic plans the brief
                                             ↓
                                          storyteller writes script
                                             ↓
                                  asset-fetcher resolves images / diagrams
                                             ↓
                       producer narrates each beat (live-syncs after every one)
                                             ↓
                       visualizer renders Manim per beat (live-syncs after every one)
                                             ↓
                       you click ▶ Render in the editor → output.mp4
```

The orchestrator is **Claude Code itself** running inside the repo. The repo provides a top-level `CLAUDE.md` doctrine, a `.claude/` skill (`/paper-video`) plus six specialist subagents, deterministic CLI scripts in `src/tools/`, a typed Remotion package in `src/remotion/`, and an interactive editor in `editor/`.

## Status

Initial release — alpha. The pipeline produces real videos end-to-end (see `videos/attention-is-all-you-need/output.mp4`), the editor is stable, but expect rough edges and breaking changes. Feedback on `CONTRIBUTING.md` workflow and any missing edge cases is welcome.

## Setup

### 1. System dependencies

You need Node.js 20+, Python (managed by `uv`), `ffmpeg`, and the `claude` CLI.

```bash
# Node 20+
node --version

# uv (Python package/runtime manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# ffmpeg (Remotion + Manim both need it)
brew install ffmpeg          # macOS
# or: sudo apt-get install ffmpeg   # Debian/Ubuntu

# Claude Code CLI (the orchestrator + the editor's chat backend)
# https://docs.claude.com/claude-code
# After install: `claude /login`
```

### 2. Install project deps

```bash
npm install
uv sync                                          # installs Manim, Marker, PyMuPDF
npx remotion browser ensure                      # downloads Chrome Headless Shell
git submodule update --init --depth 1            # optional: vendor Manim/Remotion source for grep
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env and fill in ELEVENLABS_API_KEY
```

ElevenLabs voices live in `references/usage/elevenlabs/voices.yaml`. The default alias is `pharaoh`; add your own voice ids there if you want to switch.

Claude Code itself uses your existing `claude /login` OAuth session — no key in `.env`.

### 4. LaTeX (required by Manim's `MathTex`)

Without LaTeX, Manim falls back to Unicode and the default font shows broken yellow `[20 9C]` boxes for subscripts and Greek letters. Install **TinyTeX** (user-space, no sudo):

```bash
curl -sL "https://yihui.org/tinytex/install-bin-unix.sh" | sh
~/Library/TinyTeX/bin/universal-darwin/tlmgr install \
  standalone preview dvisvgm xcolor amsmath amsfonts \
  physics mathtools wasysym jknapltx fontspec babel-english
```

`src/tools/render-manim.ts` auto-prepends `~/Library/TinyTeX/bin/universal-darwin` to `PATH`, so `npm run render-manim` finds it without further configuration.

## Quickstart — your first video in ~30 minutes

The editor is the recommended way to drive everything. CLI-only is also supported; see [CLI reference](#cli-reference) below.

### 1. Start the editor

```bash
./run.sh
```

This kills any leftover dev processes, runs both the server and the client side-by-side with prefixed colored logs, and exposes:

- **Client** (Vite): http://localhost:5173 — the UI you interact with.
- **Server** (Express + WebSocket): http://localhost:5174 — the chat backend and render manager.

Ctrl+C kills both cleanly.

### 2. Open the gallery

Visit http://localhost:5173. You see a thumbnail-card gallery of every video in `videos/`. Click **+ New video**, give it a slug (kebab-case), and you land on the editor view.

### 3. Tell claude what to make

The editor opens in **chat-only "draft" mode** — no canvas yet. Type something like:

```
make a video about "Attention Is All You Need" by Vaswani et al
```

Or paste an arXiv id (`1706.03762`), URL, or local PDF path. Claude runs `/paper-video new <source> <slug>`, which fetches the PDF, runs the paper-extractor, and seeds `videos/<slug>/`. The player materializes the moment the manifest exists.

Claude will ask one question early on: **"Render bottom captions over the video? (default no)"**. Pick from the in-panel question card; your answer flows back as the next chat turn. Captions are off by default.

### 4. Watch the video build live

When the pipeline runs, the producer + visualizer call `npm run sync-manifest` after **every single beat** — so the player shows new beats appearing one-by-one with the **teaser landing first** (see [Doctrine § 20-21](#doctrine-the-twenty-one-rules) below). You can scrub the partial timeline at any moment.

Each beat that has audio but is still waiting on its Manim mp4 shows a "Rendering: <scene>…" placeholder card while the audio still plays — voice never blocks waiting on visuals.

### 5. Spot-edit any beat

Below the player are two timeline lanes (visual blocks + voice beats). Click any beat → it highlights and the player seeks to it. Click **↗ Spot-edit** → the right-side **Spot edits** panel opens with an in-panel composer. Type "shorten this by 30%" or "rewrite this without jargon" → press Enter → a forked claude session, scoped to just that beat, runs in parallel without disrupting the parent chat. When it finishes, a notice card lands in the parent chat with the agent's summary.

### 6. Render the final mp4

When you're satisfied, click **▶ Render** in the editor header. The button fills with a green progress bar (`Rendering 42%`) and tail-tooltips the latest log line. On success it flashes green, the player auto-refreshes with the new mp4, and the file lands at `videos/<slug>/output.mp4`.

Render is button-driven only — agents do not run `render-remotion` themselves (see [§ Render is a button, not an agent action](#render-is-a-button-not-an-agent-action)).

## The editor in detail

```
┌────────── header ──────────────────────────────────────────────────────────────┐
│ ← Gallery   <slug>    ↗ Spot edits    ↻ Reload     ▶ Render                    │
├──────────────────┬─────────────────────────────────────┬───────────────────────┤
│                  │ Video / Assets tab                  │ Spot edits panel       │
│                  ├─────────────────────────────────────┤                       │
│   Chat panel     │  Remotion player                    │  Threads list +       │
│   (parent claude │   (lazy-rendered, scrubable)        │  composer / detail    │
│    session per   ├─────────────────────────────────────┤                       │
│    slug, with    │  Filmstrip lane (thumbnails +       │                       │
│    history       │   draggable playhead, iMovie-style) │                       │
│    persisted to  ├─────────────────────────────────────┤                       │
│    .cache/)      │  Visual blocks lane                 │                       │
│                  │  Voice beats lane                   │                       │
│                  │  QA banner (if issues exist)        │                       │
└──────────────────┴─────────────────────────────────────┴───────────────────────┘
```

- **Live preview**: Remotion's `<Player>` renders frames on demand into a canvas; nothing is pre-rendered ahead of time. The Manim mp4s are pre-rendered (Python can't run in-browser) and the `<Video>` element decodes them natively.
- **Filmstrip**: thumbnail per representative-still per visual block (paper-page PNG, Manim last-frame, image/diagram asset). Click or drag to scrub. The playhead syncs via `requestAnimationFrame` so it doesn't trigger React re-renders during playback.
- **Spot-edit threads**: each thread is a separate `claude --resume <thread-session-id>` subprocess on the server, scoped to one beat or block. The thread survives WS disconnects (refresh the page, reconnect, history replays). Completed threads inject a notice into the parent chat that's also persisted across server restarts.
- **Assets tab**: file-tree of the slug folder; preview pane shows mp3s, mp4s, PNGs, PDFs, JSON, code with sensible defaults per mime.
- **Markdown rendering**: chat replies render full GFM (tables, code blocks, lists, blockquotes) with mention chips for tokens like `#beat-005`, `#vb-003`, `[selection 00:14→00:23]`.
- **Persistent history**: parent-chat events go to `videos/<slug>/.cache/chat-history.jsonl` (gitignored). Restart the server, the chat is intact and `claude --resume` picks up the actual conversation context too.

## The pipeline (six specialist subagents)

| Agent | Reads | Writes |
|---|---|---|
| **paper-extractor** | `paper.pdf` | `paper.md`, `equations.json`, `pages/page-NNN.png`, `paper-md-assets/` |
| **critic** | `paper.md`, `equations.json`, web | `brief.json` (creative brief: thesis, narrative arc starting with `act-0: Teaser`, what to cut, visual suggestions) |
| **storyteller** | `brief.json`, `paper.md`, `equations.json` | `script.md` (beat-by-beat storyboard opening with a 5-8 beat teaser) |
| **asset-fetcher** | `script.md`, `brief.json`, paper figures, web | `images/img-NNN.png`, `diagrams/diag-NNN.svg`, `assets-index.json` |
| **producer** | `script.md`, `voices.yaml`, `.env` | `narration/beat-NNN.{mp3,timestamps.json}` + per-beat `npm run sync-manifest` |
| **visualizer** | All of the above | `manim/beat-NNN.{py,mp4}` + per-beat `npm run sync-manifest` |

Each agent has its own context window. The `videos/<slug>/` folder is the persistent contract between them.

The orchestrator (the agent running in the editor's chat) drives this top-to-bottom, delegating to subagents via the Task tool. Each delegate has its own short, focused prompt in `.claude/agents/`.

## Doctrine — the twenty-one rules

`CLAUDE.md` codifies the operating rules. Highlights:

1. **One video = one folder.** All artifacts for video X live in `videos/<X>/`.
2. **Equations are sacred.** LaTeX comes only from `equations.json`. Never invented.
3. **Audio drives the timeline.** Every visual `<Sequence>` range comes from word-level ElevenLabs timestamps.
4. **Beats are sized for breathing.** 8-40 words / 2-10 seconds each. Each mp3 is auto-padded with leading + trailing silence.
5. **Tools are JSON in / JSON out.**
6. **Delegate to subagents** via Task — never inline their work.
7. **Confirm voice before TTS.**
8. **No secrets in code or git.** ElevenLabs key in `.env` (gitignored).
9. **Read `references/usage/` first** for any area; fall back to `references/raw-packages/` only when needed.
10. **Quality gate after the first 3 narrated beats.** Producer stops, asks the user to listen.
11. **Audio tags for personality.** Default model is `eleven_v3` — bracketed tags like `[curious]`, `[serious]`, `[emphasized]` give the video a 3Blue1Brown-style cadence. ≥60% of beats have NO tag.
12. **Voice and visual run on independent timelines.** Manifest v2: `voice[]` (1:1 with TTS clips) and `visualBlocks[]` (visual spans). Manim mp4s play once and **hold their final frame** for the rest of the block — no looping.
13. **LaTeX required for Manim text.** Use `MathTex(...)` for math notation. Never substitute Unicode.
14. **Manim scenes end on a held tableau, never `FadeOut`.** Held black is indistinguishable from a broken render.
15. **Animation-first pacing.** Voice fits the visual, not the other way around.
16. **Soft transitions between visual blocks** (single canvas doctrine). `<BlockFade>` fades each block in/out through the dark-navy background.
17. **Visual continuity over re-emission.** Adjacent same-content beats use `[VISUAL: continue]` so the migrator can coalesce them into one block.
18. **QA before sign-off.** `npm run qa -- <slug>` flags audio overlaps, missing files, equation typos, bbox out-of-bounds, etc.
19. **Highlight by quote, not coordinates.** `quote="exact text on the page"` — the harness extracts the bbox from the PDF text layer. Add `zoom=true` for small-text excerpts to crop+scale into the canvas.
20. **Every video opens with a teaser.** Acts: `act-0` (Teaser, 15-25 seconds, 5-8 beats) → `act-1` (Why care?) → `act-2` (Setup) → ... The title card is the LAST beat of the teaser, not the first. Generic openers (`"This paper introduces..."`, `"In this video we'll explore..."`) are banned.
21. **Live preview: sync the manifest after every per-beat operation.** Producer runs `npm run sync-manifest` after every narrate; visualizer runs it after every render-manim. The editor's chokidar watcher fires `preview:reload` on every manifest write → the user sees the video grow live.

Full text in [`CLAUDE.md`](CLAUDE.md).

## Render is a button, not an agent action

Earlier versions had agents run `npm run render-remotion` at the end of the pipeline. That's now **strictly forbidden** — render is a UI action only, triggered by the **▶ Render** button in the editor header. Reasons:

- Renders are expensive (CPU + minutes); the user should choose when to spend that.
- Asset-pipeline runs and final-render runs are different kinds of work.
- The button shows live progress (percent + log tail) and a clean ✓/✕ flash on completion — agent-driven renders had to be inferred from chat output.

The orchestrator's job ends after the visualizer has placed every Manim mp4. It then tells the user "Assets ready — click ▶ Render".

## CLI reference

You can drive the whole pipeline from the CLI without the editor — useful for headless runs, CI, scripts.

```bash
npm run fetch-paper -- <id|url|path> <slug>      # download PDF + seed config
npm run extract-paper -- <slug>                  # Marker → paper.md + equations.json
npm run render-pages -- <slug>                   # pdfjs → pages/page-NNN.png
npm run arxiv-search -- "<query>"                # arXiv search, JSON to stdout
npm run narrate -- <slug> <beat_id>              # ElevenLabs TTS for one beat
npm run resolve-bbox -- <slug> <pageNum> <quote> # PDF text-layer → normalized bbox JSON
npm run render-manim -- <slug> <scene_file> <Class>
npm run sync-manifest -- <slug>                  # live-preview: incremental rebuild
npm run migrate-manifest-v2 -- <slug>            # one-shot v1 → v2 migration on disk
npm run qa -- <slug>                             # deterministic QA report
npm run render-remotion -- <slug>                # final mp4 (also what the ▶ Render button calls)
```

You can also invoke the orchestrator directly:

```bash
# (Optional) put the wrapper on PATH
ln -s "$PWD/bin/claude-paper-videos" ~/.local/bin/claude-paper-videos

# Then from inside the repo
claude-paper-videos new 1706.03762               # scaffold + run paper-extractor
claude-paper-videos render <slug>                # full asset pipeline (no final render)
claude-paper-videos script <slug>                # re-run critic + storyteller only
claude-paper-videos list                         # gallery on the terminal
```

Or just run `claude` inside the repo and call `/paper-video new <source>` etc. yourself.

## Per-video output structure

```
videos/<slug>/
├── config.yaml                          # paper source, voice, captions, target length
├── manifest.json                        # source-of-truth (v2 voice[] + visualBlocks[])
├── paper.pdf                            # tracked in git? no — generated artifacts are gitignored
├── paper.md                             # Marker output
├── equations.json                       # extracted LaTeX, page index, bbox
├── pages/page-NNN.png                   # rendered paper pages
├── images/img-NNN.png                   # asset-fetcher output
├── diagrams/diag-NNN.svg
├── assets-index.json                    # asset id → file mapping
├── highlights.json                      # selected paper quotes for pull-outs
├── script.md                            # the beat-by-beat storyboard
├── narration/
│   ├── beat-NNN.mp3                     # ElevenLabs TTS audio (auto-padded)
│   └── beat-NNN.timestamps.json         # word-level timing data
├── manim/
│   ├── beat-NNN.py                      # one Manim scene per [MANIM] cue
│   └── beat-NNN.mp4                     # rendered animation
├── manim-durations.json                 # ffprobe results for each mp4 (for the renderer)
├── manim-last-frames/<scene>.png        # held-final-frame snapshots
├── public/                              # auto-mirror used by Remotion bundler + editor /static
├── qa-report.json                       # deterministic QA findings (per `npm run qa`)
├── .cache/                              # gitignored — chat history, render thumbs, etc.
│   ├── chat-history.jsonl               # parent-chat persistence
│   └── thumb.png                        # gallery thumbnail
└── output.mp4                           # final video (after ▶ Render)
```

## Project layout

```
src/tools/                       # Deterministic CLI scripts (TS) the agent invokes
src/lib/                         # Shared utilities — manifest schema, paths, timing,
                                 # bbox resolver, QA, prepare-preview
src/remotion/                    # React/Remotion composition + reusable components
.claude/skills/paper-video/      # Orchestrator skill (/paper-video subcommands)
.claude/agents/*.md              # Six specialist subagents (frontmatter + prompt)
editor/server/                   # Express + WS hub: chat store, threads, render
                                 # manager, file watcher, project routes
editor/client/                   # Vite + React: gallery, editor page, player,
                                 # filmstrip, chat panel, threads panel, assets tab
references/usage/<area>/         # Hand-curated cheat sheets — read first
references/raw-packages/         # Optional submodules: Manim, Remotion, 3b1b-videos
videos/<slug>/                   # One folder per video — see above
CLAUDE.md                        # Doctrine — auto-loaded by the orchestrator
run.sh                           # Start the editor (server + client) with both logs
```

## Configuration

### Per-video — `videos/<slug>/config.yaml`

```yaml
slug: attention-is-all-you-need
paperSource: { kind: arxiv, value: "1706.03762", arxivId: "1706.03762" }
paperTitle: "Attention Is All You Need"
voice: pharaoh                      # alias from references/usage/elevenlabs/voices.yaml
captions: false                     # render bottom CaptionBar on the final video
targetLengthMinutes: 12
focusAreas: []                      # narrows the brief if non-empty
resolution: { width: 1920, height: 1080 }
fps: 30
```

The captions flag is asked once on `/paper-video new` (default `false`). To flip it later, edit `config.yaml` AND set `captions: true` in `manifest.json`, then re-render.

### Voices — `references/usage/elevenlabs/voices.yaml`

Maps short aliases (`pharaoh`, `narrator`, etc.) to ElevenLabs voice ids + per-voice settings (`model_id`, `stability`, `similarity_boost`, `style`, `use_speaker_boost`, `output_format`). Add your own voice ids from https://elevenlabs.io/app/voice-library.

### Audio tags

The orchestrator embeds bracketed tags like `[curious]`, `[serious]`, `[emphasized]`, `[wistful]` in narration text to give the video a 3Blue1Brown-style cadence. ≥60% of beats have NO tag — they appear only when the narrator's tone is doing real semantic work. Theatrical tags (`[laughs]`, `[shouts]`) are forbidden on academic content. The full curated list is in `references/usage/elevenlabs/README.md` § 3a.

### Captions

Off by default. When on, the renderer draws a bottom caption bar with word-by-word highlighting synced to the ElevenLabs timestamps. ElevenLabs `[tag]` tokens are stripped from the visible captions even though they steer prosody server-side.

## Troubleshooting

**`claude` CLI not on PATH**: install Claude Code (https://docs.claude.com/claude-code), then `claude /login`. The editor server logs a warning on startup if it can't find it; chat will report errors until it's available.

**Remotion player shows a black frame**: this used to happen when the bundle's manifest fetch silently 404'd. The `PaperExplainerCore` component now takes pre-fetched data via `inputProps` and never depends on `staticFile()` resolution, so the failure mode is gone. If you still see black, check the browser devtools network tab for any 404 on `/static/<slug>/*`.

**Yellow `[20 9C]` boxes in Manim output**: TinyTeX isn't installed (or `tlmgr` is missing the packages listed in [§ 4](#4-latex-required-by-manims-mathtex)). Run the install steps and re-render.

**Highlights land on the wrong text**: you're using manual `highlight="x,y,w,h"` coordinates. Switch to `quote="exact phrase from the page"` — the harness extracts the bbox from the PDF text layer (`src/lib/resolve-bbox.ts`). See doctrine rule 19.

**`ELEVENLABS_API_KEY is not set`**: edit `.env` (`cp .env.example .env` if you haven't yet).

**Editor port already in use**: `run.sh` kills leftover dev processes on startup. If something else holds the port, find it with `lsof -i :5173` / `lsof -i :5174` and kill it.

**Render button does nothing or fails immediately**: prerequisites are missing. Run `npm run qa -- <slug>` to see what's not ready (mp3s, manim mp4s, etc.). Render only works once all assets are in place.

**Spot-edit thread spawns but never replies**: the forked subprocess inherits your `claude` OAuth session. If you logged out, re-`claude /login` and the next thread will work.

**Captions show ElevenLabs `[tags]` like `[curious]`**: this used to leak when v3 returned the tag chars in alignment data. `src/tools/narrate.ts` now strips them from the timestamps before save. Re-narrate the affected beats.

## Design notes

- **Audio drives time.** Every visual `<Sequence>` range comes from ElevenLabs word-level timestamps. Beats that haven't been narrated yet aren't in the timeline at all (live-preview truncates cleanly).
- **Manifest v2 — independent voice + visual tracks.** `voice[]` is 1:1 with TTS clips; `visualBlocks[]` is multi-step visual spans coalesced from adjacent same-content beats. One block can span many voice beats. Manim mp4s play once and hold their final frame for the rest of the block.
- **Soft transitions through the bg.** `<BlockFade>` fades each block in/out through the dark-navy background — the whole video reads as one continuous canvas being written, blanked, and rewritten.
- **Quote-anchored highlights.** Storytellers can't see pixel coordinates. `quote="..."` → PDF text-layer extraction → tight bbox, automatically.
- **Stateless tools.** Every script in `src/tools/` is idempotent, takes args, writes JSON the agent can read back. The agent never holds state across calls.
- **Live sync as the default loop.** Per-beat narrate + manifest sync makes the user the loop's regulator: if the teaser sounds wrong, you stop the run after 60 seconds, edit, and resume.

## Contributing

PRs welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup + ground rules and [CLAUDE.md](CLAUDE.md) for the operating doctrine. By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md). Security issues: see [SECURITY.md](SECURITY.md).

If you want to add a new visual kind, a new voice, a new agent, or a new editor panel, open an issue first — the architecture has strong opinions and a five-minute conversation saves a few hours of redo.

## License

[MIT](LICENSE) © 2026 Lucas Tonon
