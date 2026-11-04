# AERO FIGHTER / WATCHTOWER

Permanent **3D observation-tower scene** for a second Mac display. Peaceful sky is the default. When a local API event arrives, the radar marks threats, automatic launchers fire fictional cinematic interceptors, smoke/explosions play, and the visualization remains active until an explicit external `clear` event arrives. The camera and scene **never disappear**.

Unlike CIWS Command, this is a perspective 3D environment, not a flat 2D game plane: tower balcony, moving radar, modelled base, hangars, multiple launchers, terrain, clouds and projectiles are separate 3D objects. All visuals are procedural and **stylized, not photorealistic**.

## Run on macOS

Requires **Node.js 20+** and a WebGL-capable modern browser. No external runtime dependencies.

```bash
git clone https://github.com/arpesterev/aero-fighter.git
cd aero-fighter
npm start
```

Open **http://127.0.0.1:8011/** on your second screen and use the in-scene fullscreen button (or press `F`). Leave the window open continuously. The server binds to **localhost only**.

Controls: **Тест перехвата** or `T` to stage a three-contact simulation; **Сброс** or `C` for peaceful skies; **Сирена** enables optional sound (off by default). The sky follows the computer's local time across day, dawn, dusk and night.

## Local HTTP API

Events are validated and forwarded to the visualizer using **Server-Sent Events**. This is intentionally symbolic and contains no real targeting or defense-control capabilities.

```bash
curl -X POST http://127.0.0.1:8011/api/event \
  -H 'Content-Type: application/json' \
  -d '{"type":"incoming","count":3,"severity":2,"siren":false}'
```

Additional types: `alert` shows radar contacts without launching; `engage` starts interception faster; `clear` resets to quiet skies. Fields: `count` integer 1–6, `severity` integer 1–3 (currently reserved for future visual presets), `siren` boolean. Defaults are 3, 2 and false. User must separately opt in to siren within the browser. Requests return 202 for accepted events and 400 for invalid values. Use `GET /api/state` for the latest event and `GET /api/events` for SSE.

Only one external alert mode is active at once. When the initial visible targets disappear, synthetic contacts and effects loop until the **external `clear` event** arrives. No timer, successful intercept or scene update automatically clears the alert. The localhost server saves the latest event to `.aero-state.json` (gitignored), and the browser restores it on reload/reconnect. No score, wave system or manual aiming.

## Optional native Dagor Engine renderer

The [Dagor Engine](https://github.com/GaijinEntertainment/DagorEngine) source is pinned as a separate Git submodule at `engine/dagor` (release `dagor_2026_08_01`). Official macOS tools and the East District demo are available as opt-in downloads. **Dagor does not yet render Aero Fighter's live API-driven scene.** The current working visualization still uses Three.js until a native scene and API bridge are implemented.

See [docs/DAGOR.md](docs/DAGOR.md) for commands, release sizes, licenses and port milestones.

```bash
bash scripts/dagor-macos.sh source
bash scripts/dagor-macos.sh status
```

## Development and verification

```bash
npm test
npm run check
```

Source layout:
- `js/world.js`: actual 3D perspective scene, sky and projectile VFX
- `js/controller.js`: idle, persistent alert and looping engaging states (external clear only)
- `js/radar.js`: decorative radar display
- `js/daylight.js`: local civil clock palette
- `js/audio.js`: opt-in low-volume siren with rate limiting
- `js/main.js`: web UI and SSE browser integration
- `js/events.js`, `server.js`: localhost-only HTTP API
- `vendor/three/three.module.js`: bundled MIT-licensed Three.js r160

## Source/imagery clarification

[CIWS Command](https://github.com/andrewmunn/ciws-command) uses Three.js to render a **flat 2D gameplay plane**. A photo-like 3D preview image previously shown alongside it was **not a verified screenshot of the repository**. This project is an independent 3D implementation, using CIWS Command as an aesthetic reference only. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
