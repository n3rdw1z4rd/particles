import { computed, Signal } from '@n3rdw1z4rd/smoke-ui';
import { compileScript, describeError, ScriptHooks } from '../core/script';
import { Simulation } from '../core/simulation';
import {
    DEFAULT_SPECIES, DIM_DEFAULTS, MAX_SPECIES, Species, WorldConfig,
    decodeConfig, defaultConfig, encodeConfig, hashString, normalizeConfig, randomSeed, spawn,
} from '../core/world';
import { Renderer2d } from '../render/renderer-2d';
import type { SimRenderer, ViewOptions } from '../render/types';
import { Rng } from '@n3rdw1z4rd/core';
import { toast } from '../ui/toast';

/* ------------------------------------------------------------------ */
/* Reactive state — every control in the UI binds straight to these.   */
/* ------------------------------------------------------------------ */

export const dims = new Signal<2 | 3>(2);
export const seed = new Signal(0);
export const count = new Signal(2000);
export const species = new Signal<Species[]>([]);
export const range = new Signal(0.1);
export const frictionHalfLife = new Signal(0.04);
export const forceScale = new Signal(0.1);
export const beta = new Signal(0.3);
export const timeScale = new Signal(1);
export const pointSize = new Signal(2);
export const trails = new Signal(0);
export const showBounds = new Signal(true);
export const paused = new Signal(false);

export const fps = new Signal(0);

/** True when this browser can enter immersive VR. */
export const vrAvailable = new Signal(false);
/** The VR entry point lives on the 3D renderer, so it's only offered in 3D. */
export const vrReady = computed(() => vrAvailable.get() && dims.get() === 3);

navigator.xr?.isSessionSupported('immersive-vr')
    .then((ok) => vrAvailable.set(ok))
    .catch(() => { /* no XR */ });
export const simTime = new Signal('0.0');

export type ScriptState =
    | { kind: 'off' }
    | { kind: 'running' }
    | { kind: 'pending'; message: string } // from a shared link, not yet trusted
    | { kind: 'error'; message: string };

/** Source currently in the editor (may differ from what's running). */
export const scriptSource = new Signal('');
/** Source that is actually running. */
export const runningScript = new Signal('');
export const scriptState = new Signal<ScriptState>({ kind: 'off' });
export const editorOpen = new Signal(false);

/* ------------------------------------------------------------------ */
/* Engine instances                                                     */
/* ------------------------------------------------------------------ */

let root: HTMLElement;
let renderer: SimRenderer | null = null;
let mountToken = 0;
let hooks: ScriptHooks | null = null;
let stepOnce = false;
const frameListeners = new Set<() => void>();

export let sim: Simulation;

/** Called once per rendered frame (used by the matrix editor to stay in sync). */
export function onFrame(fn: () => void): () => void {
    frameListeners.add(fn);
    return () => frameListeners.delete(fn);
}

/* ------------------------------------------------------------------ */
/* Config <-> signals                                                   */
/* ------------------------------------------------------------------ */

export function snapshot(): WorldConfig {
    return {
        v: 1,
        dims: dims.get(),
        seed: seed.get(),
        count: count.get(),
        species: species.get().map((s) => ({ ...s })),
        matrix: sim.getMatrix(),
        range: range.get(),
        frictionHalfLife: frictionHalfLife.get(),
        forceScale: forceScale.get(),
        beta: beta.get(),
        timeScale: timeScale.get(),
        pointSize: pointSize.get(),
        trails: trails.get(),
        script: runningScript.get() || scriptSource.get(),
    };
}

let applying = false;

function applyConfig(cfg: WorldConfig): void {
    applying = true;
    try {
        const dimsChanged = !sim || sim.dims !== cfg.dims;
        sim = new Simulation(cfg);

        dims.set(cfg.dims);
        seed.set(cfg.seed);
        count.set(cfg.count);
        species.set(cfg.species);
        range.set(cfg.range);
        frictionHalfLife.set(cfg.frictionHalfLife);
        forceScale.set(cfg.forceScale);
        beta.set(cfg.beta);
        timeScale.set(cfg.timeScale);
        pointSize.set(cfg.pointSize);
        trails.set(cfg.trails);

        if (dimsChanged || !renderer) void mountRenderer();
    } finally {
        applying = false;
    }
}

/* ------------------------------------------------------------------ */
/* Renderer + main loop                                                 */
/* ------------------------------------------------------------------ */

async function mountRenderer(): Promise<void> {
    const token = ++mountToken;
    renderer?.dispose();
    renderer = null;

    let next: SimRenderer;
    if (dims.get() === 3) {
        // Three.js is only downloaded when someone actually switches to 3D.
        const { Renderer3d } = await import('../render/renderer-3d');
        if (token !== mountToken) return; // superseded by a newer switch
        next = new Renderer3d(root);
    } else {
        next = new Renderer2d(root, () => sim);
    }

    renderer = next;
    next.start(frame);
}

