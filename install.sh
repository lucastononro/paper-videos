#!/usr/bin/env bash
# install.sh — one-shot setup for paper-videos.
#
# Idempotent: rerunning is safe. Skips anything already installed and
# only auto-installs things that don't need an OAuth flow. For things
# that do (the `claude` CLI, ElevenLabs API key, voice ids), the script
# prints what to do next instead of trying to do it.
#
# Usage:
#   ./install.sh            # full setup
#   ./install.sh --quick    # skip TinyTeX (LaTeX) and Chrome Headless Shell
#
# After this finishes, run:
#   ./run.sh                # starts the editor (server + client)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

QUICK=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
  esac
done

# ───── pretty printing ─────
BLUE="$(printf '\033[34m')"; GREEN="$(printf '\033[32m')"
YELLOW="$(printf '\033[33m')"; RED="$(printf '\033[31m')"
DIM="$(printf '\033[2m')"; RESET="$(printf '\033[0m')"
say()  { printf '%s→%s %s\n' "$BLUE" "$RESET" "$*"; }
ok()   { printf '%s ✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s ⚠%s %s\n' "$YELLOW" "$RESET" "$*"; }
err()  { printf '%s ✗%s %s\n' "$RED" "$RESET" "$*" >&2; }
hint() { printf '   %s%s%s\n' "$DIM" "$*" "$RESET"; }

# ───── platform ─────
OS="$(uname -s)"
case "$OS" in
  Darwin) PLATFORM=macos ;;
  Linux)  PLATFORM=linux ;;
  *)      err "Unsupported platform: $OS"; exit 1 ;;
esac
say "Platform: $PLATFORM"

# ───── 1. Node 20+ ─────
say "Checking Node.js …"
if ! command -v node >/dev/null 2>&1; then
  err "Node.js is not installed."
  hint "Install via https://nodejs.org or:  brew install node"
  hint "Re-run ./install.sh after Node is on PATH."
  exit 1
fi
NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  err "Node $(node --version) found — need 20+."
  exit 1
fi
ok "Node $(node --version)"

# ───── 2. ffmpeg ─────
say "Checking ffmpeg …"
if ! command -v ffmpeg >/dev/null 2>&1; then
  warn "ffmpeg not found."
  if [ "$PLATFORM" = "macos" ] && command -v brew >/dev/null 2>&1; then
    say "Installing ffmpeg via Homebrew …"
    brew install ffmpeg
  elif [ "$PLATFORM" = "linux" ] && command -v apt-get >/dev/null 2>&1; then
    say "Installing ffmpeg via apt …"
    sudo apt-get update && sudo apt-get install -y ffmpeg
  else
    hint "Install ffmpeg manually (https://ffmpeg.org/download.html) and re-run."
    exit 1
  fi
fi
ok "ffmpeg $(ffmpeg -version 2>/dev/null | head -1 | awk '{print $3}')"

# ───── 3. uv (Python runtime/manager) ─────
say "Checking uv …"
if ! command -v uv >/dev/null 2>&1; then
  say "Installing uv …"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  # The installer puts uv in ~/.local/bin or ~/.cargo/bin depending on shell.
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
fi
if ! command -v uv >/dev/null 2>&1; then
  err "uv install finished but uv is not on PATH."
  hint "Open a new shell and re-run ./install.sh, or add ~/.local/bin to PATH."
  exit 1
fi
ok "uv $(uv --version 2>/dev/null | awk '{print $2}')"

# ───── 4. claude CLI ─────
say "Checking claude CLI …"
if ! command -v claude >/dev/null 2>&1; then
  warn "claude CLI not on PATH."
  hint "Install: https://docs.claude.com/claude-code"
  hint "After install, run \`claude /login\` once before using the editor."
  hint "(install.sh continues; chat will report errors until claude is available.)"
else
  ok "claude $(claude --version 2>/dev/null | head -1 | awk '{print $1}')"
fi

# ───── 5. npm install ─────
say "Installing npm dependencies …"
npm install --silent
ok "npm dependencies"

# ───── 6. uv sync (Python: Manim, Marker, PyMuPDF) ─────
say "Syncing Python dependencies (Manim, Marker, PyMuPDF) …"
uv sync
ok "Python dependencies"

