import type { FlightResult } from "./flight.ts";
import type { CameraPreset, ShotScene } from "./schema.ts";
import { cross, dot, normalize, sub, type Vec3 } from "./vec.ts";

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
