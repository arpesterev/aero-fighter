#!/usr/bin/env bash
# Run Dagor and local symbolic-event API in one foreground session.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GAME="$ROOT/engine/dagor/samples/skiesSample/game"
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The Dagor app is configured for macOS. Run on the target Mac." >&2
  exit 1
fi
mkdir -p "$ROOT/.runtime"
export AERO_FIGHTER_STATE_FILE="$ROOT/.runtime/aero.state"
if [[ -n "${AERO_FIGHTER_BIN:-}" ]]; then
  BINARY="$AERO_FIGHTER_BIN"
else
  BINARY="$(find "$GAME" -type f \( -name 'SkiesSample' -o -name 'skiesSample-macOS*' \) -print 2>/dev/null | head -n 1 || true)"
fi
if [[ -z "$BINARY" || ! -f "$BINARY" ]]; then
  echo "No compiled Dagor skiesSample executable found under: $GAME" >&2
  echo "First run: bash scripts/build-macos.sh --install" >&2
  echo "If your build outputs elsewhere: AERO_FIGHTER_BIN=/full/path/to/binary bash scripts/run-macos.sh" >&2
  exit 1
fi
python3 "$ROOT/native/api_server.py" --state-file "$AERO_FIGHTER_STATE_FILE" --port "${PORT:-8011}" &
API_PID=$!
cleanup() {
  kill "$API_PID" 2>/dev/null || true
  wait "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT
echo "Dagor native scene: $BINARY"
echo "API: http://127.0.0.1:${PORT:-8011}/api/event"
echo "Open the native window on the second Mac display."
(cd "$GAME" && "$BINARY")
