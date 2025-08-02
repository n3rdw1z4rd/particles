import { VRButton } from 'three/examples/jsm/Addons.js';
import { rng } from '../utils/rng';
import { ThreeJsBoilerPlate } from '../utils/three/threejs-boiler-plate';
import { ParticleSystem } from './particle-system-3d';

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

    const ps = new ParticleSystem();
    eng.scene.add(ps);

    eng.renderer.setAnimationLoop((t: number) => {
        const dt = eng.clock.update(t);
        eng.resize();

        ps.update(eng.camera, dt);

        eng.renderer.render(eng.scene, eng.camera);

        eng.clock.showStats({
            seed: rng.startingSeed,
            particleCount: ps.particleCount,
            time: (eng.clock.time / 1000).toFixed(2),
        });
    });
}
