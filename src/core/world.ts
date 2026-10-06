import { Rng } from '../utils/rng';

/**
 * A complete, serializable description of a world. Everything needed to
 * reproduce a simulation lives here — share it as JSON or as a `?w=` link.
 *
 * Particle positions are NOT stored: they're re-derived from `seed`, `dims`,
 * `count` and the species count, so links stay short.
 */
export interface Species {
    name: string;
    color: string; // '#rrggbb'
}

export interface WorldConfig {
    v: 1;
    dims: 2 | 3;
    seed: number;
    count: number;
    species: Species[];
    /** matrix[a][b]: how species `a` feels about species `b` (+ attract, − repel), in [-1, 1]. */
    matrix: number[][];
    /** Interaction radius as a fraction of the (unit) world. */
    range: number;
    /** Seconds for velocity to halve due to friction. */
    frictionHalfLife: number;
    /** Overall force multiplier (was `_rangeFactor`). */
    forceScale: number;
    /** Normalized distance where close-range repulsion hands off to the matrix force. */
    beta: number;
    /** Simulation speed multiplier. */
    timeScale: number;
    pointSize: number;
    /** 2D only: 0 = no trails, approaching 1 = long trails. */
    trails: number;
    /** User script (ES module source). Empty string = none. */
    script: string;
}

export const DEFAULT_SPECIES: Species[] = [
    { name: 'red', color: '#ff0000' },
    { name: 'green', color: '#00ff00' },
    { name: 'blue', color: '#0000ff' },
    { name: 'yellow', color: '#ffff00' },
    { name: 'magenta', color: '#ff00ff' },
    { name: 'orange', color: '#ff8000' },
    { name: 'cyan', color: '#00ffff' },
    { name: 'purple', color: '#8000ff' },
];

export const MAX_SPECIES = DEFAULT_SPECIES.length;

/** Per-dimension defaults, matching the original 2D/3D engines. */
export const DIM_DEFAULTS = {
    2: { count: 2000, range: 0.1, pointSize: 2 },
    3: { count: 1000, range: 0.2, pointSize: 4 },
} as const;

export function randomSeed(): number {
    return (Math.random() * 0x7fffffff) | 0;
}

export function defaultConfig(dims: 2 | 3 = 2, seed: number = randomSeed()): WorldConfig {
    const d = DIM_DEFAULTS[dims];
    const species = DEFAULT_SPECIES.slice(0, 5).map((s) => ({ ...s }));

    const cfg: WorldConfig = {
        v: 1,
        dims,
        seed,
        count: d.count,
        species,
        matrix: [],
        range: d.range,
        frictionHalfLife: 0.04,
        forceScale: 0.1,
        beta: 0.3,
        timeScale: 1,
        pointSize: d.pointSize,
        trails: 0,
        script: '',
    };

    cfg.matrix = spawn(cfg).matrix;

    return cfg;
}

export interface Spawned {
    pos: Float64Array<ArrayBuffer>; // xyz per particle (z = 0 in 2D)
    type: Uint8Array<ArrayBuffer>;
    matrix: number[][];
}

/**
 * Deterministically generates initial particles + a random matrix from the seed.
 *
 * The draw order deliberately mirrors the original engines so old `?seed=`
 * links produce the same world: the 2D engine generated the matrix first (a
 * class-field initializer), the 3D engine generated particles first.
 */
