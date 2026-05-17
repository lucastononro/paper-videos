#!/usr/bin/env bash
# run.sh — start the paper-videos editor (server + client) with both logs
# streaming to this terminal. Ctrl+C kills both cleanly.
#
# Companion script: ./install.sh — one-shot setup (Node deps, Python deps
# via uv, ffmpeg, TinyTeX for Manim, .env scaffold). Run install.sh once;
# run.sh every time you want to start the editor.
#
# Ports are allocated dynamically (first free port from 5174+). Override
# with EDITOR_SERVER_PORT / EDITOR_CLIENT_PORT env vars if needed.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Kill any leftover dev processes from previous runs.
pkill -f 'tsx.*editor/server' 2>/dev/null || true
pkill -f 'vite editor/client' 2>/dev/null || true
pkill -f 'concurrently.*editor:server' 2>/dev/null || true
sleep 0.5

# Make sure dependencies are installed (cheap if already present).
if [ ! -d node_modules ]; then
  echo "→ installing dependencies (first run)"
  npm install
fi

# Sanity-check the `claude` CLI — needed for the chat subprocess.
if ! command -v claude >/dev/null 2>&1; then
  echo "⚠  claude CLI not on PATH. Install it (https://docs.claude.com/claude-code) and run \`claude /login\` first."
  echo "    Continuing anyway — chat will report errors until claude is available."
fi

# ── Dynamic port allocation ──────────────────────────────────────────────
# Find two free ports. Uses a tiny Node one-liner that binds port 0 (OS
# picks a free ephemeral port), prints it, and closes the socket.
find_free_port() {
  node -e "
    const s = require('net').createServer();
    s.listen(0, '127.0.0.1', () => {
      console.log(s.address().port);
      s.close();
    });
  "
}

# Respect explicit overrides; otherwise allocate.
if [ -z "${EDITOR_SERVER_PORT:-}" ]; then
  export EDITOR_SERVER_PORT
  EDITOR_SERVER_PORT=$(find_free_port)
fi
if [ -z "${EDITOR_CLIENT_PORT:-}" ]; then
  export EDITOR_CLIENT_PORT
  EDITOR_CLIENT_PORT=$(find_free_port)
fi

cleanup() {
  echo
  echo "→ shutting down"
  pkill -P $$ 2>/dev/null || true
  pkill -f 'tsx.*editor/server' 2>/dev/null || true
  pkill -f 'vite editor/client' 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "→ starting editor"
echo "  client → http://localhost:${EDITOR_CLIENT_PORT}"
echo "  server → http://localhost:${EDITOR_SERVER_PORT} (ws /ws)"
echo "  Ctrl+C to stop"
echo

# `concurrently` prefixes each line with `[server]` or `[client]` and colors
# them. The client command waits for the server to bind BEFORE Vite kicks
# off — without this, Vite boots ~2-3s faster than tsx + module resolution,
# the browser auto-opens, fires every /static/* + /api/* request, and they
# all ECONNREFUSED until the server finally lands. Polling `/api/projects`
# is the readiness probe: a 200 means the Express app is live and the WS
# upgrade endpoint is too.
exec npx concurrently \
  --names server,client \
  --prefix-colors "blue,green" \
  --kill-others-on-fail \
  --raw=false \
  "tsx watch editor/server/src/index.ts" \
  "bash -c 'echo waiting for server...; for i in \$(seq 1 60); do curl -sf http://127.0.0.1:${EDITOR_SERVER_PORT}/api/projects >/dev/null 2>&1 && { echo server ready; break; }; sleep 0.5; done; exec vite editor/client --port ${EDITOR_CLIENT_PORT}'"
