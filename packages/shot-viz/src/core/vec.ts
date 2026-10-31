/**
 * Minimal 3D vector maths. World frame (right-handed golfer, metres):
 * x = toward the target, y = up, z = right of the target line (away from a right-hander).
 * The ball sits at the origin. This matches three.js (y-up, right-handed).
 */
export type Vec3 = readonly [number, number, number];

export const DEG = Math.PI / 180;

export const v = (x: number, y: number, z: number): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const distance = (a: Vec3, b: Vec3) => length(sub(a, b));
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));

export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l === 0 ? [0, 0, 0] : scale(a, 1 / l);
}

/** Rotate `p` around the unit axis `axis` by `angle` radians (Rodrigues). */
export function rotate(p: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = normalize(axis);
  return add(add(scale(p, c), scale(cross(k, p), s)), scale(k, dot(k, p) * (1 - c)));
}

/** Rotate `p` around `axis` through `pivot`. */
export function rotateAbout(p: Vec3, pivot: Vec3, axis: Vec3, angle: number): Vec3 {
  return add(pivot, rotate(sub(p, pivot), axis, angle));
}

export const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

/**
 * Two-bone IK: place the middle joint (knee/elbow) between `root` and `target` given the bone
 * lengths, bending toward `pole`. If the target is out of reach the chain is straightened and
 * `end` stops short of the target.
 */
export function solveTwoBone(
  root: Vec3,
  target: Vec3,
  upper: number,
  lower: number,
  pole: Vec3,
): { mid: Vec3; end: Vec3 } {
  const toTarget = sub(target, root);
  const dist = clamp(length(toTarget), 1e-6, upper + lower - 1e-6);
  const dir = normalize(toTarget);
  const end = add(root, scale(dir, dist));
  // Law of cosines: distance along dir to the foot of the middle joint, and its offset.
  const a = (upper * upper - lower * lower + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const poleDir = normalize(sub(pole, scale(dir, dot(pole, dir))));
  return { mid: add(add(root, scale(dir, a)), scale(poleDir, h)), end };
}
