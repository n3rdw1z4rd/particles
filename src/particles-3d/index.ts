import { VRButton } from 'three/examples/jsm/Addons.js';
import { rng } from '../utils/rng';
import { ThreeJsBoilerPlate } from '../utils/three/threejs-boiler-plate';
import { ParticleSystem3d } from './particle-system-3d';

// Fixed physics heartbeat — see particles-2d/index.ts for the rationale.
const FIXED_DT = 1 / 60;   // seconds per physics step
const MAX_FRAME_DT = 0.25; // clamp giant gaps to avoid a step spiral

export function StartParticleSystem3d(root: HTMLElement) {
    const eng = new ThreeJsBoilerPlate({
        parentElement: root,
        setupBasicSceneParams: {
            gridHelper: false,
            cameraDistance: 0,
        },
    });

    eng.cameraRig.minCameraDistance = 0;
    eng.cameraRig.wheelSensitivity = 0.001;

    eng.renderer.xr.enabled = true;

    eng.renderer.xr.addEventListener('sessionstart', () => {
        eng.cameraRig.position.y -= 1;
        eng.cameraRig.position.z += 1;
    });

    VRButton.createButton(eng.renderer);

    const ps = new ParticleSystem3d();
    eng.scene.add(ps);

    let accumulator = 0;

    eng.renderer.setAnimationLoop((t: number) => {
        const frameDt = eng.clock.update(t);
        eng.resize();

        accumulator += Math.min(frameDt, MAX_FRAME_DT);

        while (accumulator >= FIXED_DT) {
            ps.step(FIXED_DT);
            accumulator -= FIXED_DT;
        }

        // Sort + rebuild geometry once per display frame, against the final
        // stepped state and the current camera.
        ps.draw(eng.camera);

        eng.renderer.render(eng.scene, eng.camera);

        eng.clock.showStats({
            seed: rng.startingSeed,
            particleCount: ps.particleCount,
            time: (eng.clock.time / 1000).toFixed(2),
        });
    });
}
