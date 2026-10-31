import type { Terrain } from "./schema.ts";
import { DEG, normalize, type Vec3 } from "./vec.ts";

/** The lie's slope holds for this many metres around the ball, then eases out to level ground. */
export const SLOPE_CORE = 4;
export const SLOPE_EASE = 3;

/**
 * Distance along the slope, eased so that the ground is a terrace: sloped near the ball and
 * level further away. Continuous with slope 1 at |u| = SLOPE_CORE.
 */
function terrace(u: number): number {
  const a = Math.abs(u);
  if (a <= SLOPE_CORE) return u;
  return Math.sign(u) * (SLOPE_CORE + SLOPE_EASE * (1 - Math.exp(-(a - SLOPE_CORE) / SLOPE_EASE)));
}

function terraceSlope(u: number): number {
  const a = Math.abs(u);
  return a <= SLOPE_CORE ? 1 : Math.exp(-(a - SLOPE_CORE) / SLOPE_EASE);
}

/**
 * Ground height at (x, z) in the right-handed world frame. The ball sits at the origin on the
 * ground. A right-hander stands at negative z, so "ball above feet" means the ground rises
 * toward +z.
 */
export function groundHeight(
  terrain: Pick<Terrain, "slopeAlong" | "slopeAcross">,
  x: number,
  z: number,
): number {
  return (
    Math.tan(terrain.slopeAlong * DEG) * terrace(x) +
    Math.tan(terrain.slopeAcross * DEG) * terrace(z)
  );
}

export function groundNormal(
  terrain: Pick<Terrain, "slopeAlong" | "slopeAcross">,
  x: number,
  z: number,
): Vec3 {
  const dx = Math.tan(terrain.slopeAlong * DEG) * terraceSlope(x);
  const dz = Math.tan(terrain.slopeAcross * DEG) * terraceSlope(z);
  return normalize([-dx, 1, -dz]);
}
