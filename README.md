# particles

An emergent **particle-life** simulation written from scratch in TypeScript. Thousands of simple particles, governed by a randomly generated attraction/repulsion matrix, organize themselves into surprisingly lifelike structures — cells, chains, orbiting clusters, and self-sustaining "organisms" — with no explicit rules telling them to do so.

Runs in **2D** (WebGL2) and in **3D** with full **WebXR (VR) support** — put on a headset and stand inside the simulation! Works just as well on a phone as on a desktop.

### [Live Demo](https://particles.n3rdw1z4rd.cloud)

## What's going on here

Every particle belongs to one of several color types. A single N×N **attraction matrix** defines how each type feels about every other type: positive values attract, negative values repel. That one matrix is the entire "DNA" of the system. From those simple pairwise forces, complex collective behavior emerges — the same principle behind flocking, chemistry, and cellular self-organization.

The force curve has a short-range repulsion zone (so particles never collapse into each other) and a mid-range attraction/repulsion zone weighted by the matrix. Friction bleeds off energy each frame so the system settles into structure instead of flying apart.

Because the matrix and starting positions come from a seeded RNG, every "world" has an ID. Share the link and someone else starts from the exact same universe.

## Features

- **One engine, two views** — a single dimension-agnostic simulation core; switch 2D ↔ 3D live (`d`), no reload
- **Off the main thread** — the simulation and your scripts run in a Web Worker, so the UI stays smooth even when the sim is busy
- **WebGL2 2D renderer** — one GPU point per particle, with trails rendered through a fading offscreen target
- **WebXR / VR** — immersive headset support in 3D (the VR button appears on the action bar when a headset is available)
- **Mobile and desktop** — a floating panel that docks to any edge (a resizable bottom sheet on phones), a thumb-sized action bar, pinch-zoom and gestures
- **Live control panel** (built with [smoke-ui](https://github.com/n3rdw1z4rd/smoke-ui)) — particle count, speed, range, friction, force, beta, point size, trails, all applied instantly
- **Auto-limit** — optionally lowers the particle count when the simulation can't keep up, and raises it back when it can
- **Matrix editor** — drag any cell of the attraction matrix to sculpt behavior directly, with presets (random, symmetric, invert, snakes, zero)
- **Species editor** — 1–8 species, recolor any of them
- **Script editor** — write the force curve and per-frame rules in JavaScript and hot-swap them into the running sim
- **Shareable worlds** — the whole world (params, matrix, species, script) lives in the URL; also export/import as JSON
- **Spatial partitioning** — a toroidal uniform grid rebuilt each step with a counting sort over flat typed arrays
- **Toroidal space** — particles and the spatial grid both wrap at the edges, so there are no walls

## Controls

The **action bar** along the bottom has play/pause, step, restart, 2D/3D, the script editor (it turns lime while a script is running), VR, the panel toggle, and hide UI. The **panel** holds everything else, organized in tabs; dock it to any edge from the `layout` tab.

Keyboard shortcuts:

| Key     | Action                                                   |
| ------- | -------------------------------------------------------- |
| `space` | pause / play                                             |
| `.`     | step one frame                                           |
| `r`     | restart — respawn particles from the seed, keep the matrix |
| `R`     | reset all — fresh default world (asks first, with an option to export) |
| `n`     | new random world                                         |
| `d`     | toggle 2D / 3D                                           |
| `e`     | open / close the script editor                           |
| `p`     | show / hide the panel                                    |
| `h`     | hide the UI                                              |

**3D camera:** drag to orbit, scroll or pinch to zoom, double-click or double-tap to reset the view.

**Matrix editor:** rows are "this species", columns are "how it feels about that species". Drag a cell up/down to change it (hold `shift` for fine control), scroll over a cell to nudge it, and double-click, double-tap or long-press to zero it. On touch, tap a cell to read its value. Teal attracts, rose repels.

**Status bar:** render fps · simulation steps per second (and ms per step) · particles (`running/requested` when auto-limit has lowered the count) · dimensions · seed · simulated time.

**Auto-limit** (world tab): when on, the particle slider is the maximum. If steps take too long to hold `min sim fps` (default 20), fewer particles run; when there's headroom, the count climbs back up. These two settings are saved per device, not in shared links.

## Scripting

Open the editor (`e`), pick an example or write your own, and press **run** (`ctrl/⌘+enter`). A script is a plain ES module; every export is optional:

```js
// Pairwise force. r = distance / range in [0, 1), a = matrix entry in [-1, 1].
// This is the hot path (called for every nearby pair), so keep it cheap.
export function force(r, a, beta) {
    if (r < beta) return r / beta - 1;
    return a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta));
}

// Runs after Run and after every restart.
export function setup(sim) {}

// Runs every frame, before physics.
export function step(sim, dt) {}
```

The `sim` object:

| Member                          | What it is                                                     |
| ------------------------------- | -------------------------------------------------------------- |
| `count`, `dims`, `k`            | particle count, 2 or 3, species count                          |
| `time`, `frame`                 | simulated seconds, frame number                                |
| `pos`, `vel`                    | `Float64Array`, xyz per particle (z = 0 in 2D), world is `[0,1)` |
| `type`                          | `Uint8Array` species index per particle                        |
| `get(a, b)`, `set(a, b, v)`     | read/write the attraction matrix (the matrix editor stays in sync) |
| `params`                        | `{ range, frictionHalfLife, forceScale, beta, timeScale }`     |
| `pointer`                       | `{ x, y, down, active }` in world space (2D only)              |
| `rng.nextFloat()`               | seeded random number in `[0, 1)`                               |

Built-in examples: default force template, breathing matrix, pointer attractor, soft shells, predator/prey.

**Scripts run in a Web Worker**, next to the simulation. Everything on `sim` works, as does plain JavaScript (`Math`, `console.log`, `setTimeout`, …), but there's no page: no `document`, `window` or `localStorage`.

Safety nets:
- a `force` that returns a non-number is rejected before it runs
- a script that throws, or produces `NaN` positions, is stopped automatically and the particles are repaired
- a script stuck in an infinite loop (in `step()` or `setup()`) can't freeze the page: after 3 seconds without an answer the worker is replaced, particles stay where they were, and the script is turned off (its code stays in the editor)

**Shared scripts never auto-run.** If you open a link or import a file containing a script you haven't run before, the app shows a banner so you can review it first. Scripts you've run are remembered (by hash) in `localStorage`.

You can also poke at things from the browser console: `particles.sim` is the main-thread handle to the simulation (`get`/`set`, `k`, the latest frame's `pos`/`type`, …) and `particles.store` exposes every action (`particles.store.newWorld()`, `particles.store.range.set(0.15)`, …). To change particle positions directly, use a script — they run where the simulation lives.

## Sharing

| Param  | Values         | Meaning                                                        |
| ------ | -------------- | -------------------------------------------------------------- |
| `w`    | encoded world  | The full world: deflate-compressed JSON, base64url. The address bar updates as you edit, so reload keeps your world. |
| `seed` | integer        | A seed-only world                                              |
| `t`    | `2d` / `3d`    | Which view to launch (with `seed`)                             |

Seeds come from [`@n3rdw1z4rd/core`](https://www.npmjs.com/package/@n3rdw1z4rd/core)'s `Rng`. Links made before the switch to core (October 2026) still open, but a bare `?seed=` now produces a different world than it used to.

**Copy link** puts the full-world URL on your clipboard. **Export JSON** / **Import JSON** save and load the same world as a readable file — handy for hand-editing or keeping a library of worlds:

```json
{
  "v": 1, "dims": 2, "seed": 42, "count": 2000,
  "species": [{ "name": "red", "color": "#ff0000" }, …],
  "matrix": [[-0.74, -0.93, …], …],
  "range": 0.1, "frictionHalfLife": 0.04, "forceScale": 0.1, "beta": 0.3,
  "timeScale": 1, "pointSize": 2, "trails": 0,
  "script": ""
}
```

## Tech stack

- **TypeScript** (strict)
- **[@n3rdw1z4rd/core](https://www.npmjs.com/package/@n3rdw1z4rd/core)** — RNG, camera rig, gesture recognizer, `WorkerInterface`, WebGL2 wrappers, CSS reset
- **[smoke-ui](https://github.com/n3rdw1z4rd/smoke-ui)** + **smoke-ui-components** for the reactive UI
- **Web Worker** for the simulation and user scripts
- **WebGL2** 2D renderer (via core's `webgl.ts`)
- **Three.js** for 3D rendering and WebXR (lazy-loaded — 2D visitors never download it)
- **CodeMirror 6** for the script editor (lazy-loaded on first open)
- **Vite** for dev/build
- **MIT** licensed

## Running locally

```bash
npm install
npm run dev
```

To try it on a phone on the same network, expose the dev server: `npm run dev -- --host`. For production, serve the `dist/` folder from `npm run build` with any static web server. WebXR needs HTTPS on anything other than `localhost`.

## Project structure

```
src/
├── main.tsx                 # entry: app shell, overlays, keyboard shortcuts, console handle
├── main.css                 # layout (floating dock, insets), controls, overlays
├── app/
│   ├── store.ts             # smoke-ui signals for all live state + every action, auto-limit
│   ├── controls.ts          # the control panel described as data (DOM today, VR later)
│   └── ui-state.ts          # dock edge / open / tab / sheet size, auto-limit settings (persisted)
├── core/
│   ├── world.ts             # WorldConfig type, seeded spawning, URL/JSON codec
│   ├── simulation.ts        # dimension-agnostic sim: typed arrays + spatial grid
│   └── script.ts            # user-script compiler (ES module hooks) + examples
├── sim/
│   ├── sim.worker.ts        # the simulation + scripts, running in a Web Worker
│   ├── sim-client.ts        # main-thread stand-in (extends core's WorkerInterface)
│   └── protocol.ts          # messages between the two
├── render/
│   ├── renderer-2d.ts       # WebGL2 renderer (+ pointer for scripts)
│   └── renderer-3d.ts       # Three.js + WebXR renderer (lazy-loaded)
└── ui/
    ├── dock.tsx             # the floating, dockable, tabbed panel
    ├── controls-dom.tsx     # renders app/controls.ts with smoke-ui-components
    ├── action-bar.tsx       # floating buttons
    ├── confirm-reset.tsx    # "reset everything?" dialog
    ├── matrix-editor.ts     # drag-to-edit attraction matrix
    ├── script-editor.tsx    # CodeMirror drawer
    ├── icons.tsx
    └── toast.ts
```

## How it works (a little deeper)

1. **Seed the world.** A seeded RNG fills the attraction matrix and scatters particles with random positions and types. The matrix is stored in the world config, so hand edits survive sharing; positions are re-derived from the seed.
2. **Step in a worker.** The simulation lives in a Web Worker. While it's running, the worker steps back-to-back (capped at about 60 steps/s) and sends each frame's positions to the main thread in a transferred buffer — no copies, no shared-memory headers.
3. **Bin into the grid.** Each step, particles are counting-sorted into uniform cells no smaller than the interaction range (so the neighborhood always covers every interaction, and tiny grids never double-count a cell).
4. **Compute forces.** For every particle, only its own cell and the 8 (2D) or 26 (3D) neighbors are checked. Pairwise force comes from the distance and the two particles' matrix entry — via the built-in curve, or your script's `force()`.
5. **Integrate and wrap.** Velocities get friction-damped, positions update, and anything crossing an edge wraps. Step time is clamped so a background tab doesn't blow the world apart when you come back.
6. **Render.** The main thread always draws the latest frame. 2D uploads positions to a WebGL2 buffer and draws one point per particle; 3D writes into preallocated Three.js buffers and draws round, depth-tested points (no per-frame sorting needed), through the WebXR pipeline when a session is active.

## Background

This is part of a long-running personal collection of from-scratch graphics and simulation experiments. The shared engine code (RNG, WebGL wrappers, camera rig, input, workers) has been built up across many such projects over the years and now lives in [`@n3rdw1z4rd/core`](https://www.npmjs.com/package/@n3rdw1z4rd/core).

---

*Built for the joy of watching simple rules become complex behavior.*
