/**
 * Scene → flat list of 2D shapes. Pure TypeScript with no DOM, so the same output can be drawn
 * with React DOM <svg> on the web and react-native-svg in the app.
 */
import { handedScene } from "../core/handedness.ts";
import { cameraPreset, handed, handedCamera, projector, type Camera } from "../core/camera.ts";
import { describeScene } from "../core/describe.ts";
import { BALL_RADIUS } from "../core/clubs.ts";
import {
  ballAt,
  computeFlight,
  flightPath,
  windVector,
  type FlightResult,
} from "../core/flight.ts";
import { BONES, poseGolfer, type Joint } from "../core/pose.ts";
import type { CameraPreset, ShotScene } from "../core/schema.ts";
import { groundHeight, groundNormal } from "../core/terrain.ts";
import { add, DEG, dot, normalize, rotate, scale, sub, type Vec3 } from "../core/vec.ts";

export interface Pt {
  x: number;
  y: number;
}

export type Shape =
  | {
      kind: "polygon";
      points: Pt[];
      fill: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
    }
  | {
      kind: "polyline";
      points: Pt[];
      stroke: string;
      strokeWidth: number;
      dash?: number[];
      opacity?: number;
      /** Draw an arrowhead at the last point. */
      arrow?: boolean;
    }
  | { kind: "circle"; c: Pt; r: number; fill: string; stroke?: string; strokeWidth?: number }
  | {
      kind: "text";
      at: Pt;
      text: string;
      size: number;
      fill: string;
      anchor: "start" | "middle" | "end";
      weight?: "normal" | "bold";
      /** Outline colour drawn behind the text for legibility in sunlight. */
      halo?: string;
    };

export interface Theme {
  sky: string;
  fairway: string;
  rough: string;
  sand: string;
  green: string;
  skin: string;
  shirt: string;
  trousers: string;
  shoes: string;
  shaft: string;
  clubhead: string;
  ball: string;
  flight: string;
  annotation: string;
  aim: string;
  label: string;
  halo: string;
}

export const defaultTheme: Theme = {
  sky: "#dcecf7",
  fairway: "#6fa857",
  rough: "#4c7f3a",
  sand: "#e3cf9a",
  green: "#82bf63",
  skin: "#e2b48f",
  shirt: "#1f5f99",
  trousers: "#3b3f46",
  shoes: "#f4f4f4",
  shaft: "#55595f",
  clubhead: "#2b2d31",
  ball: "#ffffff",
  flight: "#d9480f",
  annotation: "#ffffff",
  aim: "#ffd43b",
  label: "#111111",
  halo: "#ffffff",
};

export interface Shapes2DOptions {
  view?: CameraPreset;
  /** Swing phase for the golfer (0 address … 1 finish). Default 0. */
  phase?: number;
  /** Seconds since impact for the ball; Infinity draws the whole flight. Default Infinity. */
  ballTime?: number;
  width?: number;
  height?: number;
  theme?: Partial<Theme>;
  /** Precomputed flight, to avoid re-simulating on every animation frame. */
  flight?: FlightResult;
}

export interface Shapes2D {
  width: number;
  height: number;
  view: CameraPreset;
  shapes: Shape[];
  title: string;
  description: string;
}

