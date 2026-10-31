import { BALL_RADIUS } from "./clubs.ts";
import type { ShotScene, Terrain, Wind } from "./schema.ts";
import { deriveLaunch, type LaunchConditions } from "./setup.ts";
import { groundHeight } from "./terrain.ts";
import { add, cross, DEG, length, normalize, rotate, scale, sub, type Vec3 } from "./vec.ts";

export interface FlightPoint {
  t: number;
  p: Vec3;
}

export interface FlightResult {
  launch: LaunchConditions;
  /** Airborne samples from impact to first landing. */
  air: FlightPoint[];
  /** Ground samples from first landing to rest. */
  roll: FlightPoint[];
  apex: Vec3;
  landing: Vec3;
  rest: Vec3;
  /** Horizontal distance from the ball to the first landing (m). */
  carry: number;
  /** Horizontal distance from the ball to where it stops (m). */
  total: number;
  /** Angle of descent at landing, degrees below horizontal. */
  descentAngle: number;
  /** Time of flight to the first landing (s) and to rest (s). */
  flightTime: number;
  duration: number;
}

const MASS = 0.04593;
const AREA = Math.PI * BALL_RADIUS * BALL_RADIUS;
const AIR_DENSITY = 1.2;
const G = 9.81;
const DT = 0.01;

/** Wind velocity vector in the world frame (x toward target, z to the right). */
export function windVector(wind: Wind | undefined): Vec3 {
  if (!wind || wind.speed === 0) return [0, 0, 0];
  const from: Vec3 = [Math.cos(wind.from * DEG), 0, Math.sin(wind.from * DEG)];
  return scale(from, -wind.speed);
}

const ROLL = {
  soft: { retain: 0.3, friction: 0.35 },
  normal: { retain: 0.45, friction: 0.16 },
  firm: { retain: 0.6, friction: 0.09 },
} as const;

/**
 * A small, readable ball-flight model: gravity, quadratic drag and spin lift (Magnus), with the
 * spin axis tilted for curve and a constant wind. After landing the ball keeps part of its
 * horizontal speed (less for steep, spinny landings and soft ground) and rolls to a stop.
 * Plausible shapes, not launch-monitor accuracy.
 */
