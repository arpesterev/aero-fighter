# Dagor Engine (optional native renderer path)

Aero Fighter currently renders its **running** watchtower visualization with Three.js in the browser. The Dagor Engine dependency is **pinned as a Git submodule**, not imported as a JavaScript package or silently substituted for Three.js.

## Why Dagor?

[Dagor Engine](https://github.com/GaijinEntertainment/DagorEngine) is the open-source engine technology used by War Thunder. This **does not** include War Thunder's proprietary maps, aircraft, vehicle models, effects, or gameplay source. A comparable visual scene would need to be authored and ported independently. The source uses BSD-3-Clause; various vendored components have their own notices and licenses.

Version: [dagor_2026_08_01](https://github.com/GaijinEntertainment/DagorEngine/releases/tag/dagor_2026_08_01), commit `0ebc89d5d795f3f96324843abf72c5ca7b8555cf`.

## Setup on macOS

```bash
git clone https://github.com/arpesterev/aero-fighter.git
cd aero-fighter
bash scripts/dagor-macos.sh source
bash scripts/dagor-macos.sh status
```

The engine source is stored separately in `engine/dagor`. The submodule avoids copying the massive engine sources into Aero Fighter's own Git history.

**Optional** official prebuilt assets:

```bash
# macOS developer toolkit, compressed 213 MB
bash scripts/dagor-macos.sh tools

# East District scene viewer, compressed 2.33 GB, requires additional space
bash scripts/dagor-macos.sh viewer
```

The downloads come from [Gaijin's official release](https://github.com/GaijinEntertainment/DagorEngine/releases/tag/dagor_2026_08_01), from `dagorenginedata.cdn.gaijin.net`. Downloading prebuilt executables is opt-in; the script verifies that the archive paths do not escape the extraction directory, but no published cryptographic checksums have been independently verified. Review release details before running binaries. On macOS, Gatekeeper may require approving trusted binaries.

After installing the East District demo, `bash scripts/dagor-macos.sh status` searches for the native macOS app. If an app bundle is present, `bash scripts/dagor-macos.sh open` opens it explicitly. The app's actual startup path and runtime dependencies must be verified on a Mac.

The upstream documentation explains building with `python3 build_all.py project:dngSceneViewer code shaders`, after acquiring the necessary tools and source assets. Building it is **substantially more involved** than running our existing web prototype.

The official East District demo is not a gunfire simulator and has no Aero Fighter event bridge. We do not imply it can receive `POST /api/event` at this stage. This is a source/dependency and development-environment integration, **not** a completed renderer swap.

## Actual port milestones

1. Verify the pinned macOS build and scene viewer on the developer's physical Mac, including Apple Silicon/Intel compatibility.
2. Author the wide sky, low horizon, firing positions, sky contacts, tracer streaks, muzzle flashes, and atmospheric lighting in a Dagor-native scene, using original or properly licensed assets.
3. Add a native HTTP/SSE or localhost bridge consuming Aero Fighter's symbolic `incoming`, `engage`, `alert` and **externally supplied** `clear` events.
4. Keep the PVO scene active indefinitely until the external `clear` event. Reconnect and recover state after restarting the viewer.
5. Replace the Three.js visualizer only when the Dagor scene, bridge, and macOS display behavior have been verified.

For now run the existing Aero Fighter experience with `npm start` independently of the Dagor submodule.
