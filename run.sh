#!/usr/bin/env bash
# run.sh — start the paper-videos editor (server + client) with both logs
# streaming to this terminal. Ctrl+C kills both cleanly.
#
# Ports:
#   client (Vite)         http://localhost:5173
#   server (Express + WS) http://localhost:5174
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Kill any leftover dev processes from previous runs so port 5173 / 5174 are free.
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
echo "  client → http://localhost:5173"
echo "  server → http://localhost:5174 (ws /ws)"
echo "  Ctrl+C to stop"
echo

# `concurrently` (already a dev-dep) prefixes each line with `[server]` or
# `[client]` and applies colors so the two streams are easy to read.
exec npx concurrently \
  --names server,client \
  --prefix-colors "blue,green" \
  --kill-others-on-fail \
  --raw=false \
  "tsx watch editor/server/src/index.ts" \
  "vite editor/client --port 5173"
