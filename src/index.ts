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
    if (!isNaN(parseInt(urlParams.seed))) {
        rng.seed = parseInt(urlParams.seed);
    }
}

class Particles {
    public px: Float32Array;
    public py: Float32Array;
    public vx: Float32Array;
    public vy: Float32Array;
    public color: Uint8Array;

    constructor(public count: number) {
        this.px = new Float32Array(this.count);
        this.py = new Float32Array(this.count);
        this.vx = new Float32Array(this.count);
        this.vy = new Float32Array(this.count);
        this.color = new Uint8Array(this.count);
    }
}

const particles: Particles = new Particles(1000);

const particlesColors: Color[] = [
    Color.RED,
    Color.GREEN,
    Color.BLUE,
    Color.YELLOW,
    Color.MAGENTA,
];

for (let i = 0; i < particles.count; i++) {
    particles.px[i] = rng.nextf;
    particles.py[i] = rng.nextf;
    particles.vx[i] = 0;
    particles.vy[i] = 0;
    particles.color[i] = rng.range(particlesColors.length - 1);
}

const attractionMatrix: number[][] = rng.randomMatrix(particlesColors.length);
const frictionHalfLife: number = 0.04;
const force: number = 0.5;
const radius: number = 0.05;
const speed: number = 1.0;

const calcForce = (r: number, a: number, beta: number = 0.3): number => (r < beta)
    ? r / beta - 1
    : (beta < r && r < 1)
        ? a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta))
        : 0;

const updateParticles = (dt: number) => {
    const frictionFactor: number = Math.pow(0.5, (clock.deltaTimeSeconds * speed) / frictionHalfLife);

    for (let i = 0; i < particles.count; i++) {
        let totalForceX: number = 0;
        let totalForceY: number = 0;

        for (let j = 0; j < particles.count; j++) {
            if (j === i) continue;

            let rx: number = particles.px[j] - particles.px[i];
            let ry: number = particles.py[j] - particles.py[i];

            const distance: number = Math.hypot(rx, ry);

            if (distance > 0 && distance < radius) {
                const f: number = calcForce(
                    distance / radius,
                    attractionMatrix[particles.color[i]][particles.color[j]]);

                totalForceX += rx / distance * f;
                totalForceY += ry / distance * f;
            }
        }

        totalForceX *= radius * force;
        totalForceY *= radius * force;

        particles.vx[i] *= frictionFactor;
        particles.vy[i] *= frictionFactor;

        particles.vx[i] += totalForceX;
        particles.vy[i] += totalForceY;
    }
};

const drawParticles = () => {
    for (let i = 0; i < particles.count; i++) {
        particles.px[i] += particles.vx[i] * (clock.deltaTimeSeconds * speed);
        particles.py[i] += particles.vy[i] * (clock.deltaTimeSeconds * speed);

        if (particles.px[i] < 0) particles.px[i] = 1 + (particles.px[i] % 1);
        if (particles.px[i] > 1) particles.px[i] = particles.px[i] % 1;
        if (particles.py[i] < 0) particles.py[i] = 1 + (particles.py[i] % 1);
        if (particles.py[i] > 1) particles.py[i] = particles.py[i] % 1;

        renderer.setPixel(
            particles.px[i] * renderer.width,
            particles.py[i] * renderer.height,
            particlesColors[particles.color[i]],
            2,
        );
    }
};

clock.run(() => {
    updateParticles(clock.deltaTimeSeconds);
    drawParticles();

    renderer.render();

    clock.showStats({
        seed: rng.originalSeed,
        particleCount: particles.count,
        frictionHalfLife: frictionHalfLife,
        radius: radius,
        force: force,
    });
}); 