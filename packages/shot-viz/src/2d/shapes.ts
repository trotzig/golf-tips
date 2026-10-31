/**
 * Scene → flat list of 2D shapes. Pure TypeScript with no DOM, so the same output can be drawn
 * with React DOM <svg> on the web and react-native-svg in the app.
 */
import { handedScene } from "../core/handedness.ts";
import {
  blendCameras,
  cameraPreset,
  followCamera,
  handed,
  handedCamera,
  projector,
  type Camera,
} from "../core/camera.ts";
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
import { windSpeedText, type WindUnit } from "../core/units.ts";
import {
  add,
  cross,
  DEG,
  dot,
  mix,
  normalize,
  rotate,
  scale,
  smoothstep,
  sub,
  type Vec3,
} from "../core/vec.ts";

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
      /** The text in each wind unit, when it shows a wind speed (`text` is the mph one). */
      wind?: Record<WindUnit, string>;
    };

export interface Theme {
  sky: string;
  fairway: string;
  rough: string;
  sand: string;
  green: string;
  skin: string;
  hair: string;
  visor: string;
  shirt: string;
  trousers: string;
  shoes: string;
  soles: string;
  shaft: string;
  clubhead: string;
  ball: string;
  flight: string;
  annotation: string;
  aim: string;
  label: string;
  halo: string;
}

