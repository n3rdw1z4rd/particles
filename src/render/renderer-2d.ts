import {
    BindRenderTarget, CreateBuffer, CreateProgramInfo, CreateRenderTarget, CreateVertexArray, CreateWebGlContext,
    DeleteProgramInfo, DeleteRenderTarget, DeleteVertexArray, Draw, ProgramInfo, RenderTarget, ResizeWebGlContext,
    UpdateBuffer, VertexArrayInfo,
} from '@n3rdw1z4rd/core';
import type { SimPointer } from '../core/simulation';
import { MAX_SPECIES } from '../core/world';
import type { SimView } from '../sim/sim-client';
import { hexToRgb, SimRenderer, ViewOptions } from './types';

const BACKGROUND: [number, number, number] = [17 / 255, 17 / 255, 17 / 255]; // matches --color-background (#111)

/* One point per particle; xy come straight from the worker's frame (xyz floats). */
const POINTS_VS = /* glsl */ `#version 300 es
in vec3 a_pos;
in uint a_type;
uniform vec3 u_palette[${MAX_SPECIES}];
uniform float u_size;
out vec3 v_color;

void main() {
    gl_Position = vec4(a_pos.x * 2.0 - 1.0, 1.0 - a_pos.y * 2.0, 0.0, 1.0);
    gl_PointSize = u_size;
    v_color = u_palette[min(a_type, ${MAX_SPECIES - 1}u)];
}`;

const POINTS_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec3 v_color;
out vec4 color;

void main() {
    color = vec4(v_color, 1.0);
}`;

/* Full-screen triangle from gl_VertexID (no buffers): used to fade trails and to blit. */
const FULLSCREEN_VS = /* glsl */ `#version 300 es
out vec2 v_uv;

void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    v_uv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FADE_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 color;

void main() {
    color = u_color;
}`;

const BLIT_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
in vec2 v_uv;
out vec4 color;

void main() {
    color = texture(u_texture, v_uv);
}`;

/**
 * WebGL2 renderer for the 2D world, built on @n3rdw1z4rd/core's webgl wrappers.
 *
 * Without trails, points are drawn straight to the canvas. With trails, they
 * accumulate in an offscreen render target that is faded towards the
 * background each frame and then copied to the screen.
 */
export class Renderer2d implements SimRenderer {
    readonly canvas = document.createElement('canvas');
    private _gl!: WebGL2RenderingContext;
    private _points!: ProgramInfo;
    private _fade!: ProgramInfo;
    private _blit!: ProgramInfo;
    private _empty!: VertexArrayInfo; // attribute-less VAO for the full-screen passes
    private _vao: VertexArrayInfo | null = null;
    private _posBuffer: WebGLBuffer | null = null;
    private _typeBuffer: WebGLBuffer | null = null;
    private _capacity = 0;
    private _trailTarget: RenderTarget | null = null;
    private _trailsWereOn = false;
    private _palette = new Float32Array(MAX_SPECIES * 3);
    private _lost = false;

    private _raf = 0;
    private _last = 0;
    private _cleanup: (() => void)[] = [];

