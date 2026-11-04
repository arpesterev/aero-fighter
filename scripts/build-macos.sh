#!/usr/bin/env bash
# Build actual macOS Dagor skiesSample with Aero Fighter's native C++ scene.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE="$ROOT/engine/dagor"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Native Dagor build needs macOS and Xcode Command Line Tools." >&2
  exit 1
fi
if [[ "${1:-}" == "--install" ]]; then
  echo "Downloading official Dagor macOS tools and sample assets (hundreds of MB)."
  bash "$ROOT/scripts/dagor-macos.sh" source
  bash "$ROOT/scripts/dagor-macos.sh" base
  bash "$ROOT/scripts/dagor-macos.sh" tools
fi
if [[ ! -f "$ENGINE/samples/skiesSample/prog/test_app.cpp" ]]; then
  echo "Initialize Dagor first: bash scripts/dagor-macos.sh source" >&2
  exit 1
fi
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Xcode Command Line Tools required: xcode-select --install" >&2
  exit 1
fi
python3 "$ROOT/scripts/prepare_dagor.py"
echo "Building native Dagor sky sample, shaders and assets..."
(cd "$ENGINE" && python3 build_all.py project:skiesSample code shaders assets)
echo "Build finished. Run: bash scripts/run-macos.sh"
