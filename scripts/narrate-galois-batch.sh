#!/usr/bin/env bash
# Sequential batch narration for galois-life-and-contributions.
# Skips beats whose mp3 already exists. Logs failures to stderr and continues.
set -u

SLUG="galois-life-and-contributions"
ROOT="/Users/lucastonon/Desktop/paper-videos"
NARR_DIR="$ROOT/videos/$SLUG/narration"
LOG="$ROOT/videos/$SLUG/narrate-batch.log"
FAILED_FILE="$ROOT/videos/$SLUG/narrate-batch.failed"
DONE_FILE="$ROOT/videos/$SLUG/narrate-batch.done"

: > "$LOG"
: > "$FAILED_FILE"
: > "$DONE_FILE"

BEATS=(
$(cat "$1")
)

cd "$ROOT"

for BID in "${BEATS[@]}"; do
  MP3="$NARR_DIR/$BID.mp3"
  if [[ -f "$MP3" ]]; then
    echo "[skip] $BID (mp3 exists)" | tee -a "$LOG"
    echo "$BID" >> "$DONE_FILE"
    continue
  fi

  ATTEMPT=1
  SUCCESS=0
  while [[ $ATTEMPT -le 2 ]]; do
    echo "[run ] $BID attempt=$ATTEMPT" | tee -a "$LOG"
    if npm run narrate -- "$SLUG" "$BID" >>"$LOG" 2>&1; then
      if [[ -f "$MP3" ]]; then
        echo "[ ok ] $BID" | tee -a "$LOG"
        echo "$BID" >> "$DONE_FILE"
        SUCCESS=1
        break
      fi
    fi
    # If API key error, abort the whole batch
    if grep -q "ELEVENLABS_API_KEY" "$LOG" 2>/dev/null | tail -3; then
      :
    fi
    if tail -50 "$LOG" | grep -qi "ELEVENLABS_API_KEY.*not set\|missing.*ELEVENLABS_API_KEY\|401.*unauthorized\|invalid_api_key"; then
      echo "[FATAL] API key issue detected. Stopping." | tee -a "$LOG"
      exit 2
    fi
    ATTEMPT=$((ATTEMPT+1))
    sleep 2
  done

  if [[ $SUCCESS -eq 0 ]]; then
    echo "[FAIL] $BID (after 2 attempts)" | tee -a "$LOG"
    echo "$BID" >> "$FAILED_FILE"
  fi
done

echo "[done] batch complete" | tee -a "$LOG"
