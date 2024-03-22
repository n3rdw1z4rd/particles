import './core/css';
import {
    CanvasRenderer,
    Clock,
    Color,
    GetUrlParams,
    StatsDiv,
    UrlParameters,
    rng,
} from './core';

const clock = new Clock();
const renderer: CanvasRenderer = new CanvasRenderer();
const statsDiv: StatsDiv = new StatsDiv();
const urlParams: UrlParameters = GetUrlParams();

renderer.appendTo(document.body);
statsDiv.appendTo(document.body);

if (urlParams.hasOwnProperty('seed')) {
    rng.seed = urlParams.seed as number;
}

const colors: Color[] = [
    Color.RED,
    Color.GREEN,
    Color.BLUE,
    Color.YELLOW,
    Color.MAGENTA,
    // Color.ORANGE,
    // Color.CYAN,
];

const particleCount: number = 1000;
const frictionHalfLife: number = 0.04;
const range: number = 0.05;

const attractionMatrix: number[][] = rng.randomMatrix(colors.length);
console.debug(attractionMatrix);

const particles = {
    count: particleCount,
    px: new Float32Array(particleCount),
    py: new Float32Array(particleCount),
    pz: new Float32Array(particleCount),
    vx: new Float32Array(particleCount),
    vy: new Float32Array(particleCount),
    vz: new Float32Array(particleCount),
    color: new Uint8Array(particleCount),
};

for (let i = 0; i < particles.count; i++) {
    particles.px[i] = rng.nextf;
    particles.py[i] = rng.nextf;
    particles.pz[i] = 0;
    particles.vx[i] = 0;
    particles.vy[i] = 0;
    particles.color[i] = rng.range(colors.length - 1);
}

const calcForce = (r: number, a: number, beta: number = 0.3): number => (r < beta)
    ? r / beta - 1
    : (beta < r && r < 1)
        ? a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta))
        : 0;

const updateParticles = () => {
    const frictionFactor: number = Math.pow(0.5, clock.deltaTimeSeconds / frictionHalfLife);

    for (let i = 0; i < particles.count; i++) {
        let totalForceX: number = 0;
        let totalForceY: number = 0;

        for (let j = 0; j < particles.count; j++) {
            if (j === i) continue;

            let rx: number = particles.px[j] - particles.px[i];
            if (Math.abs(rx) > 0.5) rx = rx > 0 ? rx - 1 : rx + 1;

            let ry: number = particles.py[j] - particles.py[i];
            if (Math.abs(ry) > 0.5) ry = ry > 0 ? ry - 1 : ry + 1;

            const distance: number = Math.hypot(rx, ry);

            if (distance > 0 && distance < range) {
                const f: number = calcForce(
                    distance / range,
                    attractionMatrix[particles.color[i]][particles.color[j]]);

                totalForceX += rx / distance * f;
                totalForceY += ry / distance * f;
            }
        }

        totalForceX *= range * 0.5;
        totalForceY *= range * 0.5;

        particles.vx[i] *= frictionFactor;
        particles.vy[i] *= frictionFactor;

        particles.vx[i] += totalForceX;
        particles.vy[i] += totalForceY;
    }
};

const drawParticles = () => {
    for (let i = 0; i < particles.count; i++) {
        particles.px[i] += particles.vx[i] * clock.deltaTimeSeconds;
        particles.py[i] += particles.vy[i] * clock.deltaTimeSeconds;

        if (particles.px[i] < 0) particles.px[i] = 1 + (particles.px[i] % 1);
        if (particles.px[i] > 1) particles.px[i] = particles.px[i] % 1;

        if (particles.py[i] < 0) particles.py[i] = 1 + (particles.py[i] % 1);
        if (particles.py[i] > 1) particles.py[i] = particles.py[i] % 1;

        renderer.setPixel(
            particles.px[i] * renderer.width,
            particles.py[i] * renderer.height,
            colors[particles.color[i]],
            2,
        );
    }
};

clock.run(() => {
    const updateTime: number = clock.getExecuteTime(updateParticles);
    const drawTime: number = clock.getExecuteTime(drawParticles);

    renderer.render();

    clock.showStats({
        seed: rng.originalSeed,
    }, {
        particleCount,
        colors: colors.length,
        range,
        friction: frictionHalfLife,
    }, {
        'updateParticles(ms)': updateTime.toFixed(3),
        'drawParticles(ms)': drawTime.toFixed(3),
    });
});