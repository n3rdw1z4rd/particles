# particles

An emergent **particle-life** simulation written from scratch in TypeScript. Thousands of simple particles, governed by a randomly generated attraction/repulsion matrix, organize themselves into surprisingly lifelike structures — cells, chains, orbiting clusters, and self-sustaining "organisms" — with no explicit rules telling them to do so.

Runs in **2D** on a canvas renderer and in **3D** with full **WebXR (VR) support** — put on a headset and stand inside the simulation!

### [Live Demo](https://particles.n3rdw1z4rd.io)

## What's going on here

Every particle belongs to one of several color types. A single N×N **attraction matrix** defines how each type feels about every other type: positive values attract, negative values repel. That one matrix is the entire "DNA" of the system. From those simple pairwise forces, complex collective behavior emerges — the same principle behind flocking, chemistry, and cellular self-organization.

The force curve has a short-range repulsion zone (so particles never collapse into each other) and a mid-range attraction/repulsion zone weighted by the matrix. Friction bleeds off energy each frame so the system settles into structure instead of flying apart.

Because the matrix is seeded by a reproducible RNG, every "world" has an ID. Share the seed (it's in the URL) and someone else sees the exact same emergent universe.

## Features

- **2D and 3D engines** sharing the same force/matrix model
- **WebXR / VR** — immersive headset support in the 3D version, including camera-rig repositioning on session start
- **Custom GLSL shaders** for point rendering with per-particle vertex colors
- **Spatial partitioning** — a toroidal (wrap-around) uniform grid reduces neighbor checks from O(n²) to near-linear, so thousands of particles stay smooth
- **Distance sorting** of particles relative to the camera each frame for correct alpha blending in 3D
- **Seeded, reproducible RNG** — shareable worlds via URL parameters
- **Toroidal space** — particles and the spatial grid both wrap at the edges, so there are no walls

## Controls

The on-screen buttons:

- **set** — locks in the current seed and writes it to the URL (so you can come back to or share this exact world)
- **reset** — clears the seed and generates a fresh random world
- **2d/3d** — toggles between the canvas and WebXR renderers

You can also drive it directly with URL parameters:

| Param  | Values     | Meaning                                  |
| ------ | ---------- | ---------------------------------------- |
| `t`    | `2d` / `3d`| Which engine to launch (default `2d`)    |
| `seed` | integer    | Seeds the RNG for a reproducible world   |

Example: `?seed=42`

## Tech stack

- **TypeScript** (strict)
- **Three.js** for 3D rendering and WebXR
- Custom 2D canvas renderer
- **Vite** for dev/build, with HTTPS dev server (basic-ssl) for WebXR
- **nginx + Podman** (multi-stage build) for containerized deployment
- **MIT** licensed

## Running locally

```bash
npm install
npm run dev
```

## Containerized deployment

A multi-stage build compiles the app in a Node image, then serves the static `/dist` output from **nginx:alpine**. Convenience scripts wrap **Podman**:

```bash
npm run podman-build    # build the image
npm run podman-run      # run it, mapping host :4000 -> container :80
npm run podman-clean    # stop/remove the container and image
npm run podman-update   # clean + build + run in one shot
```

Then visit `http://localhost:4000`. (The scripts use `podman` — swap in `docker` if that's your runtime.)

## Project structure

```
src/
├── main.ts                       # entry point, param handling, UI buttons
├── particles-2d/
│   ├── particle-system-2d.ts     # 2D force/matrix simulation
│   └── spatial-partition-2d.ts   # toroidal uniform grid (2D)
├── particles-3d/
│   ├── index.ts                  # 3D + WebXR bootstrap
│   ├── particle-system-3d.ts     # 3D simulation + GLSL shaders
│   └── spatial-partition-3d.ts   # toroidal uniform grid (3D)
└── utils/                        # reusable engine bits: RNG, color,
                                  # renderer, Three.js boilerplate, etc.
```

## How it works (a little deeper)

1. **Seed the world.** An RNG (optionally seeded from the URL) fills the attraction matrix and scatters particles with random positions and types.
2. **Each frame, compute forces.** For every particle, only its own grid cell and the 8 (2D) or 26 (3D) neighboring cells are checked — the spatial partition makes this cheap. Pairwise force comes from the distance and the two particles' matrix entry.
3. **Integrate and wrap.** Velocities get friction-damped, positions update, and anything crossing an edge wraps to the other side.
4. **Render.** 2D draws to canvas; 3D pushes positions/colors into a Three.js buffer geometry, sorts back-to-front for correct transparency, and renders through the WebXR pipeline if a session is active.

## Background

This is part of a long-running personal collection of from-scratch graphics and simulation experiments. The shared `utils/` engine (RNG, renderer, Three.js boilerplate, math helpers) has been built up and refined across many such projects over the years.

---

*Built for the joy of watching simple rules become complex behavior.*