export function simulateFlight(
  launch: LaunchConditions,
  terrain: Pick<Terrain, "slopeAlong" | "slopeAcross" | "firmness">,
  wind?: Wind,
): FlightResult {
  const dirH: Vec3 = [Math.cos(launch.direction * DEG), 0, Math.sin(launch.direction * DEG)];
  const la = launch.launchAngle * DEG;
  let vel: Vec3 = add(scale(dirH, launch.ballSpeed * Math.cos(la)), [
    0,
    launch.ballSpeed * Math.sin(la),
    0,
  ]);
  let pos: Vec3 = [0, groundHeight(terrain, 0, 0) + BALL_RADIUS, 0];
  // Backspin axis points to the right of travel; tilting it toward −y curves the ball right.
  const baseAxis = normalize(cross(dirH, [0, 1, 0]));
  const spinAxis = rotate(baseAxis, dirH, launch.spinAxis * DEG);
  let omega = (launch.spinRpm * 2 * Math.PI) / 60;
  const w = windVector(wind);

  const air: FlightPoint[] = [{ t: 0, p: pos }];
  let apex = pos;
  let t = 0;
  const isRoller = launch.launchAngle < 4 && launch.ballSpeed < 15;

  while (!isRoller && t < 15) {
    const rel = sub(vel, w);
    const speed = length(rel);
    const s = (omega * BALL_RADIUS) / Math.max(speed, 1);
    const cd = 0.22 + 0.25 * s;
    const cl = Math.min(0.32, 0.05 + 0.95 * s);
    const q = 0.5 * AIR_DENSITY * AREA * speed;
    const drag = scale(rel, (-q * cd) / MASS);
    const lift = scale(normalize(cross(spinAxis, rel)), (q * speed * cl) / MASS);
    const acc = add(add(drag, lift), [0, -G, 0]);
    const next = add(pos, scale(add(vel, scale(acc, DT / 2)), DT));
    vel = add(vel, scale(acc, DT));
    omega *= 1 - 0.04 * DT;
    t += DT;
    const ground = groundHeight(terrain, next[0], next[2]) + BALL_RADIUS;
    if (next[1] <= ground && vel[1] < 0) {
      // Interpolate to the crossing point for a clean landing.
      const above = pos[1] - (groundHeight(terrain, pos[0], pos[2]) + BALL_RADIUS);
      const below = ground - next[1];
      const f = above / Math.max(above + below, 1e-9);
      pos = add(pos, scale(sub(next, pos), f));
      pos = [pos[0], groundHeight(terrain, pos[0], pos[2]) + BALL_RADIUS, pos[2]];
      air.push({ t: t - DT * (1 - f), p: pos });
      break;
    }
    pos = next;
    if (pos[1] > apex[1]) apex = pos;
    air.push({ t, p: pos });
  }

  const landing = pos;
  const flightTime = air[air.length - 1]!.t;
  const vH: Vec3 = [vel[0], 0, vel[2]];
  const hSpeed = length(vH);
  const descentAngle = isRoller ? 0 : Math.atan2(-vel[1], hSpeed) / DEG;
  const firm = ROLL[terrain.firmness];

  let rollSpeed: number;
  let friction: number;
  let rollDir: Vec3;
  if (isRoller) {
    // A putt: rolls from the start on green-speed friction.
    rollSpeed = launch.ballSpeed;
    friction = 0.065;
    rollDir = dirH;
  } else {
    const steep = Math.cos(descentAngle * DEG);
    const spinCheck = Math.max(0.15, 1 - launch.spinRpm / 13000);
    rollSpeed = hSpeed * firm.retain * steep * spinCheck;
    friction = firm.friction;
    rollDir = normalize(vH);
  }

  const decel = friction * G;
  const rollTime = rollSpeed / decel;
  const rollDistance = (rollSpeed * rollSpeed) / (2 * decel);
  const roll: FlightPoint[] = [];
  const steps = Math.max(2, Math.ceil(rollTime / 0.05));
  for (let i = 0; i <= steps; i++) {
    const tt = (rollTime * i) / steps;
    const d = rollSpeed * tt - 0.5 * decel * tt * tt;
    const flat = add(landing, scale(rollDir, d));
    roll.push({
      t: flightTime + tt,
      p: [flat[0], groundHeight(terrain, flat[0], flat[2]) + BALL_RADIUS, flat[2]],
    });
  }
  const rest = roll[roll.length - 1]!.p;
  const horiz = (p: Vec3) => Math.hypot(p[0], p[2]);

  return {
    launch,
    air,
    roll,
    apex,
    landing,
    rest,
    carry: isRoller ? 0 : horiz(landing),
    total: isRoller ? rollDistance : horiz(rest),
    descentAngle,
    flightTime,
    duration: flightTime + rollTime,
  };
}

export function computeFlight(scene: ShotScene): FlightResult {
  return simulateFlight(deriveLaunch(scene), scene.terrain, scene.flight.wind);
}

/** Ball position at time `t` seconds after impact. */
export function ballAt(flight: FlightResult, t: number): Vec3 {
  const pts = t <= flight.flightTime ? flight.air : flight.roll;
  if (t <= pts[0]!.t) return pts[0]!.p;
  for (let i = 1; i < pts.length; i++) {
    const b = pts[i]!;
    if (t <= b.t) {
      const a = pts[i - 1]!;
      const f = (t - a.t) / Math.max(b.t - a.t, 1e-9);
      return add(a.p, scale(sub(b.p, a.p), f));
    }
  }
  return flight.rest;
}

/** Full path (air then roll) as points, optionally cut off at time `t`. */
export function flightPath(flight: FlightResult, t = Infinity): Vec3[] {
  const all = [...flight.air, ...flight.roll.slice(1)];
  const out = all.filter((pt) => pt.t <= t).map((pt) => pt.p);
  if (t < flight.duration) out.push(ballAt(flight, t));
  return out;
}