const LIMB_WIDTH: Partial<Record<Joint, number>> = {
  leadKnee: 0.13,
  trailKnee: 0.13,
  leadHip: 0.15,
  trailHip: 0.15,
  leadElbow: 0.085,
  trailElbow: 0.085,
};

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`;
}

/** Ground sample positions along one axis: fine near the ball, coarse further out. */
function samples(min: number, max: number, fine: number): number[] {
  const out = new Set<number>();
  for (let v = Math.max(min, -6); v <= Math.min(max, 6); v += fine)
    out.add(Math.round(v * 100) / 100);
  const coarse = Math.max(2, (max - min) / 24);
  for (let v = min; v <= max; v += coarse) if (v < -6 || v > 6) out.add(Math.round(v * 100) / 100);
  out.add(min);
  out.add(max);
  return [...out].sort((a, b) => a - b);
}

/** Sideways exaggeration in the overhead view, so draws and fades read at a glance. */
export const OVERHEAD_SIDEWAYS_STRETCH = 4;

export function buildShapes2D(input: ShotScene, options: Shapes2DOptions = {}): Shapes2D {
  const scene = handedScene(input);
  const view = options.view ?? scene.camera;
  const width = options.width ?? 480;
  const height = options.height ?? 360;
  const theme = { ...defaultTheme, ...options.theme };
  const flight = options.flight ?? computeFlight(scene);
  const ballTime = options.ballTime ?? Infinity;
  const cam: Camera = handedCamera(scene, cameraPreset(view, flight));
  const proj = projector(cam);
  const half = height / 2;
  // Overhead, a few metres of curve over 150 m is invisible at true scale, so stretch sideways.
  const stretchX = view === "overhead" ? OVERHEAD_SIDEWAYS_STRETCH : 1;
  const toScreen = (p: Vec3): (Pt & { depth: number }) | null => {
    const s = proj.project(handed(scene, p));
    return (
      s && { x: width / 2 + s.x * half * stretchX, y: height / 2 + s.y * half, depth: s.depth }
    );
  };
  const focalPx = half / Math.tan((cam.fov * Math.PI) / 360);
  const shapes: Shape[] = [{ kind: "polygon", points: rect(width, height), fill: theme.sky }];
  const golferView = view === "face-on" || view === "down-the-line";
  const reach = Math.max(25, Math.hypot(flight.rest[0], flight.rest[2]));

  // Ground: shaded quads, painted far to near. Shading shows the slope.
  const xs = golferView ? samples(-6, 200, 0.5) : samples(-11, reach * 1.25, 1);
  const zs = golferView ? samples(-40, 4.2, 0.5) : samples(-reach * 0.6, reach * 0.6, 1);
  const light = normalize([-0.4, 1, 0.6]);
  const cells: { depth: number; shape: Shape }[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i]!,
        x1 = xs[i + 1]!,
        z0 = zs[j]!,
        z1 = zs[j + 1]!;
      const corners = [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ].map(([x, z]) => toScreen([x!, groundHeight(scene.terrain, x!, z!), z!]));
      if (corners.some((c) => c === null)) continue;
      const cx = (x0 + x1) / 2,
        cz = (z0 + z1) / 2;
      const n = groundNormal(scene.terrain, cx, cz);
      const base = lieColour(scene, theme, cx, cz);
      const fill = shade(base, 0.72 + 0.32 * Math.max(0, dot(n, light)));
      const pts = corners as (Pt & { depth: number })[];
      cells.push({
        depth: Math.max(...pts.map((p) => p.depth)),
        shape: {
          kind: "polygon",
          points: pts.map(({ x, y }) => ({ x, y })),
          fill,
          stroke: fill,
          strokeWidth: 0.6,
        },
      });
    }
  }
  cells.sort((a, b) => b.depth - a.depth).forEach((c) => shapes.push(c.shape));

  const labels: Shape[] = [];
  const label = (
    at: Pt | null,
    text: string,
    anchor: "start" | "middle" | "end" = "start",
    dy = 0,
  ) => {
    if (!at) return;
    // Keep labels inside the frame; a rough width estimate is enough to flip the anchor.
    const w = text.length * 7.2;
    let x = Math.min(width - 6, Math.max(6, at.x));
    if (anchor === "start" && x + w > width - 6) anchor = "end";
    if (anchor === "end" && x - w < 6) anchor = "start";
    if (anchor === "middle") x = Math.min(width - 6 - w / 2, Math.max(6 + w / 2, x));
    const y = Math.min(height - 8, Math.max(18, at.y + dy));
    labels.push({
      kind: "text",
      at: { x, y },
      text,
      size: 13,
      fill: theme.label,
      anchor,
      weight: "bold",
      halo: theme.halo,
    });
  };
  const line = (pts: Vec3[], stroke: string, w: number, dash?: number[], arrow = false): Pt[] => {
    const screen = pts.map(toScreen).filter((p): p is Pt & { depth: number } => p !== null);
    if (screen.length > 1)
      shapes.push({ kind: "polyline", points: screen, stroke, strokeWidth: w, dash, arrow });
    return screen;
  };
  const onGround = (x: number, z: number): Vec3 => [x, groundHeight(scene.terrain, x, z) + 0.01, z];
  const groundLine = (from: Vec3, dir: Vec3, len: number, steps = 24): Vec3[] =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const p = add(from, scale(dir, (len * i) / steps));
      return onGround(p[0], p[2]);
    });

  // Annotations under the golfer.
  const lineLength = golferView ? 6 : reach;
  for (const a of scene.annotations) {
    if (a.type === "target-line") {
      const pts = line(groundLine([0, 0, 0], [1, 0, 0], lineLength), theme.annotation, 2, [8, 6]);
      label(pts[pts.length - 1] ?? null, a.label ?? "Target line", "end", -8);
    } else if (a.type === "aim-line") {
      const dir = rotate([1, 0, 0], [0, 1, 0], -scene.golfer.aim * DEG);
      const pts = line(groundLine([0, 0, 0], dir, lineLength), theme.aim, 2.5, [8, 6]);
      label(pts[pts.length - 1] ?? null, a.label ?? "Aim", "end", 18);
    } else if (a.type === "slope-line" && view !== "overhead") {
      const { slopeAlong, slopeAcross } = scene.terrain;
      const across =
        view === "down-the-line" ||
        (view === "behind" && Math.abs(slopeAcross) > Math.abs(slopeAlong));
      // The slope this view shows is level: nothing to point out.
      if (Math.round(Math.abs(across ? slopeAcross : slopeAlong)) === 0) continue;
      const dir: Vec3 = across ? [0, 0, 1] : [1, 0, 0];
      const pts = line(
        groundLine(scale(dir, -2.5), dir, 5, 10),
        theme.annotation,
        3,
        undefined,
        true,
      );
      label(pts[Math.floor(pts.length * 0.8)] ?? null, a.label ?? "Slope", "start", 22);
    }
  }

  // Golfer, club and ball, depth-sorted together.
  const pose = poseGolfer(scene, options.phase ?? 0);
  const items: { depth: number; shape: Shape }[] = [];
  const j = pose.joints;
  const push = (pts: Vec3[], shape: (s: Pt[]) => Shape) => {
    const s = pts.map(toScreen);
    if (s.some((p) => p === null)) return;
    const ok = s as (Pt & { depth: number })[];
    items.push({
      depth: ok.reduce((sum, p) => sum + p.depth, 0) / ok.length,
      shape: shape(ok.map(({ x, y }) => ({ x, y }))),
    });
  };
  const px = (metres: number, at: Vec3) => {
    const s = toScreen(at);
    return s ? (metres * focalPx) / s.depth : 0;
  };

  push([j.leadShoulder, j.trailShoulder, j.trailHip, j.leadHip], (pts) => ({
    kind: "polygon",
    points: pts,
    fill: theme.shirt,
    stroke: theme.shirt,
    strokeWidth: px(0.12, j.neck),
    opacity: 1,
  }));
  for (const [a, b] of BONES) {
    if (
      (a === "leadShoulder" && b === "trailShoulder") ||
      (a === "leadHip" && b === "trailHip") ||
      a === "pelvis"
    )
      continue;
    const isArm = b.includes("Elbow") || b.includes("Hand");
    const isFoot = b.includes("Toe");
    const colour = isFoot
      ? theme.shoes
      : isArm
        ? b.includes("Hand")
          ? theme.skin
          : theme.shirt
        : theme.trousers;
    const widthM = LIMB_WIDTH[b] ?? (isFoot ? 0.08 : isArm ? 0.075 : 0.11);
    const mid = scale(add(j[a], j[b]), 0.5);
    push([j[a], j[b]], (pts) => ({
      kind: "polyline",
      points: pts,
      stroke: colour,
      strokeWidth: px(widthM, mid),
    }));
  }
  push([j.neck, j.head], (pts) => ({
    kind: "polyline",
    points: pts,
    stroke: theme.skin,
    strokeWidth: px(0.09, j.neck),
  }));
  const headScreen = toScreen(j.head);
  if (headScreen) {
    items.push({
      depth: headScreen.depth,
      shape: { kind: "circle", c: headScreen, r: px(pose.headRadius, j.head), fill: theme.skin },
    });
  }
  push([j.leadHand, j.trailHand], (pts) => ({
    kind: "polyline",
    points: pts,
    stroke: theme.skin,
    strokeWidth: px(0.07, j.leadHand),
  }));
  push([pose.club.grip, pose.club.hosel], (pts) => ({
    kind: "polyline",
    points: pts,
    stroke: theme.shaft,
    strokeWidth: Math.max(1.2, px(0.014, pose.club.hosel)),
  }));
  push([pose.club.hosel, pose.club.toe], (pts) => ({
    kind: "polyline",
    points: pts,
    stroke: theme.clubhead,
    strokeWidth: Math.max(2, px(0.045, pose.club.hosel)),
  }));

  // Flight path and ball. Face-on the path passes between camera and golfer; in the other views
  // it heads away from the camera, so it is painted behind the golfer.
  const ball = ballTime < 0 ? flight.air[0]!.p : ballAt(flight, ballTime);
  const ballScreen = toScreen(ball);
  if (ballScreen) {
    items.push({
      depth: ballScreen.depth - 0.05,
      shape: {
        kind: "circle",
        c: ballScreen,
        r: Math.max(2.5, px(BALL_RADIUS, ball)),
        fill: theme.ball,
        stroke: "#333",
        strokeWidth: 0.8,
      },
    });
  }
  // Golfer views show the launch only (up to the apex); the descent would fold back over it.
  const apexTime = flight.air.find((pt) => pt.p === flight.apex)?.t ?? flight.flightTime;
  const pathEnd = golferView ? Math.min(ballTime, apexTime) : ballTime;
  const pathScreen =
    ballTime > 0
      ? flightPath(flight, pathEnd)
          .map(toScreen)
          .filter((p): p is Pt & { depth: number } => p !== null)
      : [];
  const pathShape: Shape | null =
    pathScreen.length > 1
      ? {
          kind: "polyline",
          points: pathScreen.map(({ x, y }) => ({ x, y })),
          stroke: theme.flight,
          strokeWidth: golferView ? 2.5 : 3,
        }
      : null;
  if (pathShape && view !== "face-on") shapes.push(pathShape);
  items.sort((a, b) => b.depth - a.depth).forEach((i) => shapes.push(i.shape));
  if (pathShape && view === "face-on") shapes.push(pathShape);

  const flightNote = scene.annotations.find((a) => a.type === "ball-flight");
  // Golfer views crop the flight at the apex, so the label only fits the ball-flight views.
  if (flightNote?.label && !golferView && ballTime > flight.flightTime / 2) {
    label(toScreen(flight.apex), flightNote.label, "middle", -10);
  }
  const shoulders = scene.annotations.find((a) => a.type === "shoulder-line");
  if (shoulders && golferView) {
    const dir = normalize(sub(j.leadShoulder, j.trailShoulder));
    const pts = line(
      [add(j.trailShoulder, scale(dir, -0.35)), add(j.leadShoulder, scale(dir, 0.35))],
      theme.aim,
      2.5,
      [6, 4],
    );
    label(pts[pts.length - 1] ?? null, shoulders.label ?? "Shoulders", "start", -6);
  }
  for (const a of scene.annotations) {
    if (a.type !== "arrow") continue;
    const pts = line([a.from, a.to], theme.aim, 2.5, undefined, true);
    if (a.label) label(pts[pts.length - 1] ?? null, a.label, "start", -6);
  }

  // Wind: a screen-space arrow in the corner.
  const wind = scene.flight.wind;
  if (wind && wind.speed > 0) {
    const w = normalize(windVector(wind));
    // Measure the direction on the ground: projecting at height would let perspective flip it.
    const origin: Vec3 = golferView ? [0, 0, 0] : [reach * 0.3, 0, 0];
    const a = toScreen(origin);
    const b = toScreen(add(origin, scale(w, golferView ? 1 : reach * 0.05)));
    const mph = Math.round(wind.speed * 2.237);
    let dir = a && b ? normalize([b.x - a.x, b.y - a.y, 0]) : ([0, 0, 0] as Vec3);
    const flat = Math.hypot(dir[0], dir[1]) < 0.5 || !a || !b;
    const anchor: Pt = { x: 54, y: 34 };
    if (flat) dir = [0, 0, 0];
    if (!flat) {
      shapes.push({
        kind: "polyline",
        points: [
          { x: anchor.x - dir[0] * 22, y: anchor.y - dir[1] * 22 },
          { x: anchor.x + dir[0] * 22, y: anchor.y + dir[1] * 22 },
        ],
        stroke: theme.label,
        strokeWidth: 3,
        arrow: true,
      });
    }
    label({ x: anchor.x, y: anchor.y + 30 }, `Wind ${mph} mph`, "middle");
  }

  shapes.push(...labels);
  const description = describeScene(scene, view);
  return { width, height, view, shapes, title: scene.title, description };
}

function rect(w: number, h: number): Pt[] {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

function lieColour(scene: ShotScene, theme: Theme, x: number, z: number): string {
  const lie = scene.terrain.lie;
  const nearBall = Math.hypot(x, z) < 2.2;
  if (nearBall && lie === "bunker") return theme.sand;
  if (nearBall && lie === "rough") return theme.rough;
  if (nearBall && (lie === "green" || lie === "fringe")) return theme.green;
  // Rough either side of a 30 m wide fairway.
  return Math.abs(z) > 15 ? theme.rough : theme.fairway;
}

/** Triangle for an arrowhead at the end of a polyline, in screen space. */
export function arrowHead(points: Pt[], size = 10): Pt[] | null {
  const b = points[points.length - 1];
  const a = points[points.length - 2];
  if (!a || !b) return null;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len === 0) return null;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return [
    { x: b.x + ux * size * 0.4, y: b.y + uy * size * 0.4 },
    { x: b.x - ux * size * 0.6 - uy * size * 0.45, y: b.y - uy * size * 0.6 + ux * size * 0.45 },
    { x: b.x - ux * size * 0.6 + uy * size * 0.45, y: b.y - uy * size * 0.6 - ux * size * 0.45 },
  ];
}
