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

interface Particle {
    px: number,
    py: number,
    vx: number,
    vy: number,
    color: number,
}

const particles: Particle[] = [];

for (let i = 0; i < count; i++) {
    particles.push({
        px: rng.nextf,
        py: rng.nextf,
        vx: 0,
        vy: 0,
        color: rng.range(colors.length - 1),
    });
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

            let rx: number = p2.px - p1.px;
            if (Math.abs(rx) > 0.5) rx = rx > 0 ? rx - 1 : rx + 1;

            let ry: number = p2.py - p1.py;
            if (Math.abs(ry) > 0.5) ry = ry > 0 ? ry - 1 : ry + 1;

            const d: number = Math.hypot(rx, ry);

            if (d > 0 && d < range) {
                const f: number = calcForce(
                    d / range,
                    attractionMatrix[p1.color][p2.color]);

                fx += rx / d * f;
                fy += ry / d * f;
            }
        }

        fx *= range * 0.5;
        fy *= range * 0.5;

        p1.vx *= frictionFactor;
        p1.vy *= frictionFactor;

        p1.vx += fx;
        p1.vy += fy;
    }
};

const drawParticles = () => {
    for (let i = 0; i < count; i++) {
        const particle = particles[i];

        particle.px += particle.vx * clock.deltaTimeSeconds;
        particle.py += particle.vy * clock.deltaTimeSeconds;

        if (particle.px < 0) particle.px = 1 + (particle.px % 1);
        if (particle.px > 1) particle.px = particle.px % 1;

        if (particle.py < 0) particle.py = 1 + (particle.py % 1);
        if (particle.py > 1) particle.py = particle.py % 1;

        renderer.setPixel(
            particle.px * renderer.width,
            particle.py * renderer.height,
            colors[particle.color],
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