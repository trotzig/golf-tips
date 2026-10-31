import { CLUB_SPECS, SWING_LENGTH_SPEED } from "./clubs.ts";
import type { ShotScene } from "./schema.ts";
import { clamp } from "./vec.ts";

/** Address position after applying slope adjustments. All angles in degrees. */
export interface Setup {
  /** Feet-centre spacing (m). */
  stanceWidth: number;
  /** −1 = trail foot, 0 = centre, 1 = lead heel. */
  ballPosition: number;
  /** Share of weight on the lead foot, 0–1. */
  weightLead: number;
  /** Positive = lead shoulder higher. */
  shoulderTilt: number;
  /** Forward bend of the spine from vertical. */
  spineBend: number;
  /** Knee flex from straight. */
  kneeFlex: number;
  /** Hips level with the slope: positive = lead hip higher. */
  hipTilt: number;
  /** Hands down the grip (m). */
  gripDown: number;
  /** Shaft lean toward the target at address (deg). */
  shaftLean: number;
}

const STANCE_WIDTH_OFFSET = { narrow: -0.08, normal: 0, wide: 0.1 } as const;

/**
 * Mainstream slope adjustments: shoulders and hips follow the slope, the ball moves toward the
 * higher foot, weight favours the lower foot on an uphill lie and the lead foot on a downhill
 * one, stand taller and grip down with the ball above the feet, flex more with it below.
 * Explicit golfer values in the scene always win.
 */
export function deriveSetup(scene: ShotScene): Setup {
  const spec = CLUB_SPECS[scene.swing.club];
  const { slopeAlong, slopeAcross } = scene.terrain;
  const g = scene.golfer;
  const below = Math.max(0, -slopeAcross);
  const above = Math.max(0, slopeAcross);
  const isPutt = scene.swing.club === "putter";

  return {
    stanceWidth: spec.stance + STANCE_WIDTH_OFFSET[g.stanceWidth] + below * 0.006,
    ballPosition: g.ballPosition ?? clamp(spec.ballPosition + slopeAlong * 0.04, -1, 1),
    weightLead: g.weightLead ?? clamp(0.5 - slopeAlong * 0.015, 0.2, 0.8),
    shoulderTilt: g.shoulderTilt ?? spec.shoulderTilt + slopeAlong,
    spineBend: clamp(spec.spineBend - above * 0.9 + below * 0.5, 15, 55),
    kneeFlex: clamp((isPutt ? 15 : 22) + below * 1.2 - above * 0.3, 5, 50),
    hipTilt: slopeAlong * 0.7,
    gripDown: g.gripDown ?? above * 0.006,
    shaftLean: isPutt || scene.swing.club === "driver" ? 0 : 4,
  };
}

export interface LaunchConditions {
  ballSpeed: number;
  /** Vertical launch angle (deg). */
  launchAngle: number;
  /** Horizontal start direction, degrees right (+) or left (−) of the target line. */
  direction: number;
  spinRpm: number;
  /** Spin-axis tilt (deg); positive curves the ball right. */
  spinAxis: number;
}

const TRAJECTORY = {
  low: { launch: -5, spin: 0.82 },
  normal: { launch: 0, spin: 1 },
  high: { launch: 5, spin: 1.1 },
} as const;

const LIE_SPIN = { fairway: 1, tee: 1, fringe: 0.95, green: 1, rough: 0.6, bunker: 0.8 } as const;

/**
 * Turn the scene into launch conditions. Illustrative, not a launch monitor: an uphill lie
 * adds loft and pulls the ball left; a downhill lie delofts and pushes it right; with the ball
 * above the feet the face points left, below the feet slightly right.
 */
export function deriveLaunch(scene: ShotScene): LaunchConditions {
  const spec = CLUB_SPECS[scene.swing.club];
  const { slopeAlong, slopeAcross, lie } = scene.terrain;
  const { flight, swing, golfer } = scene;
  const traj = TRAJECTORY[flight.trajectory];
  const attack = swing.attackAngle ?? 0;

  const face = swing.face - slopeAcross * 0.3 - slopeAlong * 0.12;
  const launchAngle =
    flight.launchAngle ?? clamp(spec.launch + traj.launch + slopeAlong * 0.6 + attack * 0.3, 1, 55);

  return {
    ballSpeed: flight.ballSpeed ?? spec.ballSpeed * SWING_LENGTH_SPEED[swing.length],
    launchAngle,
    direction: golfer.aim + face * 0.75 + swing.path * 0.25,
    spinRpm:
      flight.spinRpm ??
      spec.spin *
        traj.spin *
        LIE_SPIN[lie] *
        (1 + slopeAlong * 0.015) *
        (0.6 + 0.4 * SWING_LENGTH_SPEED[swing.length]),
    spinAxis: clamp((face - swing.path) * 2.5, -35, 35),
  };
}
