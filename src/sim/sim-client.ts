import { WorkerInterface } from '@n3rdw1z4rd/core';
import type { SimParams, SimPointer } from '../core/simulation';
import type { WorldConfig } from '../core/world';
import type { FrameMessage, FromWorker, SpawnConfig, ToWorker } from './protocol';
import workerUrl from './sim.worker.ts?worker&url';

/** What renderers and the matrix editor read: always one consistent frame. */
export interface SimView {
    readonly dims: 2 | 3;
    readonly count: number;
    readonly k: number;
    readonly pos: Float32Array;
    readonly type: Uint8Array;
}

/** A step taking longer than this means the worker is stuck (e.g. a script looping forever). */
export const HANG_MS = 3000;

/** Don't step more often than this when the simulation is fast (saves battery; ~60/s). */
const MIN_STEP_MS = 15;

/**
 * Main-thread stand-in for the Simulation running in `sim.worker.ts`.
 *
 * It mirrors the parts of the Simulation API the UI uses (`get`/`set`, `k`,
 * `matrixVersion`, `pos`, `type`, `pointer`, …), so the rest of the app talks
 * to it as if the simulation were local. Commands are posted in order; the
 * latest frame from the worker is what everything renders.
 *
 * One step is in flight at a time. While running, the next step is sent as
 * soon as the previous frame arrives (no waiting for the next animation frame,
 * capped at ~60 steps/s); `tick()` from the render loop starts things when
 * idle. The renderer always draws the latest frame. Frame buffers are
 * transferred both ways (no copies, no SharedArrayBuffer headers).
 */
export class SimClient extends WorkerInterface<FromWorker, ToWorker> implements SimView {
    dims: 2 | 3 = 2;
    count = 0;
    k = 0;
    pos: Float32Array = new Float32Array(0);
    type: Uint8Array = new Uint8Array(0);
    time = 0;
    frame = 0;

    /** Row-major k×k mirror of the worker's matrix. */
    matrix: Float32Array = new Float32Array(0);
    /** Bumped on every local or remote matrix change (editors redraw on change). */
    matrixVersion = 0;

    /** Written by the 2D renderer; sent along with every step. */
    pointer: SimPointer = { x: 0, y: 0, down: false, active: false };

    /** Simulation steps completed per second (measured over ~0.5 s). */
    stepsPerSecond = 0;
    /** Average milliseconds the worker spends per step. */
    stepMs = 0;

    private _rateSteps = 0;
    private _rateMs = 0;
    private _rateStart = performance.now();

    /** Called when the worker stopped a failing script. */
    onScriptError: (message: string) => void = () => {};

    private _busySince = 0; // a step is in flight since…
    private _scriptSince = 0; // a script compile/setup is in flight since…
    private _run = false;
    private _lastStepAt = 0;
    private _queuedDt: number | undefined;
    private _spare: ArrayBuffer | undefined;
    private _scriptId = 0;
    private _scriptWaiters = new Map<number, (r: { ok: boolean; error?: string }) => void>();
    private _remoteMatrixVersion = -1;

    constructor() {
        super(workerUrl);
        this.onMessage.subscribe((ev) => this._receive(ev.data));
    }

    private _send(msg: ToWorker, transfer: Transferable[] = []): void {
        this.postMessage(msg, { transfer });
    }

    /* ---------------------------------------------------------------- */
    /* Frames                                                             */
    /* ---------------------------------------------------------------- */

    /**
     * Call once per rendered frame. `run` = keep advancing in real time;
     * `fixedDt` = advance exactly this much once (single-step while paused).
     */
    tick(run: boolean, fixedDt?: number): void {
        this._run = run;
        if (fixedDt !== undefined) this._queuedDt = fixedDt;
        if (!this._busySince) this._sendStep();
    }

    private _sendStep(): void {
        const now = performance.now();
        const fixed = this._queuedDt;
        this._queuedDt = undefined;
        const run = this._run || fixed !== undefined;
        // Real elapsed time since the last step (the worker clamps big gaps).
        const dt = fixed ?? (this._run && this._lastStepAt ? (now - this._lastStepAt) / 1000 : 0);
        this._lastStepAt = now;

        const buffer = this._spare;
        this._spare = undefined;
        this._busySince = now;
        this._send({ t: 'step', dt, run, pointer: { ...this.pointer }, buffer }, buffer ? [buffer] : []);
    }

    /** True when the worker hasn't answered for longer than HANG_MS. */
    get hung(): boolean {
        const now = performance.now();
        return (this._busySince > 0 && now - this._busySince > HANG_MS)
            || (this._scriptSince > 0 && now - this._scriptSince > HANG_MS);
    }

