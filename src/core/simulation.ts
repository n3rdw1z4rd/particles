import { Rng } from '@n3rdw1z4rd/core';
import { spawn, WorldConfig } from './world';

export type ForceFn = (r: number, a: number, beta: number) => number;

export interface SimParams {
    range: number;
    frictionHalfLife: number;
    forceScale: number;
    beta: number;
    timeScale: number;
}

/** Pointer position in world space (2D only), exposed to scripts. */
export interface SimPointer {
    x: number;
    y: number;
    down: boolean;
    active: boolean;
}

/** The classic particle-life force curve. `r` is distance / range, in [0, 1). */
export const defaultForce: ForceFn = (r, a, beta) => {
    if (r < beta) return r / beta - 1;
    if (r < 1) return a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta));
    return 0;
};

const MAX_DT = 1 / 20; // clamp big frame gaps (tab switches) so the world doesn't explode

/**
 * Dimension-agnostic particle-life simulation over a toroidal unit square/cube.
 *
 * Storage is flat typed arrays (xyz per particle, z = 0 in 2D) and the spatial
 * grid is rebuilt every step with a counting sort — no per-particle objects,
 * no array splicing.
 */
export class Simulation {
    dims: 2 | 3;
    count = 0;
    k: number; // species count

    pos = new Float64Array(0);
    vel = new Float64Array(0);
    type = new Uint8Array(0);

    /** Row-major k×k attraction matrix. Use get()/set() from scripts to keep the UI in sync. */
    matrix: Float32Array;
    /** Bumped whenever the matrix changes, so editors know to redraw. */
    matrixVersion = 0;

    params: SimParams;
    pointer: SimPointer = { x: 0, y: 0, down: false, active: false };

    /** Custom force from a script; `null` uses the built-in (fast, inlined) curve. */
    force: ForceFn | null = null;

    time = 0;
    frame = 0;
    rng = new Rng();

    // spatial grid
    private _gridN = 0;
    private _gridNz = 0;
    private _gridRange = -1;
    private _cellOf = new Int32Array(0);
    private _cellStart = new Int32Array(0);
    private _sorted = new Int32Array(0);
    private _neighbors = new Int32Array(0);
    private _neighborCount = new Uint8Array(0);

    constructor(cfg: WorldConfig) {
        this.dims = cfg.dims;
        this.k = cfg.species.length;
        this.matrix = new Float32Array(this.k * this.k);
        this.params = {
            range: cfg.range,
            frictionHalfLife: cfg.frictionHalfLife,
            forceScale: cfg.forceScale,
            beta: cfg.beta,
            timeScale: cfg.timeScale,
        };
        this.setMatrix(cfg.matrix);
        this.respawn(cfg);
    }

    /* ---------------------------------------------------------------- */
    /* Matrix                                                             */
    /* ---------------------------------------------------------------- */

    get(a: number, b: number): number {
        return this.matrix[a * this.k + b];
    }

    set(a: number, b: number, value: number): void {
        const v = Math.max(-1, Math.min(1, value));
        if (Number.isFinite(v) && this.matrix[a * this.k + b] !== v) {
            this.matrix[a * this.k + b] = v;
            this.matrixVersion++;
        }
    }

    setMatrix(m: number[][]): void {
        for (let a = 0; a < this.k; a++) {
            for (let b = 0; b < this.k; b++) {
                this.matrix[a * this.k + b] = Math.max(-1, Math.min(1, m[a]?.[b] ?? 0));
            }
        }
        this.matrixVersion++;
    }

    getMatrix(): number[][] {
        return Array.from({ length: this.k }, (_, a) =>
            Array.from({ length: this.k }, (_, b) => this.matrix[a * this.k + b]),
        );
    }

    /* ---------------------------------------------------------------- */
    /* Structural changes                                                 */
    /* ---------------------------------------------------------------- */

    /** Re-creates particles from the seed (same seed → same starting world). */
    respawn(cfg: Pick<WorldConfig, 'seed' | 'dims' | 'count' | 'species'>): void {
        const s = spawn(cfg);
        this.dims = cfg.dims;
        this.count = cfg.count;
        this.pos = s.pos;
        this.vel = new Float64Array(this.count * 3);
        this.type = s.type;
        this.time = 0;
        this.frame = 0;
        this.rng.seed = cfg.seed ^ 0x5bd1e995;
        this._gridRange = -1;
    }

