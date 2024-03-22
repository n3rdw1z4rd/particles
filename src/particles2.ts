import { CanvasRenderer, Clock, Color, GetUrlParams, StatsDiv, UrlParameters, log, rng } from './core';
import './core/css';

const clock = new Clock();
const renderer: CanvasRenderer = new CanvasRenderer();
const statsDiv: StatsDiv = new StatsDiv();
const urlParams: UrlParameters = GetUrlParams();

const colors: Color[] = [
    Color.RED,
    Color.GREEN,
    Color.BLUE,
    Color.YELLOW,
    Color.MAGENTA,
    // Color.ORANGE,
    // Color.CYAN,
];

renderer.appendTo(document.body);
statsDiv.appendTo(document.body);

const attractionMatrix: number[][] = rng.randomMatrix(colors.length);
const frictionHalfLife: number = 0.04;

log.debug('urlParams', urlParams);

let count: number = urlParams.count as number || 1000;
let range: number = urlParams.range as number || 0.1;

if (urlParams.seed && typeof urlParams.seed === 'number') {
    rng.seed = urlParams.seed as number || Date.now();
}

/**
 * 0: position x
 * 1: position y
 * 2: velocity x
 * 3: velocity y
 * 4: color index
 */
type Particle = [number, number, number, number, number];

const particles: Particle[] = [];

for (let i = 0; i < count; i++) {
    particles.push([
        rng.nextf,
        rng.nextf,
        0,
        0,
        // rng.nextf - 0.5,
        // rng.nextf - 0.5,
        rng.range(colors.length - 1),
    ]);
}

log.debug('particles[0]:', particles[0]);

const calcForce = (r: number, a: number, beta: number = 0.3): number => (r < beta)
    ? r / beta - 1
    : (beta < r && r < 1)
        ? a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta))
        : 0;

const updateParticles = () => {
    const frictionFactor: number = Math.pow(0.5, clock.deltaTimeSeconds / frictionHalfLife);

    for (let i = 0; i < count; i++) {
        let fx: number = 0;
        let fy: number = 0;

        const p1: Particle = particles[i];

        for (let j = 0; j < count; j++) {
            if (i === j) continue;

            const p2: Particle = particles[j];

            let rx: number = p2[0] - p1[0];
            if (Math.abs(rx) > 0.5) rx = rx > 0 ? rx - 1 : rx + 1;

            let ry: number = p2[1] - p1[1];
            if (Math.abs(ry) > 0.5) ry = ry > 0 ? ry - 1 : ry + 1;

            const d: number = Math.hypot(rx, ry);

            if (d > 0 && d < range) {
                const f: number = calcForce(
                    d / range,
                    attractionMatrix[p1[4]][p2[4]]);

                fx += rx / d * f;
                fy += ry / d * f;
            }
        }

        fx *= range * 0.5;
        fy *= range * 0.5;

        p1[2] *= frictionFactor;
        p1[3] *= frictionFactor;

        p1[2] += fx;
        p1[3] += fy;
    }
};

const drawParticles = () => {
    for (let i = 0; i < count; i++) {
        const particle = particles[i];

        particle[0] += particle[2] * clock.deltaTimeSeconds;
        particle[1] += particle[3] * clock.deltaTimeSeconds;

        if (particle[0] < 0) particle[0] = 1 + (particle[0] % 1);
        if (particle[0] > 1) particle[0] = particle[0] % 1;

        if (particle[1] < 0) particle[1] = 1 + (particle[1] % 1);
        if (particle[1] > 1) particle[1] = particle[1] % 1;

        renderer.setPixel(
            particle[0] * renderer.width,
            particle[1] * renderer.height,
            colors[particle[4]],
            2,
        );
    }
}

clock.run(() => {
    updateParticles();
    drawParticles();
    renderer.render();

    clock.showStats(
        { startingSeed: rng.startingSeed },
        {
            count,
            colors: colors.length,
            range,
        }
    );
});