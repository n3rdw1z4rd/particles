import {
    App,
    CanvasRenderer,
    Color,
    SpatialPartition,
    SpatialPartitionEntity,
} from "./core";

const app: App = new App(
    new CanvasRenderer(),
    document.getElementById('root')!
);

if (app.urlParams.seed && typeof app.urlParams.seed === "number") {
    app.rng.seed = (app.urlParams.seed as number) || Date.now();
}

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

interface Particle extends SpatialPartitionEntity {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: number;
}

const particleCount: number = (app.urlParams.count as number) ?? 2000;
const particleSize: number = 2;
const attractionMatrix: number[][] = app.rng.randomMatrix(colors.length);
const frictionHalfLife: number = 0.04;
const range: number = 0.1; //0.01 * colors.length;
const rangeFactor: number = 0.1; //1.0 - (colors.length * 0.1);

const particles: Particle[] = [];

for (let i = 0; i < particleCount; i++) {
    particles.push({
        x: app.rng.nextf,
        y: app.rng.nextf,
        vx: 0,
        vy: 0,
        color: app.rng.range(colors.length - 1),
    });
}

const calcForce = (r: number, a: number, beta: number = 0.3): number =>
    r < beta
        ? r / beta - 1
        : beta < r && r < 1
          ? a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta))
          : 0;

const spatialPartition = new SpatialPartition(range, particles);

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

                        if (d > 0 && d < range) {
                            const f: number = calcForce(
                                d / range,
                                attractionMatrix[p1.color][p2.color],
                            );

                            fx += (rx / d) * f;
                            fy += (ry / d) * f;
                        }
                    }
                }

                fx *= range * rangeFactor;
                fy *= range * rangeFactor;

                p1.vx *= frictionFactor;
                p1.vy *= frictionFactor;

                p1.vx += fx;
                p1.vy += fy;
            }
        }
    }
};

const updatePositions = (deltaTimeSeconds: number) => {
    for (let i = 0; i < particleCount; i++) {
        const particle = particles[i];
        const oldCell = spatialPartition.getCell(particle.x, particle.y);

        particle.x += particle.vx * deltaTimeSeconds;
        particle.y += particle.vy * deltaTimeSeconds;

        if (particle.x < 0) particle.x = 1 + (particle.x % 1);
        if (particle.x > 1) particle.x = particle.x % 1;

        if (particle.y < 0) particle.y = 1 + (particle.y % 1);
        if (particle.y > 1) particle.y = particle.y % 1;

        app.renderer.setPixel(
            particle.x * app.renderer.width,
            particle.y * app.renderer.height,
            colors[particle.color],
            particleSize,
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

app.run(() => {
    const frictionFactor: number = Math.pow(
        0.5,
        app.deltaTimeSeconds / frictionHalfLife,
    );

    updateVelocities(frictionFactor);
    updatePositions(app.deltaTimeSeconds);

    app.renderer.render();
    app.showStats(
        { seed: app.rng.startingSeed },
        {
            particleCount,
            colorCount: colors.length,
            range,
            rangeFactor,
        },
    );
});
