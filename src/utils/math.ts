const DEG2RAD = 0.01745329;

export type VEC2 = [number, number];
export type VEC3 = VEC2 & [number];
export type VEC4 = VEC3 & [number];

export type COLOR = VEC3;

export function abs(n: number): number {
    return n < 0 ? -n : n;
}

export function min(a: number, b: number): number {
    return a < b ? a : b;
}

export function max(a: number, b: number): number {
    return a > b ? a : b;
}

export function floor(n: number): number {
    const t = n | 0;                       // truncates toward zero
    return (n < 0 && t !== n) ? t - 1 : t; // correct for negatives too
}

export function ceil(n: number): number {
    const t = n | 0;
    return (n > 0 && t !== n) ? t + 1 : t;
}

export function round(n: number): number {
    return floor(n + 0.5);
}

export function sqrt(n: number): number {
    return n ** 0.5;
}

export function pow(base: number, exp: number): number {
    return base ** exp;
}

export function hypot2(x: number, y: number): number {
    return (x * x + y * y) ** 0.5;
}

export function hypot3(x: number, y: number, z: number): number {
    return (x * x + y * y + z * z) ** 0.5;
}

export function imul(a: number, b: number): number {
    b |= 0;
    let result = (a & 0x003fffff) * b;
    if (a & 0xffc00000) result += ((a & 0xffc00000) * b) | 0;
    return result | 0;
}

export function clamp(value: number, lo: number, hi: number): number {
    return max(lo, min(hi, value));
}

export function deg2rad(value: number): number {
    return value * DEG2RAD;
}

export function lerp(start: number, end: number, scale: number): number {
    return start * (1 - scale) + end * scale;
}
