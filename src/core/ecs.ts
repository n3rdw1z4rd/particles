import { Logger } from './logger';

const log: Logger = new Logger('[ECS]');

export type SystemCallback = (entities: any[]) => void;

export interface System {
    name: string;
    components: string[];
    callback: SystemCallback;
}

export class ECS {
    private _componentList: Map<string, any> = new Map<string, any>();
    private _systems: System[] = [];
    private _entities: any[] = [];

    public createComponent(name: string, data: any) {
        if (!this._componentList.has(name)) {
            this._componentList.set(name, data);
            log.debug(`created component '${name}', data:`, data);
        } else {
            log.warn('createComponent: a component already exists with name:', name);
        }
    }

    public createSystem<T extends string[]>(name: string, ...components: [...T, SystemCallback]): this {
        const callback: SystemCallback = components.pop() as SystemCallback;

        if (!this._systems.find((system) => system.name === name)) {
            const system: System = {
                name,
                components: components.filter((comp: any) => (typeof comp === 'string')) as string[],
                callback,
            };

            this._systems.push(system);
            log.debug(`created system '${system.name}', components:`, system.components);
        } else {
            log.warn('createSystem: a system already exists with name:', name);
        }

        return this;
    }

    public createEntity(...components: string[]): this {
        const entity: any = {};

        for (let i = 0; i < components.length; i++) {
            if (this._componentList.has(components[i])) {
                entity[components[i]] = {};
                const data: any = this._componentList.get(components[i]);

                for (const key in data) {
                    const value: any = (typeof data[key] === 'function') ? data[key]() : data[key];
                    entity[components[i]][key] = value;
                }

                this._entities.push(entity);
            } else {
                log.warn('createEntity: component not found:', components[i]);
            }
        }

        return this;
    }

    public createEntities(count: number, ...components: string[]): this {
        for (let i = 0; i < count; i++) {
            this.createEntity(...components);
        }

        return this;
    }

    public update() {
        for (let i = 0; i < this._systems.length; i++) {
            const entities: any[] = this._entities.filter((entity) => {
                return this._systems[i].components.every((component) => entity[component]);
            });

            this._systems[i].callback(entities);
        }
    }
}