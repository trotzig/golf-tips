import type { FlightResult } from "./flight.ts";
import type { CameraPreset, ShotScene } from "./schema.ts";
import {
  add,
  clamp,
  cross,
  dot,
  length,
  lerp,
  mix,
  normalize,
  scale,
  sub,
  type Vec3,
} from "./vec.ts";

export interface Camera {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  /** Vertical field of view, degrees. */
  fov: number;
}

/**
 * Named camera presets in the right-handed world frame. Face-on and down-the-line frame the
 * golfer; behind and overhead frame the whole ball flight.
 */
export function cameraPreset(preset: CameraPreset, flight: FlightResult): Camera {
  const rest = flight.rest;
  const reach = Math.max(20, Math.hypot(rest[0], rest[2]));
  switch (preset) {
    case "face-on":
      return { position: [-0.1, 0.95, 4.6], target: [-0.1, 0.8, -0.45], up: [0, 1, 0], fov: 32 };
    case "down-the-line":
      return { position: [-4.6, 1.25, -0.35], target: [0, 0.75, -0.35], up: [0, 1, 0], fov: 32 };
    case "behind": {
      // Slightly to the golfer's side, like a TV tracer shot, so height and curve both show.
      const target: Vec3 = [reach * 0.4, Math.max(2, flight.apex[1] * 0.4), rest[2] * 0.4];
      return { position: [-13, 3.2, -3.5], target, up: [0, 1, 0], fov: 45 };
    }
    case "overhead": {
      const mid: Vec3 = [reach * 0.5, 0, rest[2] * 0.5];
      return { position: [mid[0], reach * 1.15, mid[2]], target: mid, up: [1, 0, 0], fov: 50 };
    }
  }
}

/** Where each golfer view pulls back to once the ball is in the air (right-handed frame). */
const FOLLOW_POSITION: Record<"face-on" | "down-the-line", Vec3> = {
  // Behind and to the side of the golfer: a TV-style three-quarter view, so a full shot fits.
  "face-on": [-7, 2.4, 6.5],
  "down-the-line": [-9, 2, -0.35],
};

/** Behind the ball, looking down the target line: where aim, start line and curve read best. */
const DOWN_RANGE_POSITION: Vec3 = [-30, 7, -0.5];

/**
 * The wide shot a golfer view moves to during the flight: from a point further back, aimed and
 * zoomed so the golfer and the whole flight (air and roll) fit the frame. `aspect` is
 * width / height of the view. `downRange` pulls back behind the ball instead, for scenes about
 * where to aim.
 */
export function followCamera(
  preset: "face-on" | "down-the-line",
  flight: FlightResult,
  aspect = 4 / 3,
  downRange = false,
): Camera {
  const position = downRange ? DOWN_RANGE_POSITION : FOLLOW_POSITION[preset];
  const points: Vec3[] = [
    [-0.4, 0, -1.1],
    [0.4, 0, -1.1],
    [0, 1.9, -0.8],
    [0, 0, 0],
    ...flight.air.filter((_, i) => i % 10 === 0).map((pt) => pt.p),
    flight.apex,
    flight.landing,
    flight.rest,
  ];
  // Aim at the middle of the points' spread in yaw and pitch, then widen until they all fit.
  const angles = points.map((p) => {
    const d = sub(p, position);
    return { yaw: Math.atan2(d[2], d[0]), pitch: Math.atan2(d[1], Math.hypot(d[0], d[2])) };
  });
  const mid = (k: "yaw" | "pitch") => {
    const vs = angles.map((a) => a[k]);
    return (Math.min(...vs) + Math.max(...vs)) / 2;
  };
  const yaw = mid("yaw");
  const pitch = mid("pitch");
  const dir: Vec3 = [
    Math.cos(pitch) * Math.cos(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.sin(yaw),
  ];
  // Behind the ball the target is a real point down range, so a blend can slide toward it.
  const reach = downRange ? length(sub(flight.landing, position)) * 0.5 : 1;
  const cam: Camera = {
    position,
    target: add(position, scale(dir, reach)),
    up: [0, 1, 0],
    fov: 90,
  };
  const proj = projector(cam);
  let extent = 0;
  for (const p of points) {
    const s = proj.project(p);
    if (s) extent = Math.max(extent, Math.abs(s.y), Math.abs(s.x) / aspect);
  }
  // The projector above has a 90° fov, so screen units are tangents of the half-angle.
  const fov = (2 * Math.atan(extent * 1.12) * 180) / Math.PI;
  return { ...cam, fov: clamp(fov, 30, 75) };
}

/**
 * A camera part-way from `a` to `b` (k from 0 to 1), turning smoothly rather than cutting.
 * `byTarget` slides the look-at point from one target to the other instead of turning the view
 * direction, which keeps the ball in frame on a long move from the golfer to behind the ball.
 */
export function blendCameras(a: Camera, b: Camera, k: number, byTarget = false): Camera {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const position = lerp(a.position, b.position, k);
  if (byTarget)
    return { position, target: lerp(a.target, b.target, k), up: a.up, fov: mix(a.fov, b.fov, k) };
  const dir = normalize(
    lerp(normalize(sub(a.target, a.position)), normalize(sub(b.target, b.position)), k),
  );
  return { position, target: add(position, dir), up: a.up, fov: mix(a.fov, b.fov, k) };
}

/** Mirror a right-handed world point for a left-handed golfer (z → −z). */
export function handed(scene: Pick<ShotScene, "golfer">, p: Vec3): Vec3 {
  return scene.golfer.handedness === "left" ? [p[0], p[1], -p[2]] : p;
}

export function handedCamera(scene: Pick<ShotScene, "golfer">, cam: Camera): Camera {
  return {
    ...cam,
    position: handed(scene, cam.position),
    target: handed(scene, cam.target),
    up: handed(scene, cam.up),
  };
}

export interface Projector {
  /** Screen coordinates with y down, in units of the view's half-height (−1 … 1). Null if behind the camera. */
  project(p: Vec3): { x: number; y: number; depth: number } | null;
}

/** A pinhole projector. Pure maths, so the same code drives SVG on the web and in React Native. */
export function projector(cam: Camera): Projector {
  const f = normalize(sub(cam.target, cam.position));
  const r = normalize(cross(f, cam.up));
  const u = cross(r, f);
  const focal = 1 / Math.tan((cam.fov * Math.PI) / 360);
  return {
    project(p) {
      const d = sub(p, cam.position);
      const depth = dot(d, f);
      if (depth <= 0.05) return null;
      return { x: (dot(d, r) / depth) * focal, y: (-dot(d, u) / depth) * focal, depth };
    },
  };
}
