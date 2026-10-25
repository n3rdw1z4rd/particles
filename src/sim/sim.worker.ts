/// <reference lib="webworker" />
import { compileScript, describeError, ScriptHooks } from '../core/script';
import { Simulation } from '../core/simulation';
import type { FromWorker, ToWorker } from './protocol';

/*
 * The simulation and user scripts live here, off the main thread. A script
 * that loops forever only blocks this worker; the main thread notices the
 * missing frames and replaces the worker (see SimClient / store).
 */

let sim: Simulation | null = null;
let hooks: ScriptHooks | null = null;
let sentMatrixVersion = -1;
let scriptError: string | undefined;

const post = (msg: FromWorker, transfer: Transferable[] = []) => (self as DedicatedWorkerGlobalScope).postMessage(msg, transfer);

function stopScript(error?: string): void {
    hooks = null;
    if (sim) sim.force = null;
    if (error) scriptError = error;
}

function runSetup(): void {
    if (!hooks?.setup || !sim) return;
    try {
        hooks.setup(sim);
    } catch (err) {
        stopScript(`setup() threw — script stopped.\n${describeError(err)}`);
    }
}

function sendFrame(buffer: ArrayBuffer | undefined, stepMs: number): void {
    if (!sim) return;
    const n = sim.count * 3;
    const pos = buffer && buffer.byteLength === n * 4 ? new Float32Array(buffer) : new Float32Array(n);
    pos.set(sim.pos.subarray(0, n));
    const type = sim.type.slice(0, sim.count);

    const matrixChanged = sim.matrixVersion !== sentMatrixVersion;
    const matrix = matrixChanged ? sim.matrix.slice() : undefined;
    sentMatrixVersion = sim.matrixVersion;

    const transfer: Transferable[] = [pos.buffer, type.buffer];
    if (matrix) transfer.push(matrix.buffer);

    post({
        t: 'frame',
        dims: sim.dims,
        count: sim.count,
        k: sim.k,
        pos,
        type,
        time: sim.time,
        frame: sim.frame,
        matrix,
        matrixVersion: sim.matrixVersion,
        stepMs,
        scriptError,
    }, transfer);

    scriptError = undefined;
}

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
    const msg = ev.data;

    switch (msg.t) {
        case 'load':
            hooks = null;
            sim = new Simulation(msg.cfg);
            sentMatrixVersion = -1;
            break;

        case 'restore': {
            hooks = null;
            sim = new Simulation({ ...msg.cfg, count: msg.type.length });
            const n = msg.type.length;
            for (let i = 0; i < n * 3; i++) sim.pos[i] = msg.pos[i];
            sim.type.set(msg.type);
            sim.time = msg.time;
            sentMatrixVersion = -1;
            break;
        }

        case 'step': {
            if (!sim) return;
            let stepMs = 0;
            if (msg.run) {
                const t0 = performance.now();
                Object.assign(sim.pointer, msg.pointer);
                try {
                    hooks?.step?.(sim, msg.dt);
                    sim.step(msg.dt);
                } catch (err) {
                    stopScript(`Runtime error — script stopped.\n${describeError(err)}`);
                }
                if (sim.repairNonFinite() > 0 && hooks) {
                    stopScript('Script produced NaN/Infinity positions — script stopped and particles repaired.');
                }
                stepMs = performance.now() - t0;
            }
            sendFrame(msg.buffer, stepMs);
            break;
        }

        case 'set': sim?.set(msg.a, msg.b, msg.v); break;
        case 'setMatrix': sim?.setMatrix(msg.matrix); break;
        case 'params': if (sim) Object.assign(sim.params, msg.params); break;
        case 'count': sim?.setCount(msg.n); break;
        case 'species': sim?.setSpeciesCount(msg.k); break;
        case 'dims': sim?.setDims(msg.dims); break;

        case 'respawn':
            sim?.respawn(msg.cfg);
            runSetup();
            break;

        case 'script': {
            try {
                const compiled = await compileScript(msg.source);
                hooks = compiled;
                if (sim) sim.force = compiled.force ?? null;
                runSetup();
                const ok = hooks !== null;
                post({ t: 'script', id: msg.id, ok, error: ok ? undefined : scriptError });
                if (!ok) scriptError = undefined;
            } catch (err) {
                stopScript();
                post({ t: 'script', id: msg.id, ok: false, error: describeError(err) });
            }
            break;
        }

        case 'stopScript': stopScript(); break;
    }
};
