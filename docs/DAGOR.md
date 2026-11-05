# Dagor native scene: implementation details

Engine: [GaijinEntertainment/DagorEngine](https://github.com/GaijinEntertainment/DagorEngine), pinned commit `0ebc89d5d795f3f96324843abf72c5ca7b8555cf` from `dagor_2026_08_01`. This is BSD-3-Clause-licensed engine technology, not proprietary War Thunder gameplay or models. The final scene's fidelity depends on original assets and effects not supplied here.

## Integration strategy

Dagor's documented `samples/skiesSample` is used as the native host because it already supports Metal on macOS and contains atmospheric scattering/cloud rendering. `scripts/prepare_dagor.py` copies our two headers into the sample and adds five targeted hooks to `test_app.cpp`:

1. include `aero_fighter_overlay.h`;
2. update the C++ scene and read the latest API signal from `actScene`;
3. set approximate sun zenith/azimuth from the computer's civil time before `setDirToSun`;
4. render camera-relative 3D scene geometry using Dagor's native debug line/triangle primitives after the backbuffer is rebound;
5. hide the upstream sample's diagnostic debug UI.

The patch is idempotent and fails if the expected upstream code structure changes. It **modifies the working copy of the pinned Git submodule**, leaving the commit itself untouched. The original `test_app.cpp` is backed up as `test_app.aero-original.cpp.txt`.

Native VFX vertical slice: the renderer now creates a parametric 3D base, rotating visual radar, detailed gun mount silhouettes, dual barrels, layered tracer ribbons, travelling hot tracer tips, short muzzle flashes, ground-light approximations, radial airbursts, sparks and multiple camera-facing semitransparent smoke layers. This is substantial original visual geometry, but not photorealistic textured assets, true volumetric smoke, physically simulated lighting, or native post-process HDR bloom. The native macOS build and GPU output have not been independently verified in this environment.

## Download sources and build

Official release [dagor_2026_08_01](https://github.com/GaijinEntertainment/DagorEngine/releases/tag/dagor_2026_08_01) documents:
- prebuilt macOS tools (x86_64 and arm64), `tools-prebuilt-macOS.tar.gz` (~213 MB)
- mandatory base binary files `tools-base.7z` (~26 MB)
- sample base binary resources `samples-base.7z` (~203 MB)

`scripts/build-macos.sh --install` downloads these from Gaijin's CDN using the version pinned in `scripts/dagor-macos.sh`. A local `7zz` / `7z` installation is necessary to extract .7z. The download is explicit; no binaries are automatically downloaded via Git checkout or Python API startup.

Building from source is intended to run:
`python3 build_all.py project:skiesSample code shaders assets`
from the Dagor checkout. This is upstream's documented build mechanism. Some versions of external toolchains may require additional local configuration. CI has no macOS runner in the current project, so a real Mac build is still a verification gate.

## Persistent event contract

`POST /api/event` on `127.0.0.1:8011` validates symbolic event type and target count, then atomically saves a signal record. No real location, bearing, trajectory, weapon control, or external military data is involved.

`AERO1 <sequence> <mode> <targets>`

The native C++ scene polls the file in `AERO_FIGHTER_STATE_FILE`. Only a strictly newer sequence updates the scene. No timeouts/target events trigger `clear`. Contact markers recycle and gun effects continue until a newer external `clear` arrives. After a restart, the last record is loaded again. HTTP GET `/api/state` reports the active mode.

## Validation

`python3 -m unittest discover -s tests -p 'test_*.py'`

`c++ -std=c++17 -Wall -Wextra -pedantic -Werror tests/test_scene.cpp -o /tmp/aero-scene-tests && /tmp/aero-scene-tests`

The small tests cover indefinite engagement, external clear semantics, idempotent patching, API validation and durable state. They don't prove rendering quality or sample compatibility.

## Remaining visual development

After a real Dagor build is running, replace the diagnostic geometry with purpose-built atmospheric base models, custom emissive materials, muzzle flashes with light spill, smoke and accurate camera/monitor framing. Add a small native radar UI and optional, volume-limited siren only after opt-in. Keep the strict external-clear contract throughout.

## GPU and visual quality follow-up

The cached Dagor debug 3D API is used intentionally as the **first native triangle renderer**. Effects have limited transparency and multiple geometry-based glow layers. The next visual pass must move the glow/smoke to dedicated Dagor shader materials and the sample's actual post-processing graph, replace procedural vehicle silhouettes with licensed original meshes and run on a physical Apple Silicon / Intel Mac. A CPU-only unit test cannot establish photorealistic quality.

Each effect has an upper bound in the C++ scene (760 tracers, 340 sparks, 260 smoke puffs, 85 flashes, 28 airbursts), and the animation model is tested for 15 minutes of simulated continuous heavy activity and for explicit-clear-only transitions.
