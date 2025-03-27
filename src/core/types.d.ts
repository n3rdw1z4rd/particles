declare type KeyValue = { [key: string]: any };

declare type VEC2 = [number, number];
declare type VEC3 = VEC2 & [number];
declare type VEC4 = VEC3 & [number];

declare type COLOR = VEC3;

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
