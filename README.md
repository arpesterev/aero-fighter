# AERO FIGHTER / WATCHTOWER

Permanent **3D observation-tower scene** for a second Mac display. Peaceful sky is the default. When a local API event arrives, the radar marks threats, automatic launchers fire fictional cinematic interceptors, smoke/explosions play, and the scene returns to idle. The camera and scene **never disappear**.

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

Only one cinematic sequence plays at once. A new event replaces the prior scenario; otherwise the scene returns automatically to idle after intercept and cooldown. No score, wave system or manual aiming.

## Development and verification

```bash
npm test
npm run check
```

Source layout:
- `js/world.js`: actual 3D perspective scene, sky and projectile VFX
- `js/controller.js`: idle, alert, engaging and cooldown states
- `js/radar.js`: decorative radar display
- `js/daylight.js`: local civil clock palette
- `js/audio.js`: opt-in low-volume siren with rate limiting
- `js/main.js`: web UI and SSE browser integration
- `js/events.js`, `server.js`: localhost-only HTTP API
- `vendor/three/three.module.js`: bundled MIT-licensed Three.js r160

## Source/imagery clarification

[CIWS Command](https://github.com/andrewmunn/ciws-command) uses Three.js to render a **flat 2D gameplay plane**. A photo-like 3D preview image previously shown alongside it was **not a verified screenshot of the repository**. This project is an independent 3D implementation, using CIWS Command as an aesthetic reference only. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
