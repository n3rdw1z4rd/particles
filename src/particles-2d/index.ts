import { Clock } from '../utils/clock';
import { Color } from '../utils/color';
import { UrlParameters } from '../utils/misc';
import { log } from '../utils/logger';
import { Renderer } from '../utils/renderer';
import { rng } from '../utils/rng';
import { SpatialPartition2d, SpatialPartitionEntity2d } from '../utils/spatial-partition-2d';

interface Particle extends SpatialPartitionEntity2d {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: number;
}

export function StartParticleSystem(root: HTMLElement, urlParams: UrlParameters = {}) {
    log('*** particles-og ***');

    log('urlParams:', urlParams);

    if (typeof urlParams.seed === 'number') {
        rng.seed = urlParams.seed;
    }

    const clock = new Clock();
    const renderer = new Renderer();
    renderer.appendTo(root);

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

    const colors: Color[] = [
        Color.RED,
        Color.GREEN,
        Color.BLUE,
        Color.YELLOW,
        Color.MAGENTA,
        // Color.ORANGE,
        // Color.CYAN,
        // Color.PURPLE,
    ];

    const params: KeyValue = {
        particleCount: 2000,
        particleSize: 2,
        frictionHalfLife: 0.04,
        range: 0.1,
        rangeFactor: 0.1,
    };

    const attractionMatrix: number[][] = rng.randomMatrix(colors.length);
    const particles: Particle[] = [];

    for (let i = 0; i < params.particleCount; i++) {
        particles.push({
            x: rng.nextf,
            y: rng.nextf,
            vx: 0,
            vy: 0,
            color: rng.range(colors.length),
        });
    }

    const calcForce = (r: number, a: number, beta: number = 0.3): number => {
        let f = 0;

        if (r < beta) {
            f = r / beta - 1;
        } else if (beta < r && r < 1) {
            f = a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta));
        }

        return f;
    };

    const spatialPartition = new SpatialPartition2d(params.range, particles);

    const updateVelocities = (frictionFactor: number) => {
        for (let y = 0; y < spatialPartition.cells.length; y++) {
            for (let x = 0; x < spatialPartition.cells[y].length; x++) {
                const cell = spatialPartition.cells[y][x];

                for (let i = 0; i < cell.length; i++) {
                    let fx: number = 0;
                    let fy: number = 0;

                    const p1: Particle = cell[i] as Particle;

                    // Get neighboring cells
                    const neighborCells = spatialPartition.getCellNeighbors(x, y);

                    // Check particles in the same and neighboring cells
                    for (const neighborCell of neighborCells) {
                        for (let j = 0; j < neighborCell.length; j++) {
                            if (cell === neighborCell && i === j) continue;

                            const p2: Particle = neighborCell[j] as Particle;

                            let rx: number = p2.x - p1.x;
                            if (Math.abs(rx) > 0.5) rx = rx > 0 ? rx - 1 : rx + 1;

                            let ry: number = p2.y - p1.y;
                            if (Math.abs(ry) > 0.5) ry = ry > 0 ? ry - 1 : ry + 1;

                            const d: number = Math.hypot(rx, ry);

                            if (d > 0 && d < params.range) {
                                const f: number = calcForce(
                                    d / params.range,
                                    attractionMatrix[p1.color][p2.color],
                                );

                                fx += (rx / d) * f;
                                fy += (ry / d) * f;
                            }
                        }
                    }

                    fx *= params.range * params.rangeFactor;
                    fy *= params.range * params.rangeFactor;

                    p1.vx *= frictionFactor;
                    p1.vy *= frictionFactor;

                    p1.vx += fx;
                    p1.vy += fy;
                }
            }
        }
    };

    const updatePositions = (deltaTimeSeconds: number) => {
        for (let i = 0; i < params.particleCount; i++) {
            const particle = particles[i];
            const oldCell = spatialPartition.getCell(particle.x, particle.y);

            particle.x += particle.vx * deltaTimeSeconds;
            particle.y += particle.vy * deltaTimeSeconds;

            if (particle.x < 0) particle.x = 1 + (particle.x % 1);
            if (particle.x > 1) particle.x = particle.x % 1;

            if (particle.y < 0) particle.y = 1 + (particle.y % 1);
            if (particle.y > 1) particle.y = particle.y % 1;

            renderer.setPixel(
                particle.x * renderer.width,
                particle.y * renderer.height,
                colors[particle.color],
                params.particleSize,
            );

            const newCell = spatialPartition.getCell(particle.x, particle.y);

            if (newCell !== oldCell) {
                const index = oldCell.indexOf(particle);
                if (index !== -1) {
                    oldCell.splice(index, 1);
                }
                newCell.push(particle);
            }
        }
    };

    clock.run((deltaTimeSeconds: number) => {
        renderer.resize();

        const frictionFactor: number = Math.pow(
            0.5,
            deltaTimeSeconds / params.frictionHalfLife,
        );

        updateVelocities(frictionFactor);
        updatePositions(deltaTimeSeconds);

        renderer.render();

        clock.showStats({
            seed: rng.startingSeed,
            particleCount: params.particleCount,
            colorCount: colors.length,
            range: params.range,
            rangeFactor: params.rangeFactor,
            time: (clock.elapsedTimeSinceStart / 1000).toFixed(2),
        });
    });
}
