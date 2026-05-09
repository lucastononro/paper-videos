# paper-videos

A framework that turns an academic paper (arXiv id, URL, or local PDF) into a 3Blue1Brown-style explainer video.

The orchestrator is **Claude Code itself** running inside this repo. The repo provides:

- A shell wrapper (`bin/claude-paper-videos`) that launches `claude` with a directive prompt.
- A top-level `CLAUDE.md` and `.claude/` skill + subagents that specialize in each pipeline stage.
- Deterministic helper scripts in `src/tools/*.ts` that the agent invokes via Bash.
- A typed Remotion package in `src/remotion/` with reusable components.
- Curated cheat-sheets in `references/usage/` plus full upstream submodules in `references/raw-packages/`.

## Pipeline at a glance

```
arXiv id  →  fetch & extract paper  →  research prior work  →  write script
                                                               ↓
            output.mp4  ←  Remotion render  ←  Manim animations + ElevenLabs narration
```

## Setup

### 1. System deps

```bash
# Node 20+
node --version

# uv (Python package/runtime manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# ffmpeg (for Remotion + Manim)
brew install ffmpeg          # macOS
# or: apt-get install ffmpeg  # Debian/Ubuntu
```

### 2. Install

```bash
npm install
uv sync                                          # installs Manim, Marker, PyMuPDF
npx remotion browser ensure                      # downloads Chrome Headless Shell
git submodule update --init --depth 1            # optional: vendor Manim/Remotion source
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env and fill in ELEVENLABS_API_KEY
# Edit references/usage/elevenlabs/voices.yaml and paste in voice ids from
#   https://elevenlabs.io/app/voice-library
```

### 4. (optional) Install the wrapper on `$PATH`

```bash
ln -s "$PWD/bin/claude-paper-videos" ~/.local/bin/claude-paper-videos
```

## Usage

From inside the repo (so `CLAUDE.md` and `.claude/` auto-load):

```bash
# Scaffold a video folder for an arxiv paper
claude-paper-videos new 1706.03762

# Edit videos/<slug>/config.yaml if you want a different voice / target length

# Run the full pipeline
claude-paper-videos render <slug>

# Other commands
claude-paper-videos script <slug>     # only (re)generate the narration script
claude-paper-videos list              # show all videos and their state
```

The wrapper just invokes `claude` with the directive. You can also start `claude` manually inside the repo and call the `/paper-video` skill yourself.

## Per-video output structure

```
videos/<slug>/
├── config.yaml               # paper source, voice, target length, focus areas
├── manifest.json             # source-of-truth read by the renderer
├── paper.pdf
├── paper.md                  # Marker output
├── equations.json            # extracted LaTeX equations w/ page + bbox
├── pages/page-001.png ...    # rendered paper pages
├── highlights.json           # selected paper quotes for on-screen pull-outs
├── script.md                 # narration script with visual cues
├── narration/seg-NNN.{mp3,timestamps.json}
├── manim/scene_NNN.{py,mp4}
├── timeline.json             # final ordered Sequence list
└── output.mp4
```

## Layout

```
src/tools/        # Deterministic CLI scripts (TS) the agent invokes
src/lib/          # Shared utilities (paths, manifest schema, timing helpers)
src/remotion/     # React/Remotion composition + reusable components
.claude/          # Skill (/paper-video) and subagents
references/usage/ # Curated cheat-sheets and canonical examples
references/raw-packages/  # Submodules: full Manim + Remotion source for grep
videos/<slug>/    # One folder per video
```

## Design notes

- **Equation accuracy**: the agent must pull LaTeX from `equations.json` (Marker output) — never invent it.
- **Audio drives time**: visual `<Sequence>` ranges are derived from ElevenLabs word-level timestamps.
- **Voice config is layered**: repo defaults in `references/usage/elevenlabs/voices.yaml`, per-video override in `config.yaml`, optional per-segment override in `script.md` front-matter.
- **Stateless tools**: every script in `src/tools/` is idempotent, takes args, writes JSON the agent can read back.
