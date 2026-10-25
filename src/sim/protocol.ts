import type { SimParams, SimPointer } from '../core/simulation';
import type { WorldConfig } from '../core/world';

/* Messages between the main thread (SimClient) and the simulation worker. */

export type SpawnConfig = Pick<WorldConfig, 'seed' | 'dims' | 'count' | 'species'>;

export type ToWorker =
    | { t: 'load'; cfg: WorldConfig }
    /** Rebuilds a world after a restart, keeping particles where they were. */
    | { t: 'restore'; cfg: WorldConfig; pos: Float32Array; type: Uint8Array; time: number }
    /** Advance (if `run`) and send a frame back. `buffer` is a spent frame buffer to reuse. */
    | { t: 'step'; dt: number; run: boolean; pointer: SimPointer; buffer?: ArrayBuffer }
    | { t: 'set'; a: number; b: number; v: number }
    | { t: 'setMatrix'; matrix: number[][] }
    | { t: 'params'; params: Partial<SimParams> }
    | { t: 'respawn'; cfg: SpawnConfig }
    | { t: 'count'; n: number }
    | { t: 'species'; k: number }
    | { t: 'dims'; dims: 2 | 3 }
    | { t: 'script'; id: number; source: string }
    | { t: 'stopScript' };

export interface FrameMessage {
    t: 'frame';
    dims: 2 | 3;
    count: number;
    k: number;
    /** xyz per particle, z = 0 in 2D. */
    pos: Float32Array;
    type: Uint8Array;
    time: number;
    frame: number;
    /** Only present when the matrix changed since the last frame. */
    matrix?: Float32Array;
    matrixVersion: number;
    /** Milliseconds the worker spent on this step (script + physics); 0 when it didn't step. */
    stepMs: number;
    /** A running script failed and was stopped by the worker. */
    scriptError?: string;
}

export type FromWorker =
    | FrameMessage
    | { t: 'script'; id: number; ok: boolean; error?: string };
