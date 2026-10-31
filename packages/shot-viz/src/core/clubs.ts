import type { Club, SwingLength } from "./schema.ts";

export interface ClubSpec {
  label: string;
  /** Club length, butt to sole, metres. */
  length: number;
  loft: number;
  /** Typical full-swing ball speed (m/s), launch angle (deg) and backspin (rpm) for an average golfer. */
  ballSpeed: number;
  launch: number;
  spin: number;
  /** Default feet-centre spacing (m) and ball position (−1 trail foot … 1 lead heel). */
  stance: number;
  ballPosition: number;
  /** Default lead-shoulder-up tilt at address on flat ground (deg). */
  shoulderTilt: number;
  /** Forward bend of the spine from vertical at address (deg). */
  spineBend: number;
}

// Illustrative numbers in the range of a mid-handicap golfer. Not launch-monitor data.
export const CLUB_SPECS: Record<Club, ClubSpec> = {
  driver: {
    label: "Driver",
    length: 1.15,
    loft: 10.5,
    ballSpeed: 66,
    launch: 13,
    spin: 2800,
    stance: 0.5,
    ballPosition: 0.85,
    shoulderTilt: 10,
    spineBend: 33,
  },
  "3-wood": {
    label: "3-wood",
    length: 1.08,
    loft: 15,
    ballSpeed: 62,
    launch: 11.5,
    spin: 3700,
    stance: 0.46,
    ballPosition: 0.6,
    shoulderTilt: 8,
    spineBend: 35,
  },
  hybrid: {
    label: "Hybrid",
    length: 1.02,
    loft: 21,
    ballSpeed: 57,
    launch: 13,
    spin: 4500,
    stance: 0.42,
    ballPosition: 0.35,
    shoulderTilt: 6,
    spineBend: 36,
  },
  "5-iron": {
    label: "5-iron",
    length: 0.97,
    loft: 26,
    ballSpeed: 54,
    launch: 13.5,
    spin: 5300,
    stance: 0.4,
    ballPosition: 0.25,
    shoulderTilt: 5,
    spineBend: 37,
  },
  "7-iron": {
    label: "7-iron",
    length: 0.94,
    loft: 33,
    ballSpeed: 49,
    launch: 17,
    spin: 6800,
    stance: 0.37,
    ballPosition: 0.1,
    shoulderTilt: 4,
    spineBend: 38,
  },
  "9-iron": {
    label: "9-iron",
    length: 0.91,
    loft: 41,
    ballSpeed: 44,
    launch: 21,
    spin: 8300,
    stance: 0.34,
    ballPosition: 0,
    shoulderTilt: 3,
    spineBend: 39,
  },
  "pitching-wedge": {
    label: "Pitching wedge",
    length: 0.9,
    loft: 46,
    ballSpeed: 41,
    launch: 24,
    spin: 9000,
    stance: 0.32,
    ballPosition: 0,
    shoulderTilt: 2,
    spineBend: 40,
  },
  "sand-wedge": {
    label: "Sand wedge",
    length: 0.89,
    loft: 56,
    ballSpeed: 35,
    launch: 30,
    spin: 9800,
    stance: 0.3,
    ballPosition: 0,
    shoulderTilt: 2,
    spineBend: 40,
  },
  "lob-wedge": {
    label: "Lob wedge",
    length: 0.89,
    loft: 60,
    ballSpeed: 31,
    launch: 33,
    spin: 10000,
    stance: 0.3,
    ballPosition: 0.05,
    shoulderTilt: 2,
    spineBend: 40,
  },
  putter: {
    label: "Putter",
    length: 0.86,
    loft: 3,
    ballSpeed: 3,
    launch: 2,
    spin: 0,
    stance: 0.3,
    ballPosition: 0.3,
    shoulderTilt: 0,
    spineBend: 45,
  },
};

/** Share of full-swing ball speed for shorter swings. */
export const SWING_LENGTH_SPEED: Record<SwingLength, number> = {
  quarter: 0.4,
  half: 0.65,
  "three-quarter": 0.87,
  full: 1,
};

/** Arm rotation (deg) at the top of the backswing, in the swing plane, by swing length. */
export const SWING_LENGTH_ARM: Record<SwingLength, number> = {
  quarter: 35,
  half: 70,
  "three-quarter": 100,
  full: 125,
};

export const BALL_RADIUS = 0.02135;