    private _receive(msg: FromWorker): void {
        if (msg.t === 'script') {
            this._scriptWaiters.get(msg.id)?.({ ok: msg.ok, error: msg.error });
            this._scriptWaiters.delete(msg.id);
            this._scriptSince = this._scriptWaiters.size ? performance.now() : 0;
            return;
        }
        this._applyFrame(msg);
    }

    private _applyFrame(f: FrameMessage): void {
        this._busySince = 0;
        this._spare = this.pos.buffer.byteLength ? this.pos.buffer as ArrayBuffer : undefined;

        this.dims = f.dims;
        this.count = f.count;
        this.k = f.k;
        this.pos = f.pos;
        this.type = f.type;
        this.time = f.time;
        this.frame = f.frame;

        if (f.matrix && f.matrixVersion !== this._remoteMatrixVersion) {
            this.matrix = f.matrix;
            this.matrixVersion++;
        }
        this._remoteMatrixVersion = f.matrixVersion;

        // Simulation rate: only frames that actually stepped count.
        if (f.stepMs > 0) {
            this._rateSteps++;
            this._rateMs += f.stepMs;
        }
        const now = performance.now();
        if (now - this._rateStart >= 500) {
            this.stepsPerSecond = Math.round((this._rateSteps * 1000) / (now - this._rateStart));
            this.stepMs = this._rateSteps ? this._rateMs / this._rateSteps : 0;
            this._rateSteps = 0;
            this._rateMs = 0;
            this._rateStart = now;
        }

        if (f.scriptError) this.onScriptError(f.scriptError);

        // Keep the worker busy while running, but no faster than ~60 steps/s.
        if (this._run && now - this._lastStepAt >= MIN_STEP_MS) this._sendStep();
    }

    /* ---------------------------------------------------------------- */
    /* Matrix (mirrored locally so editing feels instant)                 */
    /* ---------------------------------------------------------------- */

    get(a: number, b: number): number {
        return this.matrix[a * this.k + b] ?? 0;
    }

    set(a: number, b: number, value: number): void {
        const v = Math.max(-1, Math.min(1, value));
        if (!Number.isFinite(v) || this.get(a, b) === v) return;
        this.matrix[a * this.k + b] = v;
        this.matrixVersion++;
        this._send({ t: 'set', a, b, v });
    }

    setMatrix(m: number[][]): void {
        const k = this.k;
        for (let a = 0; a < k; a++) {
            for (let b = 0; b < k; b++) this.matrix[a * k + b] = Math.max(-1, Math.min(1, m[a]?.[b] ?? 0));
        }
        this.matrixVersion++;
        this._send({ t: 'setMatrix', matrix: m });
    }

    getMatrix(): number[][] {
        return Array.from({ length: this.k }, (_, a) => Array.from({ length: this.k }, (_, b) => this.get(a, b)));
    }

    /* ---------------------------------------------------------------- */
    /* Commands                                                           */
    /* ---------------------------------------------------------------- */

    load(cfg: WorldConfig): void {
        this.dims = cfg.dims;
        this.k = cfg.species.length;
        this.matrix = Float32Array.from(cfg.matrix.flat());
        this.matrixVersion++;
        this._send({ t: 'load', cfg });
    }

    /** Re-creates a world from `cfg` with particles where they were in the last frame. */
    restore(cfg: WorldConfig, from: SimView & { time: number }): void {
        this.load(cfg);
        const pos = from.pos.slice(0, from.count * 3);
        const type = from.type.slice(0, from.count);
        this._send({ t: 'restore', cfg, pos, type, time: from.time }, [pos.buffer, type.buffer]);
    }

    setParams(params: Partial<SimParams>): void { this._send({ t: 'params', params }); }
    respawn(cfg: SpawnConfig): void { this._send({ t: 'respawn', cfg }); }
    setCount(n: number): void { this._send({ t: 'count', n }); }
    setSpeciesCount(k: number): void { this._send({ t: 'species', k }); }
    setDims(dims: 2 | 3): void { this._send({ t: 'dims', dims }); }
    stopScript(): void { this._send({ t: 'stopScript' }); }

    /** Compiles and starts a script in the worker; resolves when it's running (or failed). */
    runScript(source: string): Promise<{ ok: boolean; error?: string }> {
        const id = ++this._scriptId;
        return new Promise((resolve) => {
            this._scriptWaiters.set(id, resolve);
            if (!this._scriptSince) this._scriptSince = performance.now(); // a hanging setup() counts too
            this._send({ t: 'script', id, source });
        });
    }

    /** Stops the worker; pending script promises resolve as failed. */
    dispose(reason = 'stopped'): void {
        this.terminate();
        this._scriptWaiters.forEach((resolve) => resolve({ ok: false, error: reason }));
        this._scriptWaiters.clear();
    }
}