# ───── 7. Remotion Chrome Headless Shell ─────
if [ "$QUICK" -eq 0 ]; then
  say "Ensuring Remotion's Chrome Headless Shell is downloaded …"
  npx --yes remotion browser ensure
  ok "Chrome Headless Shell"
else
  hint "--quick: skipping Chrome Headless Shell (needed before first render)."
fi

# ───── 8. .env scaffolding ─────
if [ ! -f .env ]; then
  say "Creating .env from .env.example …"
  cp .env.example .env
  warn "Edit .env and fill in ELEVENLABS_API_KEY before narrating beats."
  hint "Get a key at https://elevenlabs.io  →  Profile  →  API key"
else
  ok ".env present"
fi

# Voice config is hand-edited (rare), but flag if it's empty so first-run
# users don't get cryptic 'voice "pharaoh" not found' errors later.
VOICES_YAML="references/usage/elevenlabs/voices.yaml"
if [ -f "$VOICES_YAML" ] && grep -qE 'voice_id:\s*$' "$VOICES_YAML"; then
  warn "$VOICES_YAML has empty voice_id fields — paste your voice ids from"
  hint "https://elevenlabs.io/app/voice-library before running /paper-video render."
fi

# ───── 9. TinyTeX (LaTeX for Manim's MathTex) ─────
TINY_TEX_BIN_MAC="$HOME/Library/TinyTeX/bin/universal-darwin"
TINY_TEX_BIN_LINUX="$HOME/.TinyTeX/bin/x86_64-linux"
if [ "$QUICK" -eq 0 ]; then
  say "Checking TinyTeX (LaTeX for Manim equations) …"
  if [ "$PLATFORM" = "macos" ] && [ -d "$TINY_TEX_BIN_MAC" ]; then
    ok "TinyTeX present at $TINY_TEX_BIN_MAC"
    TLMGR="$TINY_TEX_BIN_MAC/tlmgr"
  elif [ "$PLATFORM" = "linux" ] && [ -d "$TINY_TEX_BIN_LINUX" ]; then
    ok "TinyTeX present at $TINY_TEX_BIN_LINUX"
    TLMGR="$TINY_TEX_BIN_LINUX/tlmgr"
  elif command -v latex >/dev/null 2>&1; then
    ok "system LaTeX present ($(which latex))"
    TLMGR="$(command -v tlmgr || true)"
  else
    say "Installing TinyTeX (user-space, no sudo) …"
    curl -sL "https://yihui.org/tinytex/install-bin-unix.sh" | sh
    if [ "$PLATFORM" = "macos" ]; then
      TLMGR="$TINY_TEX_BIN_MAC/tlmgr"
    else
      TLMGR="$TINY_TEX_BIN_LINUX/tlmgr"
    fi
  fi
  if [ -n "${TLMGR:-}" ] && [ -x "$TLMGR" ]; then
    say "Ensuring required LaTeX packages …"
    "$TLMGR" install standalone preview dvisvgm xcolor amsmath amsfonts \
      physics mathtools wasysym jknapltx fontspec babel-english 2>/dev/null || true
    ok "LaTeX packages"
  else
    warn "tlmgr not found — Manim equations will fall back to broken Unicode."
    hint "Install TinyTeX manually: curl -sL https://yihui.org/tinytex/install-bin-unix.sh | sh"
  fi
else
  hint "--quick: skipping TinyTeX (Manim MathTex will fail until installed)."
fi

# ───── 10. Optional: git submodules ─────
if [ -f .gitmodules ]; then
  say "Updating git submodules (Manim / Remotion / 3b1b-videos sources) …"
  git submodule update --init --depth 1 || warn "submodule update failed (non-fatal)"
fi

# ───── done ─────
echo
ok "Setup complete."
echo
echo "Next steps:"
echo "  1. ${YELLOW}claude /login${RESET}        ${DIM}(if you haven't yet)${RESET}"
echo "  2. ${YELLOW}edit .env${RESET}            ${DIM}(set ELEVENLABS_API_KEY)${RESET}"
echo "  3. ${YELLOW}./run.sh${RESET}              ${DIM}(start the editor at http://localhost:5173)${RESET}"
echo