    /** Grows/shrinks the population, keeping existing particles. */
    setCount(n: number): void {
        n = Math.max(1, n | 0);
        if (n === this.count) return;

        const pos = new Float64Array(n * 3);
        const vel = new Float64Array(n * 3);
        const type = new Uint8Array(n);
        const keep = Math.min(n, this.count);

        pos.set(this.pos.subarray(0, keep * 3));
        vel.set(this.vel.subarray(0, keep * 3));
        type.set(this.type.subarray(0, keep));

        for (let i = keep; i < n; i++) {
            pos[i * 3] = this.rng.nextFloat();
            pos[i * 3 + 1] = this.rng.nextFloat();
            pos[i * 3 + 2] = this.dims === 3 ? this.rng.nextFloat() : 0;
            type[i] = this.rng.range(this.k);
        }

        this.pos = pos;
        this.vel = vel;
        this.type = type;
        this.count = n;
    }

    /**
     * Changes the number of species. Existing matrix entries are kept; new
     * rows/columns are randomized. When adding, ~1/k of particles convert to
     * the new species; when removing, orphaned particles are redistributed.
     */
    setSpeciesCount(k: number, newEntries?: () => number): void {
        if (k === this.k || k < 1) return;

        const rand = newEntries ?? (() => this.rng.nextFloat() * 2 - 1);
        const old = this.matrix;
        const oldK = this.k;
        const m = new Float32Array(k * k);

        for (let a = 0; a < k; a++) {
            for (let b = 0; b < k; b++) {
                m[a * k + b] = a < oldK && b < oldK ? old[a * oldK + b] : rand();
            }
        }

        for (let i = 0; i < this.count; i++) {
            if (k > oldK) {
                if (this.rng.nextFloat() < (k - oldK) / k) this.type[i] = oldK + this.rng.range(k - oldK);
            } else if (this.type[i] >= k) {
                this.type[i] = this.rng.range(k);
            }
        }

        this.k = k;
        this.matrix = m;
        this.matrixVersion++;
    }

    setDims(dims: 2 | 3): void {
        if (dims === this.dims) return;
        this.dims = dims;

        for (let i = 0; i < this.count; i++) {
            this.pos[i * 3 + 2] = dims === 3 ? this.rng.nextFloat() : 0;
            this.vel[i * 3 + 2] = 0;
        }

        this._gridRange = -1;
    }

    /* ---------------------------------------------------------------- */
    /* Spatial grid                                                       */
    /* ---------------------------------------------------------------- */

