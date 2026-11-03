import { computeFlight, type FlightResult } from "./flight.ts";
import { parseScene, type ShotScene } from "./schema.ts";
import { deriveSetup, type Setup } from "./setup.ts";

/**
 * Plain comparisons of a scene with a normal shot, for the illustrated sections of a situation
 * page. Everything is relative ("back of normal", "lower"), never a number a reader would take as
 * a measurement. Lateral values are for a right-hander; renderers mirror them for left-handers.
 */

/**
 * The same club from a level fairway lie: full swing, no wind, neutral golfer and swing. Keeps
 * handedness and gender so it can be drawn beside the scene.
 */
export function normalScene(scene: ShotScene): ShotScene {
  return parseScene({
    id: `${scene.id}-normal`,
    title: "Normal shot",
    swing: { club: scene.swing.club },
    golfer: { handedness: scene.golfer.handedness, gender: scene.golfer.gender },
    camera: scene.camera,
  });
}

export type Relative = "less" | "normal" | "more";

export interface SetupInsight {
  setup: Setup;
  normal: Setup;
  /** Ball position compared with normal: "less" = further back. */
  ballPosition: Relative;
  weight: "lead" | "even" | "trail";
  stance: "narrow" | "normal" | "wide";
  /** Shoulders follow a slope along the target line. */
  matchesSlope: boolean;
  /** Aim of the body and club, degrees; negative = left of the target. */
  aim: number;
}

export function setupInsight(scene: ShotScene): SetupInsight {
  const setup = deriveSetup(scene);
  const normal = deriveSetup(normalScene(scene));
  const ball = setup.ballPosition - normal.ballPosition;
  const stance = setup.stanceWidth - normal.stanceWidth;
  return {
    setup,
    normal,
    ballPosition: ball < -0.15 ? "less" : ball > 0.15 ? "more" : "normal",
    weight: setup.weightLead > 0.56 ? "lead" : setup.weightLead < 0.44 ? "trail" : "even",
    stance: stance < -0.04 ? "narrow" : stance > 0.04 ? "wide" : "normal",
    matchesSlope: Math.abs(scene.terrain.slopeAlong) > 0.5,
    aim: scene.golfer.aim,
  };
}

export interface FlightComparison {
  flight: FlightResult;
  normal: FlightResult;
  height: Relative;
  /** Share of the total distance spent rolling, compared with normal. */
  roll: Relative | "much-more";
  curve: "left" | "none" | "right";
}

const rollShare = (f: FlightResult) => (f.total > 0 ? (f.total - f.carry) / f.total : 0);

/**
 * Extra roll (metres) a shot needs before it reads as "more roll". Wedges barely roll after a
 * full swing, so a bunker shot that runs a metre has many times their share yet still stops
 * quickly.
 */
const MIN_EXTRA_ROLL = 2;

export function compareWithNormal(scene: ShotScene): FlightComparison {
  const flight = computeFlight(scene);
  const normal = computeFlight(normalScene(scene));
  // Height relative to length, so a short chip and a full shot compare by shape.
  const height = flight.apex[1] / flight.carry / (normal.apex[1] / normal.carry);
  const roll = rollShare(flight) / Math.max(rollShare(normal), 0.01);
  const extraRoll = flight.total - flight.carry - (normal.total - normal.carry);
  const rollsMore = extraRoll >= MIN_EXTRA_ROLL;
  // How far the landing is from where the start line points: curve and wind drift.
  const straight = flight.carry * Math.tan((flight.launch.direction * Math.PI) / 180);
  const bend = flight.landing[2] - straight;
  const curveLimit = Math.max(1.5, flight.carry * 0.03);
  return {
    flight,
    normal,
    height: height < 0.85 ? "less" : height > 1.15 ? "more" : "normal",
    roll:
      rollsMore && roll > 3
        ? "much-more"
        : rollsMore && roll > 1.3
          ? "more"
          : roll < 0.7
            ? "less"
            : "normal",
    curve: bend > curveLimit ? "right" : bend < -curveLimit ? "left" : "none",
  };
}
