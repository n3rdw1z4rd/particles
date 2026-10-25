import type { Simulation } from '../core/simulation';
import type { Species } from '../core/world';

export interface ViewOptions {
    species: Species[];
    pointSize: number;
    trails: number;
    showBounds: boolean;
}

export interface SimRenderer {
    readonly canvas: HTMLCanvasElement;
    /** Starts the render loop; `frame` receives real elapsed seconds. */
    start(frame: (dt: number) => void): void;
    render(sim: Simulation, view: ViewOptions): void;
    dispose(): void;
    /** Starts or ends an immersive VR session (3D only). */
    enterVR?(): Promise<void>;
}

export function hexToRgb(hex: string): [number, number, number] {
    const v = parseInt(hex.slice(1), 16);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