    private _buildGridTables(): void {
        const range = this.params.range;
        // Cell size must be >= range so the 3×3(×3) neighborhood covers every interaction.
        const n = Math.max(1, Math.floor(1 / range));
        const nz = this.dims === 3 ? n : 1;
        const cells = n * n * nz;

        this._gridN = n;
        this._gridNz = nz;
        this._gridRange = range;
        this._cellStart = new Int32Array(cells + 1);
        this._neighbors = new Int32Array(cells * 27);
        this._neighborCount = new Uint8Array(cells);

        const wrap = (v: number, m: number) => ((v % m) + m) % m;
        const dzRange = nz > 1 ? 1 : 0;

        for (let cz = 0; cz < nz; cz++) {
            for (let cy = 0; cy < n; cy++) {
                for (let cx = 0; cx < n; cx++) {
                    const c = (cz * n + cy) * n + cx;
                    const seen = new Set<number>(); // dedupe when the grid has < 3 cells per axis
                    for (let dz = -dzRange; dz <= dzRange; dz++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                seen.add((wrap(cz + dz, nz) * n + wrap(cy + dy, n)) * n + wrap(cx + dx, n));
                            }
                        }
                    }
                    let j = 0;
                    for (const nb of seen) this._neighbors[c * 27 + j++] = nb;
                    this._neighborCount[c] = j;
                }
            }
        }
    }

    private _binParticles(): void {
        if (this._gridRange !== this.params.range) this._buildGridTables();

        const n = this._gridN;
        const nz = this._gridNz;
        const cells = n * n * nz;
        const count = this.count;

        if (this._cellOf.length !== count) {
            this._cellOf = new Int32Array(count);
            this._sorted = new Int32Array(count);
        }

        const start = this._cellStart;
        start.fill(0);

        for (let i = 0; i < count; i++) {
            const cx = Math.min(n - 1, (this.pos[i * 3] * n) | 0);
            const cy = Math.min(n - 1, (this.pos[i * 3 + 1] * n) | 0);
            const cz = nz > 1 ? Math.min(nz - 1, (this.pos[i * 3 + 2] * nz) | 0) : 0;
            const c = (cz * n + cy) * n + cx;
            this._cellOf[i] = c;
            start[c + 1]++;
        }

        for (let c = 0; c < cells; c++) start[c + 1] += start[c];

        const fill = start.slice(0, cells);
        for (let i = 0; i < count; i++) this._sorted[fill[this._cellOf[i]]++] = i;
    }

    /* ---------------------------------------------------------------- */
    /* Step                                                               */
    /* ---------------------------------------------------------------- */

    /** Advances the simulation. `dt` is real seconds; it's clamped and scaled by `timeScale`. */
    step(dt: number): void {
        dt = Math.min(dt, MAX_DT) * this.params.timeScale;
        if (dt <= 0 || this.count === 0) return;

        this._binParticles();

        const { range, frictionHalfLife, forceScale, beta } = this.params;
        const friction = Math.pow(0.5, dt / frictionHalfLife);
        const scale = range * forceScale;
        const range2 = range * range;
        const is3d = this.dims === 3;
        const k = this.k;

        const pos = this.pos;
        const vel = this.vel;
        const type = this.type;
        const matrix = this.matrix;
        const sorted = this._sorted;
        const start = this._cellStart;
        const neighbors = this._neighbors;
        const neighborCount = this._neighborCount;
        const cellOf = this._cellOf;
        const custom = this.force;
        const invBeta = 1 / beta;
        const invOneMinusBeta = 1 / (1 - beta);

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            const px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
            const row = type[i] * k;
            const c = cellOf[i];
            const nbBase = c * 27;
            let fx = 0, fy = 0, fz = 0;

            for (let nbi = 0; nbi < neighborCount[c]; nbi++) {
                const nc = neighbors[nbBase + nbi];
                const end = start[nc + 1];

                for (let s = start[nc]; s < end; s++) {
                    const j = sorted[s];
                    if (j === i) continue;
                    const j3 = j * 3;

                    let dx = pos[j3] - px;
                    if (dx > 0.5) dx -= 1; else if (dx < -0.5) dx += 1;
                    let dy = pos[j3 + 1] - py;
                    if (dy > 0.5) dy -= 1; else if (dy < -0.5) dy += 1;
                    let dz = 0;
                    if (is3d) {
                        dz = pos[j3 + 2] - pz;
                        if (dz > 0.5) dz -= 1; else if (dz < -0.5) dz += 1;
                    }

                    const d2 = dx * dx + dy * dy + dz * dz;
                    if (d2 <= 0 || d2 >= range2) continue;

                    const d = Math.sqrt(d2);
                    const r = d / range;
                    const a = matrix[row + type[j]];

                    let f: number;
                    if (custom) {
                        f = custom(r, a, beta);
                    } else if (r < beta) {
                        f = r * invBeta - 1;
                    } else {
                        f = a * (1 - Math.abs(2 * r - 1 - beta) * invOneMinusBeta);
                    }

                    const inv = f / d;
                    fx += dx * inv;
                    fy += dy * inv;
                    fz += dz * inv;
                }
            }

            vel[i3] = vel[i3] * friction + fx * scale;
            vel[i3 + 1] = vel[i3 + 1] * friction + fy * scale;
            vel[i3 + 2] = is3d ? vel[i3 + 2] * friction + fz * scale : 0;
        }

        for (let i = 0; i < this.count * 3; i++) {
            let p = pos[i] + vel[i] * dt;
            p -= Math.floor(p); // toroidal wrap
            pos[i] = p;
        }

        if (!is3d) for (let i = 0; i < this.count; i++) pos[i * 3 + 2] = 0;

        this.time += dt;
        this.frame++;
    }

    /** Returns the number of particles with non-finite state (and repairs them). */
    repairNonFinite(): number {
        let bad = 0;
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            if (!Number.isFinite(this.pos[i3] + this.pos[i3 + 1] + this.pos[i3 + 2] + this.vel[i3] + this.vel[i3 + 1] + this.vel[i3 + 2])) {
                bad++;
                this.pos[i3] = this.rng.nextFloat();
                this.pos[i3 + 1] = this.rng.nextFloat();
                this.pos[i3 + 2] = this.dims === 3 ? this.rng.nextFloat() : 0;
                this.vel[i3] = this.vel[i3 + 1] = this.vel[i3 + 2] = 0;
            }
        }
        return bad;
    }
}
