# paper-videos editor

Interactive editor for paper-videos. Two-pane web app: chat panel (real `claude` subprocess streaming over WebSocket) on the left, video player + timeline + QA banner on the right.

## Running

```bash
npm install            # once, from repo root
npm run editor:dev     # starts both server (5174) and client (5173)
```

Open `http://localhost:5173`.

Requirements:
- Node 20+, npm 11+ (workspaces)
- `ffmpeg` and `ffprobe` on PATH (used by `preparePreview` + thumbnail generation)
- The `claude` CLI installed and OAuth-logged-in as the same user (the editor inherits the login by spawning a subprocess in the repo root)

## Features

### Gallery (`/`)
Thumbnail card per video in `videos/`. Click a card → editor view. `+ New video` opens a dialog that takes an arXiv id / URL / local PDF path and dispatches a `/paper-video new` chat turn in a fresh editor view.

### Editor (`/edit/<slug>`)
- **Chat panel (left)**: real `claude --output-format=stream-json` subprocess. Text streams in; tool calls appear as collapsible cards. Cancelable mid-turn. Conversation persists per-slug via `--resume <session_id>`.
- **Player (right)**: `@remotion/player` mounted directly on `PaperExplainerCore` with pre-fetched JSON. No silent black-frame failures; the composition's old `staticFile()` indirection is replaced by an explicit `assetBaseUrl` prop.
- **BeatStrip (below player)**: visual blocks + voice beats colored by kind. Click a beat → seeks the player. Double-click a beat → drops a `#beat-NNN` / `#vb-NNN` mention chip into the chat input.
- **QA banner**: deterministic checks (audio overlap, gap-too-large, visual flicker, missing files, equation/asset id typos, bbox out of bounds, theatrical audio tags, caption-word-overflow). Click `Run QA` to refresh. Click an issue → seeks player to that frame. `Ask claude` → drops the issue into chat.
- **Live preview reload**: when Claude's chat-driven edit changes `manifest.json` / `narration/*` / `manim/*.mp4`, a chokidar watcher fires `preview:reload` over WS and the player remounts with the new data.

## Backend endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | sanity ping |
| GET | `/api/projects` | list videos with metadata + thumb URL |
| GET | `/api/projects/:slug/manifest` | the v2-migrated manifest |
| POST | `/api/projects/:slug/prepare` | mirror assets + probe manim mp4s |
| GET | `/api/projects/:slug/thumb.png` | 480×270 thumbnail (cached to `.cache/thumb.png`) |
| GET | `/api/projects/:slug/qa-report` | latest cached QA report |
| POST | `/api/projects/:slug/qa-report` | re-run QA, write `qa-report.json`, return it |
| POST | `/api/projects/new` | derive slug + dispatch prompt for a chat turn |
| GET | `/static/:slug/*` | static-serve `videos/:slug/public/*` |
| WS | `/ws` | chat events + preview-reload broadcasts |

## Architecture in one diagram

```
Vite (5173) ──/api & /static & /ws──► Express + ws (5174)
   ↓                                       ↓
Player (PaperExplainerCore)            spawn `claude --output-format=stream-json`
   ↑                                       ↓
chat panel ◄──────── stream events ────────┘
   ↑                                       ↓
   └── chokidar(videos/) → preview:reload ─┘
```

## How chat actions translate to manifest changes

1. User types "shorten beat-005" (or drops `#beat-005` from BeatStrip).
2. Backend wraps in a directive: *"You are operating in the paper-videos editor for slug X. Edit only through the manifest/script pipeline …"* and spawns `claude --output-format=stream-json -p <directive>`.
3. Claude reads `script.md`, edits the relevant beat, runs `npm run narrate -- <slug> beat-005`, and likely runs `tsx -e "..rebuildSegmentsFromScript('<slug>')"`.
4. chokidar sees `narration/beat-005.mp3` change → debounced `preview:reload` broadcast.
5. The editor view refetches manifest + manim-durations + last-frame PNGs and remounts `<Player>`. The user hears the new audio without a refresh.

## Known limits

- `claude --output-format=stream-json --verbose` is required for stream output; the parser tolerates unknown event shapes via `system_raw`.
- Multi-turn continuity uses `--resume <session_id>` per WS connection per slug. Refreshing the editor view starts a fresh session.
- The mention chip system is text-based: chips render as plain tokens (`#beat-NNN`) in the message and Claude reads them verbatim. Fancy contentEditable rendering is out-of-scope for v1.
- Long pipelines (`/paper-video new` end-to-end) take many minutes; the chat panel streams progress over the whole turn.
