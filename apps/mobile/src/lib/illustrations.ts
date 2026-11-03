import type { FlightComparison, FlightResult, SwingLength } from "@shotbook/shot-viz";

// Geometry and wording for the illustrated sections of a situation screen, ported from the site's
// SetupGauges, SwingClock, FlightComparison and ClubLadder components. `mirror` draws for a
// left-hander. Pure, so it is tested without React Native.

export const round = (n: number) => Math.round(n * 10) / 10;

/** A shoe sole seen from above, toe at the top, centred on (cx, cy), `h` tall. */
export function footPath(cx: number, cy: number, h: number): string {
  const r = round;
  const w = h * 0.42;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  return [
    `M${r(cx)} ${r(top)}`,
    `C${r(cx + w * 0.62)} ${r(top)} ${r(cx + w * 0.55)} ${r(cy - h * 0.05)} ${r(cx + w * 0.36)} ${r(cy + h * 0.12)}`,
    `C${r(cx + w * 0.3)} ${r(cy + h * 0.25)} ${r(cx + w * 0.36)} ${r(bottom)} ${r(cx)} ${r(bottom)}`,
    `C${r(cx - w * 0.36)} ${r(bottom)} ${r(cx - w * 0.3)} ${r(cy + h * 0.25)} ${r(cx - w * 0.36)} ${r(cy + h * 0.12)}`,
    `C${r(cx - w * 0.55)} ${r(cy - h * 0.05)} ${r(cx - w * 0.62)} ${r(top)} ${r(cx)} ${r(top)}Z`,
  ].join(" ");
}

/** x for the lead side (−1) … trail side (1) of a box `width` wide, flipped for left-handers. */
export const side = (t: number, width: number, mirror: boolean) =>
  round(width / 2 + (mirror ? -t : t) * (width / 2));

/** A line through (65, cy) tilted `deg` with the lead end up, as seen from behind the golfer. */
export function tiltedLine(deg: number, len: number, cy: number, mirror: boolean) {
  const dx = Math.cos((deg * Math.PI) / 180) * len;
  const dy = Math.sin((deg * Math.PI) / 180) * len;
  const lead = mirror ? 1 : -1;
  return {
    x1: round(65 + lead * dx),
    y1: round(cy - dy),
    x2: round(65 - lead * dx),
    y2: round(cy + dy),
  };
}

/** Footprint opacity for a share of the weight. */
export const weightOpacity = (share: number) =>
  round(Math.min(1, Math.max(0.1, (share - 0.2) * 1.6)));

// Swing clock: where the club points at the top, in clock hours.
export const SWING_TOP: Record<SwingLength, number> = {
  quarter: 8,
  half: 9,
  "three-quarter": 10.5,
  full: 12.3,
};
export const SWING_NAME: Record<SwingLength, string> = {
  quarter: "Quarter swing",
  half: "Half swing",
  "three-quarter": "Three-quarter swing",
  full: "Full swing",
};

/** A point on a 112 × 112 clock face; a right-hander's club goes back up the left side. */
export function clockPoint(hour: number, radius: number, mirror: boolean) {
  const a = ((hour / 12) * 360 - 90) * (Math.PI / 180);
  const x = Math.cos(a) * radius;
  return [round(56 + (mirror ? -x : x)), round(56 + Math.sin(a) * radius)] as const;
}

/** The backswing arc from 6 o'clock to `to`. */
export function clockArc(to: number, mirror: boolean): string {
  const [sx, sy] = clockPoint(6, 40, mirror);
  const [ex, ey] = clockPoint(to, 40, mirror);
  const large = to - 6 > 6 ? 1 : 0;
  return `M${sx} ${sy} A40 40 0 ${large} ${mirror ? 0 : 1} ${ex} ${ey}`;
}

// Flight compared with normal, side-on: distance against height above the start-to-rest line.
export const FLIGHT_W = 300;
export const FLIGHT_BASE = 96;

const flightPoints = (f: FlightResult) => [...f.air, ...f.roll].map((s) => s.p);

function sideShape(f: FlightResult) {
  const pts = flightPoints(f);
  const end = pts[pts.length - 1]!;
  return pts.map(([x, y]) => [x / f.total, (y - (x / f.total) * end[1]) / f.total] as const);
}

export const flightX = (x: number) => round(12 + x * (FLIGHT_W - 24));

/** Paths for this shot and a normal one, scaled to the same length, and where the ball lands. */
export function flightPaths(c: FlightComparison) {
  const shot = sideShape(c.flight);
  const normal = sideShape(c.normal);
  const maxY = Math.max(...shot.map((p) => p[1]), ...normal.map((p) => p[1]));
  const sy = (y: number) => round(FLIGHT_BASE - (Math.max(0, y) / maxY) * (FLIGHT_BASE - 10));
  const path = (shape: ReadonlyArray<readonly [number, number]>) =>
    shape.map(([x, y], n) => `${n ? "L" : "M"}${flightX(x)} ${sy(y)}`).join(" ");
  return {
    shot: path(shot),
    normal: path(normal),
    landX: flightX(c.flight.carry / c.flight.total),
  };
}

/** The flight from above, sideways movement exaggerated so the curve reads on a phone. */
export function topPath(c: FlightComparison, mirror: boolean): string {
  const pts = flightPoints(c.flight);
  const zMax = Math.max(...pts.map((p) => Math.abs(p[2])), 0.1);
  return pts
    .map(
      ([x, , z], n) =>
        `${n ? "L" : "M"}${flightX(x / c.flight.total)} ${round(30 + ((mirror ? -z : z) / zMax) * 18)}`,
    )
    .join(" ");
}

// Club ladder, from `club_change`.
export function clubLadder(change: number | [number, number]) {
  const [low, high] = Array.isArray(change) ? change : [change, change];
  const steps: number[] = [];
  for (let n = Math.min(-2, low); n <= Math.max(2, high); n++) steps.push(n);
  const words = (n: number) =>
    n === 0
      ? "your normal club"
      : `${["one club", "two clubs", "three clubs"][Math.abs(n) - 1]} ${n > 0 ? "more" : "less"}`;
  return {
    steps: steps.map((n) => ({
      n,
      label: n === 0 ? "Normal" : `${Math.abs(n)} ${n > 0 ? "more" : "less"}`,
      picked: n >= low && n <= high,
      length: 30 + (n - steps[0]!) * 4,
    })),
    spoken: `Take ${low === high ? words(low) : `${words(low)} or ${words(high)}`}.`,
  };
}
