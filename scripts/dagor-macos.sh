#!/usr/bin/env bash
# Optional pinned Dagor Engine source and macOS sample bootstrap.
# Downloads are EXPLICIT: "source" is lightweight; "tools" and "viewer" are large.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE="$ROOT/engine/dagor"
CACHE="$ROOT/.cache/dagor"
REV="0ebc89d5d795f3f96324843abf72c5ca7b8555cf"
CDN="https://dagorenginedata.cdn.gaijin.net/rel-$REV"

usage() {
  cat <<'HELP'
Usage: bash scripts/dagor-macos.sh <command>
  status   Show pinned engine version and available sample files
  source   Initialize the Dagor Engine git submodule (no large release assets)
  tools    [macOS only] Download and extract prebuilt Dagor toolkit (~213 MB)
  viewer   [macOS only] Download/extract East District native demo (~2.33 GB)
  open     [macOS only] Open an installed East District .app bundle
  help     Show this message

Only the source submodule is stored in Git; prebuilt archives are never
committed and are NOT installed as part of npm start or npm install.
The prebuilt East District scene is an upstream demo, NOT the Aero Fighter
API-driven scene. Dagor-native event support requires a separate port.
HELP
}

require_macos() {
  [[ "$(uname -s)" == "Darwin" ]] || {
    echo "Dagor prebuilt installers in this script target macOS only." >&2
    exit 1
  }
}

source_engine() {
  command -v git >/dev/null || { echo "Git is required." >&2; exit 1; }
  git -C "$ROOT" submodule update --init --depth 1 -- engine/dagor
  local actual
  actual="$(git -C "$ENGINE" rev-parse HEAD)"
  if [[ "$actual" != "$REV" ]]; then
    echo "Unexpected Dagor source revision: $actual (expected $REV)" >&2
    exit 1
  fi
  echo "Dagor source ready: $actual"
}

validate_archive() {
  python3 - "$1" <<'PY'
import pathlib, sys, tarfile
archive = sys.argv[1]
with tarfile.open(archive, mode="r:gz") as tar:
    for member in tar:
        name = pathlib.PurePosixPath(member.name)
        if name.is_absolute() or ".." in name.parts:
            raise SystemExit(f"Unsafe archive entry: {member.name}")
        if member.issym() or member.islnk():
            link = pathlib.PurePosixPath(member.linkname)
            if link.is_absolute() or ".." in link.parts:
                raise SystemExit(f"Unsafe archive symlink: {member.name}")
print("Archive path checks passed.")
PY
}

download_extract() {
  local filename="$1" size="$2" 
  local url="$CDN/$filename"
  local archive="$CACHE/$filename"
  mkdir -p "$CACHE"
  echo "Source: $url"
  echo "Expected compressed size: ~$size. Requires additional disk space when unpacked."
  echo "Downloading the official Gaijin Entertainment archive..."
  # Support interrupted downloads. Never auto-run downloaded executables.
  curl --fail --location --retry 3 --continue-at - --output "$archive" "$url"
  validate_archive "$archive"
  echo "Extracting into: $ENGINE"
  tar -xzf "$archive" -C "$ENGINE"
  echo "Extracted $filename. The external demo is not connected to Aero Fighter events yet."
}

status() {
  echo "Dagor pinned release: dagor_2026_08_01 ($REV)"
  if [[ -d "$ENGINE/.git" || -f "$ENGINE/.git" ]]; then
    git -C "$ENGINE" rev-parse HEAD || true
  else
    echo "Source not initialized. Run: bash scripts/dagor-macos.sh source"
  fi
  if [[ -d "$ENGINE/samples/dngSceneViewer/viewer" ]]; then
    echo "East District sample game directory found:"
    find "$ENGINE/samples/dngSceneViewer/viewer" -maxdepth 7 -type d -name 'DngSceneViewer-*.app' -print | head -12 || true
  else
    echo "East District sample not installed. Optional: bash scripts/dagor-macos.sh viewer"
  fi
}

case "${1:-help}" in
  help|-h|--help) usage ;;
  status) status ;;
  source) source_engine ;;
  tools)
    require_macos
    source_engine
    download_extract "tools-prebuilt-macOS.tar.gz" "213 MB"
    ;;
  viewer)
    require_macos
    source_engine
    download_extract "east_district-dagor-prebuilt.tar.gz" "2.33 GB"
    status
    ;;
  open)
    require_macos
    app="$(find "$ENGINE/samples/dngSceneViewer/viewer" -maxdepth 9 -type d -name 'DngSceneViewer-*.app' -print -quit 2>/dev/null || true)"
    [[ -n "$app" ]] || { echo "No macOS viewer app found. Run: bash scripts/dagor-macos.sh viewer" >&2; exit 1; }
    echo "Opening official demo: $app"
    open "$app"
    ;;
  *) usage; exit 2 ;;
esac
