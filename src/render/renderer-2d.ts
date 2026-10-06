import type { Simulation } from '../core/simulation';
import type { SimRenderer, ViewOptions } from './types';

const BACKGROUND = '17, 17, 17'; // matches --color-background (#111)

export class Renderer2d implements SimRenderer {
    readonly canvas = document.createElement('canvas');
    private _ctx: CanvasRenderingContext2D;
    private _raf = 0;
    private _last = 0;
    private _cleanup: (() => void)[] = [];

    constructor(parent: HTMLElement, getSim: () => Simulation) {
        this.canvas.className = 'sim-canvas';
        parent.prepend(this.canvas);
        this._ctx = this.canvas.getContext('2d', { alpha: false })!;

        // Pointer → world-space coordinates for scripts.
        const toWorld = (ev: PointerEvent) => {
            const rect = this.canvas.getBoundingClientRect();
            const p = getSim().pointer;
            p.x = (ev.clientX - rect.left) / rect.width;
            p.y = (ev.clientY - rect.top) / rect.height;
            p.active = true;
        };
        const down = (ev: PointerEvent) => {
            toWorld(ev);
            getSim().pointer.down = true;
            this.canvas.setPointerCapture(ev.pointerId);
        };
        const up = () => { getSim().pointer.down = false; };
        const leave = () => { getSim().pointer.active = false; };

        this.canvas.addEventListener('pointermove', toWorld);
        this.canvas.addEventListener('pointerdown', down);
        this.canvas.addEventListener('pointerup', up);
        this.canvas.addEventListener('pointercancel', up);
        this.canvas.addEventListener('pointerleave', leave);
        this._cleanup.push(() => getSim().pointer.down = getSim().pointer.active = false);
    }

    start(frame: (dt: number) => void): void {
        const loop = (t: number) => {
            const dt = this._last ? (t - this._last) / 1000 : 0;
            this._last = t;
            frame(dt);
            this._raf = requestAnimationFrame(loop);
        };
        this._raf = requestAnimationFrame(loop);
    }

    private _resize(): void {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = this.canvas.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width * dpr));
        const h = Math.max(1, Math.round(rect.height * dpr));
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
            this._ctx.fillStyle = `rgb(${BACKGROUND})`;
            this._ctx.fillRect(0, 0, w, h);
        }
    }

    render(sim: Simulation, view: ViewOptions): void {
        this._resize();

        const ctx = this._ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const size = Math.max(1, view.pointSize * dpr);
        const half = size / 2;

        ctx.fillStyle = view.trails > 0 ? `rgba(${BACKGROUND}, ${1 - view.trails})` : `rgb(${BACKGROUND})`;
        ctx.fillRect(0, 0, w, h);

        const pos = sim.pos;
        const type = sim.type;

        // One fill per species instead of a fillStyle change per particle.
        for (let s = 0; s < sim.k; s++) {
            ctx.fillStyle = view.species[s]?.color ?? '#ffffff';
            ctx.beginPath();
            for (let i = 0; i < sim.count; i++) {
                if (type[i] !== s) continue;
                ctx.rect(pos[i * 3] * w - half, pos[i * 3 + 1] * h - half, size, size);
            }
            ctx.fill();
        }
    }

    dispose(): void {
        cancelAnimationFrame(this._raf);
        this._cleanup.forEach((fn) => fn());
        this.canvas.remove();
    }
}