// Muted course greens around the site's accent green (`--color-accent`), with its red
// (`--color-highlight`) kept for the ball flight, the one highlight.
export const defaultTheme: Theme = {
  sky: "#e1eeee",
  fairway: "#74a86c",
  rough: "#4f8455",
  sand: "#e8d6a8",
  green: "#8cc583",
  skin: "#e0b18e",
  hair: "#4a3326",
  visor: "#0f7a4a",
  shirt: "#24405e",
  trousers: "#cdbf9f",
  shoes: "#ffffff",
  soles: "#3f4341",
  shaft: "#5d6360",
  clubhead: "#1d211f",
  ball: "#ffffff",
  flight: "#c63823",
  annotation: "#ffffff",
  aim: "#ffd43b",
  label: "#1d211f",
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

/** Seconds after impact over which the golfer views pull back to show the whole flight. */
export const FOLLOW_TIME = 1.2;

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
  const golferView = view === "face-on" || view === "down-the-line";
  // While the ball flies, golfer views ease back to a wide shot of the whole flight. A still
  // diagram (ballTime Infinity) keeps the close framing of the setup.
  const follow =
    golferView && Number.isFinite(ballTime) && ballTime > 0
      ? smoothstep(ballTime / FOLLOW_TIME)
      : 0;
  const preset = cameraPreset(view, flight);
  // Scenes about where to aim pull back behind the ball, where aim and curve show.
  const downRange = scene.annotations.some((a) => a.type === "aim-line" || a.type === "start-line");
  const cam: Camera = handedCamera(
    scene,
    follow > 0 && golferView
      ? blendCameras(
          preset,
          followCamera(view, flight, width / height, downRange),
          follow,
          downRange,
        )
      : preset,
  );
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
  const reach = Math.max(25, Math.hypot(flight.rest[0], flight.rest[2]));

  // Ground: shaded quads, painted far to near. Shading shows the slope.
  // The wide shot sees more ground: behind the golfer and out to where the ball stops.
  const xs = golferView
    ? samples(follow > 0 ? (downRange ? -36 : -12) : -6, Math.max(200, reach * 1.25), 0.5)
    : samples(-11, reach * 1.25, 1);
  const zs = golferView
    ? samples(-40, follow > 0 ? 10 : 4.2, 0.5)
    : samples(-reach * 0.6, reach * 0.6, 1);
  const light = normalize([-0.4, 1, 0.6]);
  const cells: { depth: number; shape: Shape }[] = [];
  const groundAt = (x: number, z: number): Vec3 => [x, groundHeight(scene.terrain, x, z), z];
  // Cut a ground cell off where it passes behind the camera, rather than dropping it: a camera
  // pulled back over the ground stands on cells that reach past it.
  const forward = normalize(sub(cam.target, cam.position));
  const depthOf = (p: Vec3) => dot(sub(handed(scene, p), cam.position), forward);
  const NEAR = 0.1;
  const clipNear = (pts: Vec3[]): Vec3[] =>
    pts.flatMap((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      const da = depthOf(a) - NEAR;
      const db = depthOf(b) - NEAR;
      const out: Vec3[] = da >= 0 ? [a] : [];
      if (da >= 0 !== db >= 0) out.push(add(a, scale(sub(b, a), da / (da - db))));
      return out;
    });
  // A strip across the target line is drawn as few quads as possible: neighbouring cells with
  // the same shade lie in one plane, so they merge into one polygon. Keeps the SVG small.
  const pushQuad = (x0: number, x1: number, z0: number, z1: number, fill: string) => {
    let world = [groundAt(x0, z0), groundAt(x1, z0), groundAt(x1, z1), groundAt(x0, z1)];
    if (world.some((p) => depthOf(p) < NEAR)) world = clipNear(world);
    const corners = world.map(toScreen);
    if (corners.length < 3 || corners.some((c) => c === null)) return;
    const pts = corners as (Pt & { depth: number })[];
    const outside =
      pts.every((p) => p.x < 0) ||
      pts.every((p) => p.x > width) ||
      pts.every((p) => p.y < 0) ||
      pts.every((p) => p.y > height);
    if (outside || polygonArea(pts) < 0.5) return;
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
  };
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i]!,
      x1 = xs[i + 1]!;
    let run: { z0: number; z1: number; fill: string } | null = null;
    for (let j = 0; j < zs.length - 1; j++) {
      const z0 = zs[j]!,
        z1 = zs[j + 1]!;
      const cx = (x0 + x1) / 2,
        cz = (z0 + z1) / 2;
      const n = groundNormal(scene.terrain, cx, cz);
      const base = lieColour(scene, theme, cx, cz);
      const fill = shade(base, 0.72 + 0.32 * Math.max(0, dot(n, light)));
      if (run && run.fill === fill) {
        run.z1 = z1;
        continue;
      }
      if (run) pushQuad(x0, x1, run.z0, run.z1, run.fill);
      run = { z0, z1, fill };
    }
    if (run) pushQuad(x0, x1, run.z0, run.z1, run.fill);
  }
  cells.sort((a, b) => b.depth - a.depth).forEach((c) => shapes.push(c.shape));

  const labels: Shape[] = [];
  const boxes: { x0: number; x1: number; y: number }[] = [];
  const label = (
    at: Pt | null,
    text: string,
    anchor: "start" | "middle" | "end" = "start",
    dy = 0,
    wind?: Record<WindUnit, string>,
  ) => {
    if (!at) return;
    // Keep labels inside the frame; a rough width estimate is enough to flip the anchor.
    const w = Math.max(text.length, ...Object.values(wind ?? {}).map((t) => t.length)) * 7.2;
    let x = Math.min(width - 6, Math.max(6, at.x));
    if (anchor === "start" && x + w > width - 6) anchor = "end";
    if (anchor === "end" && x - w < 6) anchor = "start";
    if (anchor === "middle") x = Math.min(width - 6 - w / 2, Math.max(6 + w / 2, x));
    const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
    const fit = (y: number) => Math.min(height - 8, Math.max(18, y));
    // Step clear of labels already placed (lines that meet, or several pinned to an edge).
    const clashes = (y: number) =>
      boxes.some((b) => Math.abs(b.y - y) < 15 && b.x0 < x0 + w && x0 < b.x1);
    const y0 = fit(at.y + dy);
    let y = y0;
    for (const step of [16, -16, 32, -32, 48, -48]) {
      if (!clashes(y)) break;
      y = fit(y0 + step);
    }
    boxes.push({ x0, x1: x0 + w, y });
    labels.push({
      kind: "text",
      at: { x, y },
      text,
      size: 13,
      fill: theme.label,
      anchor,
      weight: "bold",
      halo: theme.halo,
      ...(wind && { wind }),
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

  // Annotations under the golfer. Golfer views start with short lines at the feet and stretch
  // them out to the target as the camera pulls back, so aim and start line read against it.
  const lineLength = golferView ? mix(6, reach, follow) : reach;
  const aimDir = rotate([1, 0, 0], [0, 1, 0], -scene.golfer.aim * DEG);
  const startDir = rotate([1, 0, 0], [0, 1, 0], -flight.launch.direction * DEG);
  // In the wide shot the lines meet near the horizon: put the aim and start-line labels on the
  // side their lines lean to and the target's on the other, so they don't pile up.
  const far = (dir: Vec3) => toScreen(onGround(dir[0] * lineLength, dir[2] * lineLength));
  const targetFar = far([1, 0, 0]);
  const aimFar = far(aimDir);
  const leans = (p: Pt | null): "start" | "end" | null =>
    follow > 0 && p && targetFar && Math.abs(p.x - targetFar.x) > 1
      ? p.x > targetFar.x
        ? "start"
        : "end"
      : null;
  const aimSide = scene.golfer.aim !== 0 ? leans(aimFar) : null;
  for (const a of scene.annotations) {
    if (a.type === "target-line") {
      const pts = line(groundLine([0, 0, 0], [1, 0, 0], lineLength), theme.annotation, 2, [8, 6]);
      const side = aimSide && (aimSide === "start" ? "end" : "start");
      label(pts[pts.length - 1] ?? null, a.label ?? "Target line", side ?? "end", -8);
    } else if (a.type === "aim-line") {
      const pts = line(groundLine([0, 0, 0], aimDir, lineLength), theme.aim, 2.5, [8, 6]);
      label(pts[pts.length - 1] ?? null, a.label ?? "Aim", aimSide ?? "end", aimSide ? 0 : 18);
    } else if (a.type === "start-line") {
      // Where the ball starts: the face at impact, before spin curves it.
      const pts = line(groundLine([0, 0, 0], startDir, lineLength), theme.flight, 2, [3, 5]);
      const at = pts[Math.floor(pts.length * 0.6)] ?? null;
      const side = leans(at);
      label(at, a.label ?? "Start line", side ?? "middle", 18);
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
      if (follow < 0.5)
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

  const pushAt = (at: Vec3, nudge: number, shape: (c: Pt & { depth: number }) => Shape | null) => {
    const c = toScreen(at);
    const sh = c && shape(c);
    if (c && sh) items.push({ depth: c.depth + nudge, shape: sh });
  };

  // Torso: a shirt panel from the shoulders to the hips, with a thick round-capped line across
  // the shoulders on top so they come out rounded rather than as the panel's corners.
  const towardNeck = (p: Vec3) => mix3(p, j.neck, 0.3);
  push([towardNeck(j.leadShoulder), towardNeck(j.trailShoulder), j.trailHip, j.leadHip], (pts) => ({
    kind: "polygon",
    points: pts,
    fill: theme.shirt,
    stroke: theme.shirt,
    strokeWidth: px(0.13, j.neck),
  }));
  const shoulderMid = scale(add(j.leadShoulder, j.trailShoulder), 0.5);
  pushAt(shoulderMid, -0.001, () => {
    const pts = [j.trailShoulder, j.leadShoulder].map((p) => toScreen(mix3(p, j.neck, 0.08)));
    if (pts.some((p) => p === null)) return null;
    return {
      kind: "polyline",
      points: (pts as Pt[]).map(({ x, y }) => ({ x, y })),
      stroke: theme.shirt,
      strokeWidth: px(0.11, shoulderMid),
    };
  });
  for (const [a, b] of BONES) {
    if (
      (a === "leadShoulder" && b === "trailShoulder") ||
      (a === "leadHip" && b === "trailHip") ||
      a === "pelvis" ||
      b.includes("Toe")
    )
      continue;
    const isArm = b.includes("Elbow") || b.includes("Hand");
    const colour = isArm ? (b.includes("Hand") ? theme.skin : theme.shirt) : theme.trousers;
    const widthM = LIMB_WIDTH[b] ?? (isArm ? 0.075 : 0.11);
    const mid = scale(add(j[a], j[b]), 0.5);
    push([j[a], j[b]], (pts) => ({
      kind: "polyline",
      points: pts,
      stroke: colour,
      strokeWidth: px(widthM, mid),
    }));
  }
  // Shoes: an upper from heel over the ankle to the toe, on a dark sole along the ground.
  for (const side of ["lead", "trail"] as const) {
    const ankle = j[`${side}Ankle`];
    const toe = j[`${side}Toe`];
    const along = normalize([toe[0] - ankle[0], 0, toe[2] - ankle[2]]);
    const atHeight = (p: Vec3, h: number): Vec3 => [
      p[0],
      groundHeight(scene.terrain, p[0], p[2]) + h,
      p[2],
    ];
    const heel = add(ankle, scale(along, -0.05));
    const tip = add(toe, scale(along, 0.02));
    const upper = [atHeight(heel, 0.04), atHeight(ankle, 0.06), atHeight(toe, 0.035)];
    const sole = [atHeight(heel, 0.018), atHeight(tip, 0.018)];
    const mid = scale(add(ankle, toe), 0.5);
    for (const [pts, colour, w, nudge] of [
      [sole, theme.soles, 0.05, 0.002],
      [upper, theme.shoes, 0.075, 0.001],
    ] as const) {
      pushAt(mid, nudge, () => {
        const s = pts.map(toScreen);
        if (s.some((p) => p === null)) return null;
        return {
          kind: "polyline",
          points: (s as Pt[]).map(({ x, y }) => ({ x, y })),
          stroke: colour,
          strokeWidth: px(w, mid),
        };
      });
    }
  }
  push([j.neck, j.head], (pts) => ({
    kind: "polyline",
    points: pts,
    stroke: theme.skin,
    strokeWidth: px(0.09, j.neck),
  }));
  const headParts = headShapes(
    j.head,
    j.neck,
    pose.face,
    pose.headRadius,
    px(pose.headRadius, j.head),
    toScreen,
    theme,
  );
  for (const { shape, nudge } of headParts) pushAt(j.head, nudge, () => shape);
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
  // (and face-on once the camera has swung round behind) it heads away from the camera, so it is
  // painted behind the golfer.
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
  // The tracer follows the ball all the way, like a TV shot tracer.
  const pathScreen =
    ballTime > 0
      ? flightPath(flight, ballTime)
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
  const pathInFront = view === "face-on" && follow < 0.5;
  if (pathShape && !pathInFront) shapes.push(pathShape);
  items.sort((a, b) => b.depth - a.depth).forEach((i) => shapes.push(i.shape));
  if (pathShape && pathInFront) shapes.push(pathShape);

  const flightNote = scene.annotations.find((a) => a.type === "ball-flight");
  // Golfer views show the apex only once they have pulled back to the wide shot.
  if (flightNote?.label && (!golferView || follow === 1) && ballTime > flight.flightTime / 2) {
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
    if (follow < 0.5)
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
    const speed = windSpeedText(wind.speed);
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
    label({ x: anchor.x, y: anchor.y + 30 }, `Wind ${speed.mph}`, "middle", 0, {
      mph: `Wind ${speed.mph}`,
      "m/s": `Wind ${speed["m/s"]}`,
    });
  }

  shapes.push(...labels);
  const description = describeScene(scene, view);
  return { width, height, view, shapes, title: scene.title, description };
}

const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => add(scale(a, 1 - t), scale(b, t));

/**
 * The head, seen from the camera: skin, hair over the top and back, and a visor (a band round
 * the forehead with a brim). Worked out on a unit sphere in camera space (x right, y down,
 * z toward the camera) and drawn orthographically around the head's centre, close enough at
 * head size. `nudge` keeps the parts in order when depth-sorted with the body.
 */
function headShapes(
  head: Vec3,
  neck: Vec3,
  face: Vec3,
  radius: number,
  rho: number,
  toScreen: (p: Vec3) => (Pt & { depth: number }) | null,
  theme: Theme,
): { shape: Shape; nudge: number }[] {
  const c = toScreen(head);
  if (!c || rho <= 0) return [];
  const eps = radius * 0.1;
  const perM = rho / radius;
  // A world direction in camera space, from how a short step along it projects.
  const camDir = (d: Vec3): Vec3 | null => {
    const s = toScreen(add(head, scale(d, eps)));
    if (!s) return null;
    return normalize([
      (s.x - c.x) / (perM * eps),
      (s.y - c.y) / (perM * eps),
      (c.depth - s.depth) / eps,
    ]);
  };
  const up = camDir(normalize(sub(head, neck)));
  const look = camDir(normalize(sub(face, head)));
  if (!up || !look) return [];
  const fwd = normalize(sub(look, scale(up, dot(look, up))));
  const side = cross(up, fwd);
  const at = (v: Vec3): Pt => ({ x: c.x + rho * v[0], y: c.y + rho * v[1] });
  const out: { shape: Shape; nudge: number }[] = [
    { shape: { kind: "circle", c: { x: c.x, y: c.y }, r: rho, fill: theme.skin }, nudge: 0 },
  ];

  const hair = sphereCap(normalize(sub(up, scale(fwd, 0.8))), 0.1);
  if (hair.length > 2)
    out.push({
      shape: { kind: "polygon", points: hair.map(at), fill: theme.hair },
      nudge: -0.0005,
    });

  // Visor band: round the front and sides of the head, a little above its middle.
  const ring = (u: number, r: number): Vec3 =>
    add(scale(up, 0.45), add(scale(fwd, r * Math.cos(u)), scale(side, r * Math.sin(u))));
  const band: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const p = ring(((i / 16) * 2 - 1) * 1.7, 0.92);
    if (p[2] >= 0) band.push(at(p));
  }
  if (band.length > 1)
    out.push({
      shape: { kind: "polyline", points: band, stroke: theme.visor, strokeWidth: rho * 0.2 },
      nudge: -0.0007,
    });
  // Brim: from temple to temple, out past the forehead and dipping a little.
  const brim: Vec3[] = [];
  for (let i = 0; i <= 8; i++) brim.push(ring(((i / 8) * 2 - 1) * (Math.PI / 2), 0.92));
  for (let i = 8; i >= 0; i--) {
    const u = ((i / 8) * 2 - 1) * (Math.PI / 2);
    const cu = Math.cos(u);
    brim.push(
      add(add(scale(up, 0.45 - 0.08 * cu), scale(fwd, 1.25 * cu)), scale(side, 0.92 * Math.sin(u))),
    );
  }
  const tip = add(scale(up, 0.37), scale(fwd, 1.25));
  out.push({
    shape: {
      kind: "polygon",
      points: brim.map(at),
      fill: theme.visor,
      stroke: theme.visor,
      strokeWidth: rho * 0.08,
    },
    nudge: tip[2] >= 0 ? -0.0009 : 0.0005,
  });
  return out;
}

/**
 * Outline, on a unit sphere seen from +z, of the visible part of the cap where a point's
 * direction `n` has `n · axis > k`: the cap's rim where it faces the camera, closed along
 * the sphere's silhouette.
 */
function sphereCap(axis: Vec3, k: number): Vec3[] {
  const helper: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const p = normalize(cross(axis, helper));
  const q = cross(axis, p);
  const rr = Math.sqrt(1 - k * k);
  const N = 32;
  const rim = Array.from({ length: N }, (_, i): Vec3 => {
    const u = (i / N) * 2 * Math.PI;
    return add(scale(axis, k), add(scale(p, rr * Math.cos(u)), scale(q, rr * Math.sin(u))));
  });
  const seen = rim.map((v) => v[2] >= 0);
  if (seen.every(Boolean)) return rim;
  const start = seen.findIndex((v, i) => v && !seen[(i + N - 1) % N]);
  if (start < 0) return [];
  // Where the rim crosses the silhouette (z = 0), between a hidden and a visible point.
  const onEdge = (a: Vec3, b: Vec3): Vec3 => {
    const t = a[2] / (a[2] - b[2]);
    const v = add(a, scale(sub(b, a), t));
    const l = Math.hypot(v[0], v[1]) || 1;
    return [v[0] / l, v[1] / l, 0];
  };
  const out: Vec3[] = [onEdge(rim[(start + N - 1) % N]!, rim[start]!)];
  let i = start;
  while (seen[i % N]) out.push(rim[i++ % N]!);
  out.push(onEdge(rim[i % N]!, rim[(i + N - 1) % N]!));
  // Back along the silhouette, through the side the cap is on.
  const from = Math.atan2(out[out.length - 1]![1], out[out.length - 1]![0]);
  const to = Math.atan2(out[0]![1], out[0]![0]);
  let delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const mid = from + delta / 2;
  if (Math.cos(mid) * axis[0] + Math.sin(mid) * axis[1] < k)
    delta -= Math.sign(delta) * 2 * Math.PI;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 10)));
  for (let s = 1; s < steps; s++) {
    const a = from + (delta * s) / steps;
    out.push([Math.cos(a), Math.sin(a), 0]);
  }
  return out;
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

function polygonArea(points: Pt[]): number {
  let sum = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]!;
    sum += p.x * q.y - q.x * p.y;
  });
  return Math.abs(sum) / 2;
}