let fpsFrames = 0;
let fpsTime = 0;

function frame(dt: number): void {
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
        fps.set(Math.round(fpsFrames / fpsTime));
        simTime.set(sim.time.toFixed(1));
        fpsFrames = 0;
        fpsTime = 0;
    }

    if (!paused.get() || stepOnce) {
        const stepDt = stepOnce ? 1 / 60 : dt;
        stepOnce = false;

        try {
            hooks?.step?.(sim, stepDt);
            sim.step(stepDt);
        } catch (err) {
            stopScript({ kind: 'error', message: `Runtime error — script stopped.\n${describeError(err)}` });
        }

        if (sim.repairNonFinite() > 0 && hooks) {
            stopScript({ kind: 'error', message: 'Script produced NaN/Infinity positions — script stopped and particles repaired.' });
        }
    }

    const view: ViewOptions = {
        species: species.get(),
        pointSize: pointSize.get(),
        trails: trails.get(),
        showBounds: showBounds.get(),
    };

    renderer?.render(sim, view);
    frameListeners.forEach((fn) => fn());
}

/* ------------------------------------------------------------------ */
/* Actions                                                              */
/* ------------------------------------------------------------------ */

export function togglePause(): void {
    paused.set(!paused.get());
}

export function step(): void {
    paused.set(true);
    stepOnce = true;
}

/** Respawns particles from the current seed, keeping the matrix and params. */
export function resetWorld(): void {
    sim.respawn({ seed: seed.get(), dims: dims.get(), count: count.get(), species: species.get() });
    runSetup();
}

export async function resetAll() {
    const cfg = defaultConfig();
    await loadConfig(cfg);
    markDirty();
}

/** Loads the world for `newSeed`: fresh particles and a fresh seeded matrix. */
export function loadSeed(newSeed: number): void {
    seed.set(newSeed | 0);
    const s = spawn({ seed: seed.get(), dims: dims.get(), count: count.get(), species: species.get() });
    sim.setMatrix(s.matrix);
    resetWorld();
    markDirty();
}

export function newWorld(): void {
    loadSeed(randomSeed());
}

export function setDims(d: 2 | 3): void {
    if (d === dims.get()) return;
    const defaults = DIM_DEFAULTS[d];

    sim.setDims(d);
    dims.set(d);
    range.set(defaults.range);
    pointSize.set(defaults.pointSize);
    count.set(defaults.count);
    void mountRenderer();
    markDirty();
}

export function setSpeciesCount(k: number): void {
    k = Math.max(1, Math.min(MAX_SPECIES, k));
    const current = species.get();
    if (k === current.length) return;

    const used = new Set(current.map((s) => s.color.toLowerCase()));
    const next = current.slice(0, k);
    for (const s of DEFAULT_SPECIES) {
        if (next.length >= k) break;
        if (!used.has(s.color)) next.push({ ...s });
    }

    sim.setSpeciesCount(k);
    species.set(next);
    markDirty();
}

export function setSpeciesColor(index: number, color: string): void {
    const next = species.get().map((s, i) => (i === index ? { ...s, color } : s));
    species.set(next);
    markDirty();
}

export type MatrixPreset = 'random' | 'symmetric' | 'zero' | 'invert' | 'snakes';

export function applyMatrixPreset(preset: MatrixPreset): void {
    const k = sim.k;
    const rng = new Rng();
    const m = sim.getMatrix();

    for (let a = 0; a < k; a++) {
        for (let b = 0; b < k; b++) {
            switch (preset) {
                case 'random': m[a][b] = rng.nextFloat() * 2 - 1; break;
                case 'zero': m[a][b] = 0; break;
                case 'invert': m[a][b] = -m[a][b]; break;
                case 'symmetric': if (b > a) m[a][b] = m[b][a] = (m[a][b] + m[b][a]) / 2; break;
                case 'snakes': m[a][b] = a === b ? 1 : b === (a + 1) % k ? 0.2 : -0.1; break;
            }
        }
    }

    sim.setMatrix(m);
    markDirty();
}

/* ------------------------------------------------------------------ */
/* Scripting                                                            */
/* ------------------------------------------------------------------ */

const TRUSTED_KEY = 'particles.trustedScripts';

function trustedSet(): Set<string> {
    try {
        return new Set(JSON.parse(localStorage.getItem(TRUSTED_KEY) || '[]'));
    } catch {
        return new Set();
    }
}

function trust(source: string): void {
    try {
        const set = trustedSet();
        set.add(hashString(source));
        localStorage.setItem(TRUSTED_KEY, JSON.stringify([...set].slice(-50)));
    } catch { /* storage unavailable — fine */ }
}

