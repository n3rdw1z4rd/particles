declare type KeyValue = { [key: string]: any };

declare type VEC2 = [number, number];
declare type VEC3 = [number, number, number];

declare module "*.glsl" {
    const value: string;
    export default value;
}

declare module "*.vert" {
    const value: string;
    export default value;
}

declare module "*.frag" {
    const value: string;
    export default value;
}
