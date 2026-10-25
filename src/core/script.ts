import type { ForceFn, Simulation } from './simulation';

/**
 * A user script is a plain ES module. Every export is optional:
 *
 *   export function force(r, a, beta) { ... }  // pairwise force curve (hot path!)
 *   export function setup(sim) { ... }         // after Run and after every reset
 *   export function step(sim, dt) { ... }      // every frame, before physics
 */
export interface ScriptHooks {
    force?: ForceFn;
    setup?: (sim: Simulation) => void;
    step?: (sim: Simulation, dt: number) => void;
}

export async function compileScript(source: string): Promise<ScriptHooks> {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));

    try {
        const mod = await import(/* @vite-ignore */ url);
        const hooks: ScriptHooks = {};

        for (const name of ['force', 'setup', 'step'] as const) {
            if (mod[name] === undefined) continue;
            if (typeof mod[name] !== 'function') throw new Error(`export "${name}" must be a function`);
            (hooks as any)[name] = mod[name];
        }

        if (hooks.force) {
            // Smoke-test the force curve so a typo doesn't NaN the whole world.
            for (const [r, a] of [[0.1, 0.5], [0.5, -0.5], [0.9, 1]]) {
                const f = hooks.force(r, a, 0.3);
                if (typeof f !== 'number' || !Number.isFinite(f)) {
                    throw new Error(`force(${r}, ${a}, 0.3) returned ${String(f)} — it must return a finite number`);
                }
            }
        }

        return hooks;
    } finally {
        URL.revokeObjectURL(url);
    }
}

export function describeError(err: unknown): string {
    if (err instanceof Error) return `${err.name}: ${err.message}`;
    return String(err);
}

/* ------------------------------------------------------------------ */
/* Examples                                                             */
/* ------------------------------------------------------------------ */

const API_DOC = `// ── Particle script ─────────────────────────────────────────────
// A plain ES module. Every export is optional:
//
//   force(r, a, beta) → number   pairwise force (hot path, keep it cheap)
//       r    distance / range, in [0, 1)
//       a    matrix entry for (this species → other species), in [-1, 1]
//       beta close-range repulsion cutoff
//   setup(sim)                   after Run and after every reset
//   step(sim, dt)                every frame, before physics
//
// sim:
//   sim.count, sim.dims, sim.k (species), sim.time, sim.frame
//   sim.pos / sim.vel   Float64Array, xyz per particle (z = 0 in 2D)
//   sim.type            Uint8Array species index per particle
//   sim.get(a, b), sim.set(a, b, v)   attraction matrix (UI stays in sync)
//   sim.params          { range, frictionHalfLife, forceScale, beta, timeScale }
//   sim.pointer         { x, y, down, active } in world space (2D only)
//   sim.rng.nextFloat() seeded random in [0, 1)
// ─────────────────────────────────────────────────────────────────
`;

export const SCRIPT_EXAMPLES: { name: string; source: string }[] = [
    {
        name: 'Default force (template)',
        source: `${API_DOC}
// The built-in force curve, ready to tweak.
export function force(r, a, beta) {
    if (r < beta) return r / beta - 1;           // close range: always repel
    return a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta)); // matrix-weighted hump
}
`,
    },
    {
        name: 'Breathing matrix',
        source: `${API_DOC}
// Slowly rotates every matrix entry through a sine wave, so structures
// form, dissolve and re-form.
let base;

export function setup(sim) {
    base = [];
    for (let a = 0; a < sim.k; a++)
        for (let b = 0; b < sim.k; b++) base.push(sim.get(a, b));
}

export function step(sim, dt) {
    const t = sim.time * 0.4;
    for (let a = 0; a < sim.k; a++)
        for (let b = 0; b < sim.k; b++) {
            const phase = (a * 7 + b * 3) * 0.7;
            sim.set(a, b, base[a * sim.k + b] * Math.cos(t + phase));
        }
}
`,
    },
    {
        name: 'Pointer attractor (2D)',
        source: `${API_DOC}
// Click and drag on the canvas to pull particles toward the cursor.
export function step(sim, dt) {
    const p = sim.pointer;
    if (!p.down) return;

    for (let i = 0; i < sim.count; i++) {
        let dx = p.x - sim.pos[i * 3];
        let dy = p.y - sim.pos[i * 3 + 1];
        if (dx > 0.5) dx -= 1; else if (dx < -0.5) dx += 1; // toroidal
        if (dy > 0.5) dy -= 1; else if (dy < -0.5) dy += 1;
        const d = Math.hypot(dx, dy) + 0.02;
        sim.vel[i * 3] += (dx / d) * 0.04;
        sim.vel[i * 3 + 1] += (dy / d) * 0.04;
    }
}
`,
    },
    {
        name: 'Soft shells',
        source: `${API_DOC}
// A smoother, longer-tailed force: gentle repulsion core, then a
// cosine-shaped attraction band. Tends to make round, membrane-like cells.
export function force(r, a, beta) {
    if (r < beta) return (r / beta - 1) * 0.6;
    const t = (r - beta) / (1 - beta);           // 0..1 across the band
    return a * 0.5 * (1 - Math.cos(t * Math.PI * 2));
}
`,
    },
    {
        name: 'Predator / prey',
        source: `${API_DOC}
// Overrides the matrix in setup(): each species chases the next one
// and flees the previous one, forming a rock-paper-scissors cycle.
export function setup(sim) {
    for (let a = 0; a < sim.k; a++)
        for (let b = 0; b < sim.k; b++) {
            let v = 0;
            if (a === b) v = 0.4;
            else if (b === (a + 1) % sim.k) v = 0.8;   // chase
            else if (b === (a + sim.k - 1) % sim.k) v = -0.8; // flee
            else v = -0.1;
            sim.set(a, b, v);
        }
}
`,
    },
];
