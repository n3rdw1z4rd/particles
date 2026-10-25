import {
    BoxGeometry, BufferAttribute, BufferGeometry, EdgesGeometry, Group, LineBasicMaterial,
    LineSegments, Points, Scene, ShaderMaterial, Vector2, WebGLRenderer,
} from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import type { Simulation } from '../core/simulation';
import { CameraRig } from '@n3rdw1z4rd/core/three';
import { hexToRgb, SimRenderer, ViewOptions } from './types';

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
    readonly rig = new CameraRig({ fov: 75, near: 0.01, far: 100, distance: 1.6 });

    private _world = new Group();
    private _geometry = new BufferGeometry();
    private _material: ShaderMaterial;
    private _bounds: LineSegments;
    private _capacity = 0;
    private _last = 0;
    private _lastRender = 0;
    private _vrButton: HTMLElement | null = null;
    private _disposed = false;
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
        this.rig.distance = 1.6;
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

    private _bindControls(): void {
        // Listen on the canvas only, so dragging UI sliders never orbits the camera.
        let dragging = false;
        let lx = 0, ly = 0;

        const down = (ev: PointerEvent) => {
            dragging = true;
            lx = ev.clientX;
            ly = ev.clientY;
            this.canvas.setPointerCapture(ev.pointerId);
        };
        const move = (ev: PointerEvent) => {
            if (!dragging) return;
            this.rig.orbit(ev.clientX - lx, ev.clientY - ly);
            lx = ev.clientX;
            ly = ev.clientY;
        };
        const up = () => { dragging = false; };
        const wheel = (ev: WheelEvent) => {
            ev.preventDefault();
            this.rig.dolly(ev.deltaY);
        };

        this.canvas.addEventListener('pointerdown', down);
        this.canvas.addEventListener('pointermove', move);
        this.canvas.addEventListener('pointerup', up);
        this.canvas.addEventListener('pointercancel', up);
        this.canvas.addEventListener('wheel', wheel, { passive: false });
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

        // Only show the VR button where immersive VR actually exists.
        navigator.xr?.isSessionSupported('immersive-vr').then((ok) => {
            if (!ok || this._disposed) return;
            this._vrButton = VRButton.createButton(this.renderer);
            this._vrButton.classList.add('vr-button');
            document.body.append(this._vrButton);
        }).catch(() => { /* no XR */ });

        this._cleanup.push(() => {
            this.renderer.xr.removeEventListener('sessionstart', onStart);
            this.renderer.xr.removeEventListener('sessionend', onEnd);
            this._vrButton?.remove();
        });
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

    render(sim: Simulation, view: ViewOptions): void {
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

        const now = performance.now();
        this.rig.update(this._lastRender ? Math.min((now - this._lastRender) / 1000, 0.1) : 0);
        this._lastRender = now;

        this.renderer.render(this.scene, this.rig.camera);
    }

    dispose(): void {
        this._disposed = true;
        this.renderer.setAnimationLoop(null);
        this._cleanup.forEach((fn) => fn());
        this._geometry.dispose();
        this._material.dispose();
        this.renderer.dispose();
        this.canvas.remove();
    }
}
