import type { SetupInsight } from "./insights.ts";

/**
 * The address figure on a situation page: ball position, weight and stance in one view from
 * above, compared with a normal shot (dashed). Geometry only, in a 300 × 132 view box, so the
 * site and the app draw the same figure with their own SVG elements. `mirror` draws for a
 * left-hander: the lead side and the target are on the left for a right-hander.
 */

const round = (n: number) => Math.round(n * 10) / 10;

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

/**
 * One line naming what differs from normal: the ball always, weight and stance only when they
 * aren't even and normal.
 */
export function addressSummary(i: SetupInsight): string {
  const ball = { less: "Ball back", normal: "Ball normal", more: "Ball forward" }[i.ballPosition];
  const weight = { lead: "weight lead", even: null, trail: "weight trail" }[i.weight];
  const stance = { narrow: "narrow stance", normal: null, wide: "wide stance" }[i.stance];
  return [ball, weight, stance].filter(Boolean).join(" · ");
}

export const ADDRESS_W = 300;
export const ADDRESS_H = 132;
const CX = ADDRESS_W / 2;
/** Stance width (fraction of the golfer's height) → half the distance between the feet. */
const STANCE_SCALE = 155;

export interface AddressFoot {
  x: number;
  label: "Lead" | "Trail";
  /** Opacity of the accent fill: the foot's share of the weight. */
  shade: number;
}

export interface AddressLayout {
  /** The target line the ball sits on. */
  ballY: number;
  line: { x1: number; x2: number };
  target: { x: number; anchor: "start" | "end"; text: string };
  foot: { y: number; h: number };
  feet: [AddressFoot, AddressFoot];
  normalFeet: [number, number];
  ball: number;
  normalBall: number;
  /** Dotted guide from the ball down to the heels. */
  guide: { y1: number; y2: number };
  /** Bar between the feet, a tick at the centre and a pointer below it at the balance point. */
  balance: { y: number; x1: number; x2: number; centre: number; pointer: string };
  labelY: number;
}

export function addressLayout(i: SetupInsight, mirror: boolean): AddressLayout {
  const { setup, normal } = i;
  // +1 points from the centre toward the trail side.
  const t = mirror ? -1 : 1;
  const half = setup.stanceWidth * STANCE_SCALE;
  const normalHalf = normal.stanceWidth * STANCE_SCALE;
  const lead = round(CX - t * half);
  const trail = round(CX + t * half);
  // Ball position: −1 trail foot … 1 lead foot.
  const ballX = (v: number, h: number) => round(CX - t * v * h);
  const shade = (share: number) => round(Math.min(1, Math.max(0.1, (share - 0.2) * 1.6)));
  const ballY = 22;
  const foot = { y: 68, h: 46 };
  const heel = foot.y + foot.h / 2;
  const barY = heel + 10;
  // Balance point: 1 = all on the lead foot.
  const p = round(CX - t * (setup.weightLead - 0.5) * 2 * half);

  return {
    ballY,
    line: { x1: 12, x2: ADDRESS_W - 12 },
    target: mirror
      ? { x: ADDRESS_W - 2, anchor: "end", text: "Target →" }
      : { x: 2, anchor: "start", text: "← Target" },
    foot,
    feet: [
      { x: lead, label: "Lead", shade: shade(setup.weightLead) },
      { x: trail, label: "Trail", shade: shade(1 - setup.weightLead) },
    ],
    normalFeet: [round(CX - normalHalf), round(CX + normalHalf)],
    ball: ballX(setup.ballPosition, half),
    normalBall: ballX(normal.ballPosition, normalHalf),
    guide: { y1: ballY + 9, y2: heel },
    balance: {
      y: barY,
      x1: lead,
      x2: trail,
      centre: CX,
      pointer: `M${p} ${barY + 3} l6 9 h-12 Z`,
    },
    labelY: 128,
  };
}
