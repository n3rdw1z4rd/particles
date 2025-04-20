import { rng } from '../utils/rng';
import { ThreeJsBoilerPlate } from '../utils/three/threejs-boiler-plate';
import { ParticleSystem } from './particle-system';

export function StartParticleSystem3d(root: HTMLElement) {
    const eng = new ThreeJsBoilerPlate({
        parentElement: root,
        setupBasicSceneParams: {
            gridHelper: false,
            cameraDistance: 2,
        },
    });

    eng.cameraRig.minCameraDistance = 0.0;

    const ps = new ParticleSystem();
    eng.scene.add(ps);

    eng.clock.run((dt: number) => {
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
