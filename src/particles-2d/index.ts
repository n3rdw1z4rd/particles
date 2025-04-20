import { Clock } from '../utils/clock';
import { Renderer } from '../utils/renderer';
import { rng } from '../utils/rng';
import { ParticleSystem2d } from './particle-system-2d';

export function StartParticleSystem2d(root: HTMLElement, _params: KeyValue = {}) {
    const clock = new Clock();
    const renderer = new Renderer();
    renderer.appendTo(root);

    const ps = new ParticleSystem2d();

    clock.run((dt: number) => {
        renderer.resize();

        ps.update(renderer, dt);

        renderer.render();

        clock.showStats({
            seed: rng.startingSeed,
            particleCount: ps.particleCount,
            time: (clock.elapsedTimeSinceStart / 1000).toFixed(2),
        });
    });
}
