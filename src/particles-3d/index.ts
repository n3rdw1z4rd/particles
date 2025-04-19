import { log } from '../utils/logger';
import { UrlParameters } from '../utils/misc';
import { rng } from '../utils/rng';
import { ThreeJsBoilerPlate } from '../utils/three/threejs-boiler-plate';
import { ParticleSystem } from './particle-system';

export function StartParticleSystem(root: HTMLElement, urlParams: UrlParameters = {}) {
    log('*** particles-3d ***');

    log('urlParams:', urlParams);

    if (urlParams.seed !== undefined) {
        rng.seed = urlParams.seed as number;
    }

    const eng = new ThreeJsBoilerPlate({
        parentElement: root,
        setupBasicSceneParams: {
            gridHelper: false,
            cameraDistance: 1,
        },
    });

    eng.cameraRig.minCameraDistance = 0.0;

    const ps = new ParticleSystem();
    eng.scene.add(ps);

    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'button-container';
    root.append(buttonContainer);

    const setButton = document.createElement('button');
    setButton.innerText = 'set';
    setButton.addEventListener('click', (ev: MouseEvent) => {
        if (ev.button === 0) {
            const url = new URL(location.href);
            url.searchParams.set('seed', String(rng.startingSeed));
            location.href = url.href;
        }
    });

    buttonContainer.append(setButton);

    const resetButton = document.createElement('button');
    resetButton.innerText = 'reset';
    resetButton.addEventListener('click', (ev: MouseEvent) => {
        if (ev.button === 0) {
            const url = new URL(location.href);
            url.searchParams.delete('seed');
            location.href = url.href;
        }
    });

    buttonContainer.append(resetButton);

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