    constructor(parent: HTMLElement, getSim: () => SimView & { pointer: SimPointer }) {
        this.canvas.className = 'sim-canvas';
        parent.prepend(this.canvas);
        this._init();

        // The GPU can drop the context (backgrounded tab on mobile, driver reset); rebuild when it comes back.
        const lost = (ev: Event) => { ev.preventDefault(); this._lost = true; };
        const restored = () => { this._lost = false; this._init(); };
        this.canvas.addEventListener('webglcontextlost', lost);
        this.canvas.addEventListener('webglcontextrestored', restored);

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

    private _init(): void {
        const gl = this._gl = CreateWebGlContext(this.canvas, { alpha: false, antialias: false, depth: false });
        this._points = CreateProgramInfo(gl, POINTS_VS, POINTS_FS);
        this._fade = CreateProgramInfo(gl, FULLSCREEN_VS, FADE_FS);
        this._blit = CreateProgramInfo(gl, FULLSCREEN_VS, BLIT_FS);
        this._empty = CreateVertexArray(gl, this._fade, {});
        this._vao = null;
        this._capacity = 0;
        this._trailTarget = null;
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

    /** (Re)creates the particle buffers when the particle count changes. */
    private _ensureCapacity(count: number): void {
        if (count === this._capacity && this._vao) return;
        const gl = this._gl;

        if (this._vao) DeleteVertexArray(gl, this._vao, { buffers: true });

        const n = Math.max(1, count);
        this._posBuffer = CreateBuffer(gl, n * 3 * 4, { usage: gl.DYNAMIC_DRAW });
        this._typeBuffer = CreateBuffer(gl, n, { usage: gl.DYNAMIC_DRAW });
        this._vao = CreateVertexArray(gl, this._points, {
            a_pos: { buffer: this._posBuffer, size: 3 },
            a_type: { buffer: this._typeBuffer, size: 1, type: gl.UNSIGNED_BYTE },
        });
        this._capacity = count;
    }

    /** Matches the drawing buffer to the canvas size; returns true if it changed. */
    private _resize(): boolean {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const resized = ResizeWebGlContext(this._gl, undefined, undefined, dpr);
        const gl = this._gl;

        if (resized && this._trailTarget) {
            DeleteRenderTarget(gl, this._trailTarget);
            this._trailTarget = null;
        }
        return resized;
    }

    private _ensureTrailTarget(): RenderTarget {
        const gl = this._gl;
        if (!this._trailTarget) {
            this._trailTarget = CreateRenderTarget(gl, gl.drawingBufferWidth, gl.drawingBufferHeight, { depth: false, filter: 'nearest' });
            BindRenderTarget(gl, this._trailTarget);
            gl.clearColor(BACKGROUND[0], BACKGROUND[1], BACKGROUND[2], 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
        return this._trailTarget;
    }

    render(sim: SimView, view: ViewOptions): void {
        if (this._lost) return;
        const gl = this._gl;
        this._resize();

        const count = Math.min(sim.count, sim.type.length, (sim.pos.length / 3) | 0);
        this._ensureCapacity(count);
        if (count > 0) {
            UpdateBuffer(gl, this._posBuffer!, sim.pos.subarray(0, count * 3));
            UpdateBuffer(gl, this._typeBuffer!, sim.type.subarray(0, count));
        }

        for (let s = 0; s < MAX_SPECIES; s++) {
            const [r, g, b] = view.species[s] ? hexToRgb(view.species[s].color) : [1, 1, 1];
            this._palette.set([r, g, b], s * 3);
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const uniforms = { u_palette: this._palette, u_size: Math.max(1, view.pointSize * dpr) };
        const trails = view.trails > 0;

        if (!trails) {
            if (this._trailsWereOn && this._trailTarget) {
                DeleteRenderTarget(gl, this._trailTarget);
                this._trailTarget = null;
            }
            BindRenderTarget(gl, null);
            gl.clearColor(BACKGROUND[0], BACKGROUND[1], BACKGROUND[2], 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            if (count > 0) Draw(gl, this._points, this._vao!, { mode: gl.POINTS, count, uniforms });
        } else {
            // 1. fade what's there towards the background, 2. add this frame's points, 3. show it.
            BindRenderTarget(gl, this._ensureTrailTarget());
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            Draw(gl, this._fade, this._empty, { count: 3, uniforms: { u_color: [...BACKGROUND, 1 - view.trails] } });
            gl.disable(gl.BLEND);
            if (count > 0) Draw(gl, this._points, this._vao!, { mode: gl.POINTS, count, uniforms });

            BindRenderTarget(gl, null);
            Draw(gl, this._blit, this._empty, { count: 3, uniforms: { u_texture: this._trailTarget!.texture } });
        }

        this._trailsWereOn = trails;
    }

    dispose(): void {
        cancelAnimationFrame(this._raf);
        this._cleanup.forEach((fn) => fn());
        if (!this._lost) {
            const gl = this._gl;
            if (this._vao) DeleteVertexArray(gl, this._vao, { buffers: true });
            DeleteVertexArray(gl, this._empty);
            if (this._trailTarget) DeleteRenderTarget(gl, this._trailTarget);
            [this._points, this._fade, this._blit].forEach((p) => DeleteProgramInfo(gl, p));
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
        this.canvas.remove();
    }
}