function runSetup(): void {
    if (!hooks?.setup) return;
    try {
        hooks.setup(sim);
    } catch (err) {
        stopScript({ kind: 'error', message: `setup() threw — script stopped.\n${describeError(err)}` });
    }
}

export async function runScript(source = scriptSource.get()): Promise<boolean> {
    scriptSource.set(source);

    if (!source.trim()) {
        stopScript();
        return true;
    }

    try {
        const compiled = await compileScript(source);
        hooks = compiled;
        sim.force = compiled.force ?? null;
        runningScript.set(source);
        scriptState.set({ kind: 'running' });
        trust(source);
        runSetup();
        markDirty();
        return scriptState.get().kind === 'running';
    } catch (err) {
        stopScript({ kind: 'error', message: describeError(err) });
        return false;
    }
}

export function stopScript(state: ScriptState = { kind: 'off' }): void {
    hooks = null;
    if (sim) sim.force = null;
    runningScript.set('');
    scriptState.set(state);
    markDirty();
}

/* ------------------------------------------------------------------ */
/* Sharing                                                              */
/* ------------------------------------------------------------------ */

let dirtyTimer = 0;

/** Debounced write of the current world into the URL, so reload/back keep it. */
export function markDirty(): void {
    if (applying || !sim) return;
    clearTimeout(dirtyTimer);
    dirtyTimer = window.setTimeout(async () => {
        const url = new URL(location.href);
        url.search = '';
        url.searchParams.set('w', await encodeConfig(snapshot()));
        history.replaceState(null, '', url);
    }, 500);
}

export async function shareLink(): Promise<void> {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('w', await encodeConfig(snapshot()));
    history.replaceState(null, '', url);

    try {
        await navigator.clipboard.writeText(url.href);
        toast('Link copied to clipboard');
    } catch {
        toast('Link is in the address bar');
    }
}

/** Starts (or ends) an immersive VR session; must be called from a user gesture. */
export function enterVR(): void {
    renderer?.enterVR?.().catch((err) => toast(`Couldn't start VR: ${describeError(err)}`, true));
}

export function pickAndImportJson(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
        const file = input.files?.[0];
        if (file) void importJson(file);
    };
    input.click();
}

export function exportJson(): void {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `particles-${seed.get()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importJson(file: File): Promise<void> {
    try {
        const cfg = normalizeConfig(JSON.parse(await file.text()));
        await loadConfig(cfg, { fromUntrusted: true });
        markDirty();
        toast(`Loaded ${file.name}`);
    } catch (err) {
        toast(`Couldn't load ${file.name}: ${describeError(err)}`, true);
    }
}

/**
 * Loads a full world. Scripts from an untrusted source (a shared link or an
 * imported file) never auto-run unless the user has run that exact script
 * before — they're parked as "pending" until the user chooses to run them.
 */
export async function loadConfig(cfg: WorldConfig, opts: { fromUntrusted?: boolean } = {}): Promise<void> {
    stopScript();
    applyConfig(cfg);
    scriptSource.set(cfg.script);

    if (!cfg.script) return;

    if (!opts.fromUntrusted || trustedSet().has(hashString(cfg.script))) {
        await runScript(cfg.script);
    } else {
        scriptState.set({ kind: 'pending', message: 'This world includes a script. Review it before running.' });
    }
}

/** Reads `?w=` (full world) or the legacy `?seed=` / `?t=` params. */
export async function configFromUrl(): Promise<WorldConfig> {
    const params = new URLSearchParams(location.search);
    const w = params.get('w');

    if (w) {
        try {
            return await decodeConfig(w);
        } catch (err) {
            console.warn('Bad ?w= param, starting a new world', err);
        }
    }

    const d: 2 | 3 = params.get('t') === '3d' ? 3 : 2;
    const legacySeed = params.get('seed');
    return defaultConfig(d, legacySeed !== null && Number.isFinite(parseInt(legacySeed)) ? parseInt(legacySeed) | 0 : randomSeed());
}

/* ------------------------------------------------------------------ */
/* Boot                                                                 */
/* ------------------------------------------------------------------ */

export async function boot(container: HTMLElement): Promise<void> {
    root = container;
    const cfg = await configFromUrl();
    await loadConfig(cfg, { fromUntrusted: true });

    // Live parameters flow straight into the running simulation.
    const live: [Signal<number>, keyof Simulation['params']][] = [
        [range, 'range'], [frictionHalfLife, 'frictionHalfLife'], [forceScale, 'forceScale'],
        [beta, 'beta'], [timeScale, 'timeScale'],
    ];
    for (const [signal, key] of live) {
        signal.subscribe((v) => {
            sim.params[key] = v;
            markDirty();
        });
    }

    count.subscribe((n) => {
        sim.setCount(n);
        markDirty();
    });
    pointSize.subscribe(() => markDirty());
    trails.subscribe(() => markDirty());
}
