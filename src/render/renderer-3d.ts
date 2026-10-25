import {
    BoxGeometry, BufferAttribute, BufferGeometry, EdgesGeometry, Group, LineBasicMaterial,
    LineSegments, Points, Scene, ShaderMaterial, Vector2, WebGLRenderer,
} from 'three';
import type { SimView } from '../sim/sim-client';
import { GestureRecognizer } from '@n3rdw1z4rd/core';
import { CameraRig } from '@n3rdw1z4rd/core/three';
import { hexToRgb, SimRenderer, ViewOptions } from './types';

const DEFAULT_DISTANCE = 1.6;

const vertexShader = /* glsl */ `
uniform float pointSize;
uniform float pixelRatio;
attribute vec3 pcolor;
varying vec3 vColor;

void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Perspective-scaled so points read as solid spheres; ~pointSize px at the default distance.
    gl_PointSize = clamp(pointSize * pixelRatio * 1.6 / max(-mvPosition.z, 0.05), 1.0, 64.0);
    vColor = pcolor;
}`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;

void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d = dot(c, c);
    if (d > 1.0) discard;           // round points, depth-correct without sorting
    float shade = 0.6 + 0.4 * sqrt(1.0 - d);
    gl_FragColor = vec4(vColor * shade, 1.0);
}`;

export class Renderer3d implements SimRenderer {
    readonly renderer: WebGLRenderer;
    readonly scene = new Scene();
    readonly rig = new CameraRig({ fov: 75, near: 0.01, far: 100, distance: DEFAULT_DISTANCE });

    private _world = new Group();
    private _geometry = new BufferGeometry();
    private _material: ShaderMaterial;
    private _bounds: LineSegments;
    private _capacity = 0;
    private _last = 0;
    private _lastRender = 0;
    private _gestures = new GestureRecognizer();
    private _size = new Vector2();
    private _cleanup: (() => void)[] = [];

    get canvas(): HTMLCanvasElement { return this.renderer.domElement; }

    constructor(parent: HTMLElement) {
        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setClearColor(0x111111);
        this.renderer.xr.enabled = true;
        this.canvas.className = 'sim-canvas';
        parent.prepend(this.canvas);

        this.scene.add(this.rig);
        // Orbit the cube's centre; no first-person mode, full pitch range.
        this.rig.minDistance = 0.05;
        this.rig.maxDistance = 6;
        this.rig.distance = DEFAULT_DISTANCE;
        this.rig.orbitSensitivity = 0.01;
        this.rig.pitchLimits = { min: -Math.PI / 2 + 0.01, max: Math.PI / 2 - 0.01 };
        this.rig.targetOffset.set(0, 0, 0);

        this._world.position.set(-0.5, -0.5, -0.5);
        this.scene.add(this._world);

        this._material = new ShaderMaterial({
            uniforms: {
                pointSize: { value: 4 },
                pixelRatio: { value: this.renderer.getPixelRatio() },
            },
            vertexShader,
            fragmentShader,
        });

        const points = new Points(this._geometry, this._material);
        points.frustumCulled = false;
        this._world.add(points);

        this._bounds = new LineSegments(
            new EdgesGeometry(new BoxGeometry(1, 1, 1)),
            new LineBasicMaterial({ color: 0x444444 }),
        );
        this._bounds.position.set(0.5, 0.5, 0.5);
        this._world.add(this._bounds);

        this._bindControls();
        this._setupXR();
    }

    /** Puts the camera back where it starts. */
    resetCamera(): void {
        this.rig.yaw = 0;
        this.rig.pitch = 0;
        this.rig.distance = DEFAULT_DISTANCE;
    }

    private _bindControls(): void {
        // Listen on the canvas only, so dragging UI sliders never orbits the camera.
        // One pointer orbits; two pointers pinch-zoom (the GestureRecognizer tracks the pair);
        // double-tap / double-click resets the camera.
        const pointers = new Map<number, { x: number; y: number }>();

        const down = (ev: PointerEvent) => {
            pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
            this._gestures.down(ev.pointerId, ev.clientX, ev.clientY, ev.timeStamp);
            this.canvas.setPointerCapture(ev.pointerId);
        };
        const move = (ev: PointerEvent) => {
            const p = pointers.get(ev.pointerId);
            if (!p) return;
            this._gestures.move(ev.pointerId, ev.clientX, ev.clientY);
            if (pointers.size === 1) this.rig.orbit(ev.clientX - p.x, ev.clientY - p.y);
            p.x = ev.clientX;
            p.y = ev.clientY;
        };
        const up = (ev: PointerEvent) => {
            if (!pointers.delete(ev.pointerId)) return;
            this._gestures.up(ev.pointerId, ev.clientX, ev.clientY, ev.timeStamp);
        };
        const cancel = (ev: PointerEvent) => {
            pointers.delete(ev.pointerId);
            this._gestures.cancel(ev.pointerId);
        };
        const wheel = (ev: WheelEvent) => {
            ev.preventDefault();
            this.rig.dolly(ev.deltaY);
        };

        this.canvas.addEventListener('pointerdown', down);
        this.canvas.addEventListener('pointermove', move);
        this.canvas.addEventListener('pointerup', up);
        this.canvas.addEventListener('pointercancel', cancel);
        this.canvas.addEventListener('wheel', wheel, { passive: false });
    }

    private _applyGestures(): void {
        const frame = this._gestures.update(performance.now());
        if (frame.pinch !== 1 && frame.pinch > 0) this.rig.distance = this.rig.distance / frame.pinch;
        if (frame.gestures.includes('doubleTap')) this.resetCamera();
    }

    private _setupXR(): void {
        const onStart = () => {
            this.rig.position.y -= 1;
            this.rig.position.z += 1;
        };
        const onEnd = () => {
            this.rig.position.set(0, 0, 0);
        };
        this.renderer.xr.addEventListener('sessionstart', onStart);
        this.renderer.xr.addEventListener('sessionend', onEnd);

        this._cleanup.push(() => {
            this.renderer.xr.removeEventListener('sessionstart', onStart);
            this.renderer.xr.removeEventListener('sessionend', onEnd);
            void this.renderer.xr.getSession()?.end();
        });
    }

    async enterVR(): Promise<void> {
        const current = this.renderer.xr.getSession();
        if (current) {
            await current.end();
            return;
        }
        const session = await navigator.xr!.requestSession('immersive-vr', {
            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
        });
        await this.renderer.xr.setSession(session);
    }

    start(frame: (dt: number) => void): void {
        // setAnimationLoop is required so the loop keeps running inside a WebXR session.
        this.renderer.setAnimationLoop((t: number) => {
            const dt = this._last ? (t - this._last) / 1000 : 0;
            this._last = t;
            frame(dt);
        });
    }

    private _resize(): void {
        const rect = this.canvas.parentElement!.getBoundingClientRect();
        const w = Math.max(1, rect.width | 0);
        const h = Math.max(1, rect.height | 0);
        const size = this.renderer.getSize(this._size);
        if (size.x !== w || size.y !== h) {
            this.renderer.setSize(w, h);
            this.rig.camera.aspect = w / h;
            this.rig.camera.updateProjectionMatrix();
        }
    }

    render(sim: SimView, view: ViewOptions): void {
        if (!this.renderer.xr.isPresenting) this._resize();

        if (this._capacity !== sim.count) {
            this._capacity = sim.count;
            this._geometry.setAttribute('position', new BufferAttribute(new Float32Array(sim.count * 3), 3));
            this._geometry.setAttribute('pcolor', new BufferAttribute(new Float32Array(sim.count * 3), 3));
        }

        const position = this._geometry.getAttribute('position') as BufferAttribute;
        const color = this._geometry.getAttribute('pcolor') as BufferAttribute;
        const pa = position.array as Float32Array;
        const ca = color.array as Float32Array;
        const palette = view.species.map((s) => hexToRgb(s.color));

        pa.set(sim.pos);
        for (let i = 0; i < sim.count; i++) {
            const c = palette[sim.type[i]] ?? [1, 1, 1];
            ca[i * 3] = c[0];
            ca[i * 3 + 1] = c[1];
            ca[i * 3 + 2] = c[2];
        }
        position.needsUpdate = true;
        color.needsUpdate = true;

        this._material.uniforms.pointSize.value = view.pointSize;
        this._bounds.visible = view.showBounds;

        this._applyGestures();
        const now = performance.now();
        this.rig.update(this._lastRender ? Math.min((now - this._lastRender) / 1000, 0.1) : 0);
        this._lastRender = now;

        this.renderer.render(this.scene, this.rig.camera);
    }

    dispose(): void {
        this.renderer.setAnimationLoop(null);
        this._cleanup.forEach((fn) => fn());
        this._geometry.dispose();
        this._material.dispose();
        this.renderer.dispose();
        this.canvas.remove();
    }
}
