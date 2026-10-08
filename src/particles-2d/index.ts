import { Clock } from '../utils/clock';
import { Renderer } from '../utils/renderer';
import { rng } from '../utils/rng';
import { ParticleSystem2d } from './particle-system-2d';

const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.25;

export function StartParticleSystem2d(root: HTMLElement, _params: KeyValue = {}) {
    const clock = new Clock();
    const renderer = new Renderer();
    renderer.appendTo(root);

    const ps = new ParticleSystem2d();

    let accumulator = 0;

    clock.run((frameDt: number) => {
        renderer.resize();

        accumulator += Math.min(frameDt, MAX_FRAME_DT);

        while (accumulator >= FIXED_DT) {
            ps.step(FIXED_DT);
            accumulator -= FIXED_DT;
        }

        ps.draw(renderer);
        renderer.render();

        clock.showStats({
            seed: rng.startingSeed,
            particleCount: ps.particleCount,
            time: (clock.elapsedTimeSinceStart / 1000).toFixed(2),
        });
    });
}
