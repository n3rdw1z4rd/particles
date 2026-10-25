# particles

An emergent **particle-life** simulation written from scratch in TypeScript. Thousands of simple particles, governed by a randomly generated attraction/repulsion matrix, organize themselves into surprisingly lifelike structures — cells, chains, orbiting clusters, and self-sustaining "organisms" — with no explicit rules telling them to do so.

Runs in **2D** on a canvas renderer and in **3D** with full **WebXR (VR) support** — put on a headset and stand inside the simulation!

### [Live Demo](https://particles.n3rdw1z4rd.cloud)

## What's going on here

Every particle belongs to one of several color types. A single N×N **attraction matrix** defines how each type feels about every other type: positive values attract, negative values repel. That one matrix is the entire "DNA" of the system. From those simple pairwise forces, complex collective behavior emerges — the same principle behind flocking, chemistry, and cellular self-organization.

The force curve has a short-range repulsion zone (so particles never collapse into each other) and a mid-range attraction/repulsion zone weighted by the matrix. Friction bleeds off energy each frame so the system settles into structure instead of flying apart.

Because the matrix is seeded by a reproducible RNG, every "world" has an ID. Share the seed (it's in the URL) and someone else sees the exact same emergent universe.

## Features

- **One engine, two views** — a single dimension-agnostic simulation core; switch 2D ↔ 3D live (`D`), no reload
- **WebXR / VR** — immersive headset support in 3D (the VR button appears when a headset is available)
- **Live control panel** (built with [smoke-ui](https://github.com/n3rdw1z4rd/smoke-ui)) — particle count, speed, range, friction, force, beta, point size, trails, all applied instantly
- **Matrix editor** — drag any cell of the attraction matrix to sculpt behavior directly, with presets (random, symmetric, invert, snakes, zero)
- **Species editor** — 1–8 species, recolor any of them
- **Script editor** — write the force curve and per-frame rules in JavaScript and hot-swap them into the running sim
- **Shareable worlds** — the whole world (params, matrix, species, script) lives in the URL; also export/import as JSON
- **Spatial partitioning** — a toroidal uniform grid rebuilt each step with a counting sort over flat typed arrays
- **Seeded, reproducible RNG** — old `?seed=` links still produce the exact same world
- **Toroidal space** — particles and the spatial grid both wrap at the edges, so there are no walls

## Controls

Everything lives in the panel on the right. Keyboard shortcuts:

| Key     | Action                                              |
| ------- | --------------------------------------------------- |
| `Space` | pause / play                                        |
| `.`     | step one frame                                      |
| `R`     | reset — respawn particles from the seed, keep the matrix |
| `N`     | new random world                                    |
| `D`     | toggle 2D / 3D                                      |
| `E`     | open / close the script editor                      |
| `H`     | hide the UI                                         |

In 3D, drag to orbit and scroll to zoom (scroll all the way in to stand inside the cube).

**Matrix editor:** rows are "this species", columns are "how it feels about that species". Drag a cell up/down to change it (hold `Shift` for fine control), scroll over a cell to nudge it, double-click to zero it. Teal attracts, rose repels.

## Scripting

Open the editor (`E`), pick an example or write your own, and press **Run** (`Ctrl/⌘+Enter`). A script is a plain ES module; every export is optional:

```js
// Pairwise force. r = distance / range in [0, 1), a = matrix entry in [-1, 1].
// This is the hot path (called for every nearby pair), so keep it cheap.
export function force(r, a, beta) {
    if (r < beta) return r / beta - 1;
    return a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta));
}

// Runs after Run and after every reset.
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
| `rng.nextf`                     | seeded random number in `[0, 1)`                               |

Built-in examples: default force template, breathing matrix, pointer attractor, soft shells, predator/prey.

Safety nets: a `force` that returns a non-number is rejected before it runs; a script that throws or produces `NaN` positions is stopped automatically and the particles are repaired. (An infinite loop will still hang the tab — scripts run on the main thread.)

**Shared scripts never auto-run.** If you open a link or import a file containing a script you haven't run before, the app shows a banner so you can review it first. Scripts you've run are remembered (by hash) in `localStorage`.

You can also poke at things from the browser console: `particles.sim` is the live simulation and `particles.store` exposes every action (`particles.store.newWorld()`, `particles.store.range.set(0.15)`, …).

## Sharing

| Param  | Values         | Meaning                                                        |
| ------ | -------------- | -------------------------------------------------------------- |
| `w`    | encoded world  | The full world: deflate-compressed JSON, base64url. The address bar updates as you edit, so reload keeps your world. |
| `seed` | integer        | Legacy: seed-only world (same result as before)                |
| `t`    | `2d` / `3d`    | Legacy: which view to launch                                   |

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
- **[smoke-ui](https://github.com/n3rdw1z4rd/smoke-ui)** + **smoke-ui-components** for the reactive UI
- **Three.js** for 3D rendering and WebXR (lazy-loaded — 2D visitors never download it)
- **CodeMirror 6** for the script editor (lazy-loaded on first open)
- Custom 2D canvas renderer
- **Vite** for dev/build, with HTTPS dev server (basic-ssl) for WebXR
- **nginx + Podman** (multi-stage build) for containerized deployment
- **MIT** licensed

## Running locally

```bash
npm install
npm run dev
```

## Project structure

```
src/
├── main.tsx                 # entry: overlays, keyboard shortcuts, console handle
├── app/
│   └── store.ts             # smoke-ui signals for all live state + every action
├── core/
│   ├── world.ts             # WorldConfig type, seeded spawning, URL/JSON codec
│   ├── simulation.ts        # dimension-agnostic sim: typed arrays + spatial grid
│   └── script.ts            # user-script compiler (ES module hooks) + examples
├── render/
│   ├── renderer-2d.ts       # canvas renderer (+ pointer for scripts)
│   └── renderer-3d.ts       # Three.js + WebXR renderer (lazy-loaded)
├── ui/
│   ├── panel.tsx            # control panel (smoke-ui-components)
│   ├── matrix-editor.ts     # drag-to-edit attraction matrix
│   ├── script-editor.tsx    # CodeMirror drawer
│   └── toast.ts
└── utils/                   # shared engine bits: RNG, color, Three.js helpers, etc.
```

## How it works (a little deeper)

1. **Seed the world.** A seeded RNG fills the attraction matrix and scatters particles with random positions and types. The matrix is stored in the world config, so hand edits survive sharing; positions are re-derived from the seed.
2. **Bin into the grid.** Each step, particles are counting-sorted into uniform cells no smaller than the interaction range (so the neighborhood always covers every interaction, and tiny grids never double-count a cell).
3. **Compute forces.** For every particle, only its own cell and the 8 (2D) or 26 (3D) neighbors are checked. Pairwise force comes from the distance and the two particles' matrix entry — via the built-in curve, or your script's `force()`.
4. **Integrate and wrap.** Velocities get friction-damped, positions update, and anything crossing an edge wraps. Frame time is clamped so a background tab doesn't blow the world apart when you come back.
5. **Render.** 2D draws one batched path per species; 3D writes into preallocated Three.js buffers and draws round, depth-tested points (no per-frame sorting needed), through the WebXR pipeline when a session is active.

## Background

This is part of a long-running personal collection of from-scratch graphics and simulation experiments. The shared `utils/` source (RNG, renderer, Three.js boilerplate, math helpers) has been built up and refined across many such projects over the years.

---

*Built for the joy of watching simple rules become complex behavior.*