export function spawn(cfg: Pick<WorldConfig, 'seed' | 'dims' | 'count' | 'species'>): Spawned {
    const rng = new Rng();
    rng.seed = cfg.seed;

    const k = cfg.species.length;
    const n = cfg.count;
    const pos = new Float64Array(n * 3);
    const type = new Uint8Array(n);

    let matrix: number[][] = [];

    if (cfg.dims === 2) {
        matrix = rng.randomMatrix(k);

        for (let i = 0; i < n; i++) {
            pos[i * 3] = rng.nextf;
            pos[i * 3 + 1] = rng.nextf;
            type[i] = rng.range(k);
        }
    } else {
        for (let i = 0; i < n; i++) {
            pos[i * 3] = rng.nextf;
            pos[i * 3 + 1] = rng.nextf;
            pos[i * 3 + 2] = rng.nextf;
            type[i] = rng.range(k);
        }

        matrix = rng.randomMatrix(k);
    }

    return { pos, type, matrix };
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

const clampNum = (v: unknown, min: number, max: number, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const HEX = /^#[0-9a-f]{6}$/i;

/** Coerces arbitrary (imported / URL) JSON into a safe WorldConfig. */
export function normalizeConfig(input: any): WorldConfig {
    const dims: 2 | 3 = input?.dims === 3 ? 3 : 2;
    const base = defaultConfig(dims, clampNum(input?.seed, -0x80000000, 0x7fffffff, randomSeed()) | 0);

    const species: Species[] = Array.isArray(input?.species) && input.species.length >= 1
        ? input.species.slice(0, MAX_SPECIES).map((s: any, i: number) => ({
            name: typeof s?.name === 'string' ? s.name.slice(0, 24) : DEFAULT_SPECIES[i].name,
            color: typeof s?.color === 'string' && HEX.test(s.color) ? s.color : DEFAULT_SPECIES[i].color,
        }))
        : base.species;

    const k = species.length;
    const fallbackMatrix = spawn({ ...base, species }).matrix;
    const matrix = Array.from({ length: k }, (_, a) =>
        Array.from({ length: k }, (_, b) => clampNum(input?.matrix?.[a]?.[b], -1, 1, fallbackMatrix[a][b])),
    );

    return {
        v: 1,
        dims,
        seed: base.seed,
        count: clampNum(input?.count, 1, 20000, base.count) | 0,
        species,
        matrix,
        range: clampNum(input?.range, 0.01, 0.5, base.range),
        frictionHalfLife: clampNum(input?.frictionHalfLife, 0.001, 2, base.frictionHalfLife),
        forceScale: clampNum(input?.forceScale, 0, 2, base.forceScale),
        beta: clampNum(input?.beta, 0.01, 0.99, base.beta),
        timeScale: clampNum(input?.timeScale, 0, 4, base.timeScale),
        pointSize: clampNum(input?.pointSize, 0.5, 20, base.pointSize),
        trails: clampNum(input?.trails, 0, 0.99, 0),
        script: typeof input?.script === 'string' ? input.script.slice(0, 100_000) : '',
    };
}

/* ------------------------------------------------------------------ */
/* URL codec: JSON → deflate-raw → base64url                            */
/* ------------------------------------------------------------------ */

async function pipeBytes(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
    const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

/** Rounds matrix values so links stay compact. */
export function compactConfig(cfg: WorldConfig): WorldConfig {
    const r = (v: number, p = 1000) => Math.round(v * p) / p;
    return {
        ...cfg,
        matrix: cfg.matrix.map((row) => row.map((v) => r(v))),
        range: r(cfg.range, 10000),
        frictionHalfLife: r(cfg.frictionHalfLife, 10000),
        forceScale: r(cfg.forceScale, 10000),
        beta: r(cfg.beta),
        timeScale: r(cfg.timeScale, 100),
        pointSize: r(cfg.pointSize, 10),
        trails: r(cfg.trails, 100),
    };
}

export async function encodeConfig(cfg: WorldConfig): Promise<string> {
    const json = new TextEncoder().encode(JSON.stringify(compactConfig(cfg)));
    return toBase64Url(await pipeBytes(json, new CompressionStream('deflate-raw')));
}

export async function decodeConfig(str: string): Promise<WorldConfig> {
    const bytes = await pipeBytes(fromBase64Url(str), new DecompressionStream('deflate-raw'));
    return normalizeConfig(JSON.parse(new TextDecoder().decode(bytes)));
}

/** Small stable hash, used to remember which scripts the user has trusted. */
export function hashString(str: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36) + ':' + str.length;
}
