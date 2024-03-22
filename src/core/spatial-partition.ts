export interface SpatialPartitionEntity {
    x: number;
    y: number;
}

export class SpatialPartition {
    cells: SpatialPartitionEntity[][][];
    cellSize: number;
    entities: SpatialPartitionEntity[];

    constructor(cellSize: number, entities: SpatialPartitionEntity[]) {
        this.cellSize = cellSize;
        this.entities = entities;

        this.cells = Array.from({ length: Math.ceil(1.0 / cellSize) }, () =>
            Array.from({ length: Math.ceil(1.0 / cellSize) }, () => [])
        );

        for (const entity of this.entities) {
            this.addEntity(entity);
        }
    }

    addEntity(entity: SpatialPartitionEntity) {
        const cell = this.getCell(entity.x, entity.y);
        cell.push(entity);
    }

    getCell(x: number, y: number) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return this.cells[cellY][cellX];
    }
}