import { Clock } from '../utils/clock';
import { Renderer } from '../utils/renderer';
import { rng } from '../utils/rng';
import { ParticleSystem2d } from './particle-system-2d';

// The simulation's fixed heartbeat. Physics always advances in these exact
// chunks, no matter the display refresh rate, so `?seed=N` evolves identically
// on every machine (a true permalink to a *moment*, not just a universe).
// Rendering still happens once per display frame at whatever rate the screen runs.
const FIXED_DT = 1 / 60;   // seconds per physics step
const MAX_FRAME_DT = 0.25; // clamp giant gaps (backgrounded tab) to avoid a step spiral

export function StartParticleSystem2d(root: HTMLElement, _params: KeyValue = {}) {
    const clock = new Clock();
    const renderer = new Renderer();
    renderer.appendTo(root);

    const ps = new ParticleSystem2d();

    let accumulator = 0;

    clock.run((frameDt: number) => {
        renderer.resize();

        // Bank real elapsed time, then drain it in fixed-size physics steps.
        accumulator += Math.min(frameDt, MAX_FRAME_DT);

        while (accumulator >= FIXED_DT) {
            ps.step(FIXED_DT);
            accumulator -= FIXED_DT;
        }

        // Draw the current state exactly once, regardless of how many (or how
        // few) physics steps ran this frame.
        ps.draw(renderer);
        renderer.render();

        clock.showStats({
            seed: rng.startingSeed,
            particleCount: ps.particleCount,
            time: (clock.elapsedTimeSinceStart / 1000).toFixed(2),
        });
    });
}
