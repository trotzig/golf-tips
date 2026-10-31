import { BALL_RADIUS, CLUB_SPECS, SWING_LENGTH_ARM } from "./clubs.ts";
import type { ShotScene } from "./schema.ts";
import { deriveSetup, type Setup } from "./setup.ts";
import { groundHeight } from "./terrain.ts";
import {
  add,
  cross,
  DEG,
  distance,
  dot,
  length,
  mix,
  normalize,
  rotate,
  rotateAbout,
  scale,
  smoothstep,
  solveTwoBone,
  sub,
  type Vec3,
} from "./vec.ts";

export const JOINTS = [
  "head",
  "neck",
  "pelvis",
  "leadShoulder",
  "trailShoulder",
  "leadElbow",
  "trailElbow",
  "leadHand",
  "trailHand",
  "leadHip",
  "trailHip",
  "leadKnee",
  "trailKnee",
  "leadAnkle",
  "trailAnkle",
  "leadToe",
  "trailToe",
] as const;
export type Joint = (typeof JOINTS)[number];

/** Bones as joint pairs, for renderers that draw limbs as capsules or thick lines. */
export const BONES: ReadonlyArray<readonly [Joint, Joint]> = [
  ["pelvis", "neck"],
  ["leadShoulder", "trailShoulder"],
  ["leadHip", "trailHip"],
  ["leadShoulder", "leadElbow"],
  ["leadElbow", "leadHand"],
  ["trailShoulder", "trailElbow"],
  ["trailElbow", "trailHand"],
  ["leadHip", "leadKnee"],
  ["leadKnee", "leadAnkle"],
  ["trailHip", "trailKnee"],
  ["trailKnee", "trailAnkle"],
  ["leadAnkle", "leadToe"],
  ["trailAnkle", "trailToe"],
];

export interface Pose {
  joints: Record<Joint, Vec3>;
  club: {
    /** Butt end of the grip. */
    grip: Vec3;
    /** Heel of the clubhead, where the shaft meets it. */
    hosel: Vec3;
    /** Toe of the clubhead. */
    toe: Vec3;
  };
  /** Head radius (m), for drawing. */
  headRadius: number;
  /** Front of the face, one head radius from `head`: where the eyes (and a visor's brim) point. */
  face: Vec3;
}

// Segment lengths (m) for a ~1.78 m golfer.
const SHIN = 0.45;
const THIGH = 0.45;
const UPPER_ARM = 0.3;
const FOREARM = 0.3;
const TORSO = 0.52;
const SHOULDER_HALF = 0.19;
const HIP_HALF = 0.1;
const HEAD_RADIUS = 0.11;
const ANKLE_HEIGHT = 0.08;
const HEAD_LENGTH = 0.1;

/** Swing phase keyframes: where in [0, 1] each position sits. */
export const PHASE = { address: 0, top: 0.45, impact: 0.65, finish: 1 } as const;

interface SwingKey {
  p: number;
  arm: number;
  hinge: number;
  turn: number;
  weight: number;
  rise: number;
}

/** Arm rotation, wrist hinge and turn are fractions of the backswing maxima. */
const KEYS: SwingKey[] = [
  { p: 0, arm: 0, hinge: 0, turn: 0, weight: 0, rise: 0 },
  { p: 0.15, arm: 0.3, hinge: 0.15, turn: 0.35, weight: -0.1, rise: 0 },
  { p: PHASE.top, arm: 1, hinge: 1, turn: 1, weight: -0.2, rise: 0 },
  { p: 0.57, arm: 0.45, hinge: 0.9, turn: 0.45, weight: 0.2, rise: 0 },
  { p: PHASE.impact, arm: -0.03, hinge: 0.04, turn: -0.2, weight: 0.35, rise: 0.05 },
  { p: 0.8, arm: -0.85, hinge: -0.6, turn: -0.85, weight: 0.4, rise: 0.4 },
  { p: PHASE.finish, arm: -1.15, hinge: -0.95, turn: -1.2, weight: 0.42, rise: 1 },
];

function sampleKeys(p: number): SwingKey {
  const c = Math.min(1, Math.max(0, p));
  for (let i = 1; i < KEYS.length; i++) {
    const b = KEYS[i]!;
    if (c <= b.p) {
      const a = KEYS[i - 1]!;
      const t = smoothstep((c - a.p) / (b.p - a.p));
      return {
        p: c,
        arm: mix(a.arm, b.arm, t),
        hinge: mix(a.hinge, b.hinge, t),
        turn: mix(a.turn, b.turn, t),
        weight: mix(a.weight, b.weight, t),
        rise: mix(a.rise, b.rise, t),
      };
    }
  }
  return KEYS[KEYS.length - 1]!;
}

const UP: Vec3 = [0, 1, 0];
const X: Vec3 = [1, 0, 0];
const Z: Vec3 = [0, 0, 1];

interface Body {
  joints: Omit<Record<Joint, Vec3>, "leadElbow" | "trailElbow" | "leadHand" | "trailHand">;
  spineDir: Vec3;
  hands: Vec3;
  face: Vec3;
}

/** Build the body (legs, torso, shoulders) for a stance with the feet at z = −depth. */
function buildBody(
  scene: ShotScene,
  setup: Setup,
  depth: number,
  key: SwingKey,
  turnMax: number,
): Body {
  const { terrain, golfer } = scene;
  const w = setup.stanceWidth;
  const centreX = -setup.ballPosition * w * 0.42;
  const centre: Vec3 = [centreX, 0, -depth];

  const foot = (side: 1 | -1): { ankle: Vec3; toe: Vec3 } => {
    let heel: Vec3 = [centreX + (side * w) / 2, 0, -depth];
    // Open alignment pulls the lead foot back from the line (toward −z).
    heel = rotateAbout(heel, centre, UP, golfer.alignment * DEG);
    const flare = (side === 1 ? 20 : 8) * DEG * side;
    let toe = add(heel, rotate([0, 0, 0.2], UP, flare));
    toe = rotateAbout(toe, centre, UP, golfer.alignment * DEG);
    const gh = (p: Vec3) => groundHeight(terrain, p[0], p[2]);
    return {
      ankle: [heel[0], gh(heel) + ANKLE_HEIGHT, heel[2] - 0.03],
      toe: [toe[0], gh(toe) + 0.02, toe[2]],
    };
  };
  const lead = foot(1);
  const trail = foot(-1);

  const weight = setup.weightLead + key.weight;
  const flex = setup.kneeFlex * (1 - key.rise * 0.6) * DEG;
  const spineBend = setup.spineBend * (1 - key.rise * 0.55) * DEG;
  const hipHeight = (SHIN + THIGH) * Math.cos(flex) * 0.97;
  const ankleMid = scale(add(lead.ankle, trail.ankle), 0.5);
  const pelvis: Vec3 = [
    ankleMid[0] + (weight - 0.5) * w * 0.6,
    ankleMid[1] + hipHeight,
    -depth - 0.05 - Math.sin(spineBend) * 0.12,
  ];

  // Hips: level with the slope, turned half as much as the shoulders.
  const hipTurn = -key.turn * turnMax * 0.5 * DEG + golfer.alignment * 0.5 * DEG;
  let hipAxis = rotate(X, Z, setup.hipTilt * DEG);
  hipAxis = rotate(hipAxis, UP, hipTurn);
  const leadHip = add(pelvis, scale(hipAxis, HIP_HALF));
  const trailHip = add(pelvis, scale(hipAxis, -HIP_HALF));

  // Spine bends forward toward the ball and tilts away from the target with the shoulders.
  let spineDir = rotate(UP, X, spineBend);
  spineDir = rotate(spineDir, Z, setup.shoulderTilt * 0.5 * DEG);
  const neck = add(pelvis, scale(spineDir, TORSO));

  // Shoulder line: tilted (lead up), then turned around the spine. Backswing turn is negative
  // rotation about the up-ish spine axis (lead shoulder moves toward the ball, then away).
  let shoulderAxis = rotate(X, Z, setup.shoulderTilt * 0.5 * DEG);
  shoulderAxis = normalize(sub(shoulderAxis, scale(spineDir, dot(shoulderAxis, spineDir))));
  shoulderAxis = rotate(shoulderAxis, spineDir, -key.turn * turnMax * DEG);
  const shoulderDrop = scale(spineDir, -0.04);
  const leadShoulder = add(add(neck, scale(shoulderAxis, SHOULDER_HALF)), shoulderDrop);
  const trailShoulder = add(add(neck, scale(shoulderAxis, -SHOULDER_HALF)), shoulderDrop);

  // Head looks down at the ball until the finish, when it rises with the body.
  const headDir = normalize(add(spineDir, scale(Z, 0.35 * (1 - key.rise))));
  const head = add(neck, scale(headDir, HEAD_LENGTH + HEAD_RADIUS * 0.8));
  // The face looks at the ball, and toward the target as the head comes up in the finish.
  const look = normalize(mix3(Z, X, 0.75 * key.rise));
  const face = add(
    head,
    scale(normalize(sub(look, scale(headDir, dot(look, headDir)))), HEAD_RADIUS),
  );

  // Hands hang just in front of the shoulders, slightly toward the target.
  const shoulderMid = scale(add(leadShoulder, trailShoulder), 0.5);
  const reach = (UPPER_ARM + FOREARM) * 0.94;
  const hx = setup.shaftLean > 0 ? 0.05 : 0.02;
  const handsXZ: Vec3 = [shoulderMid[0] + hx, 0, shoulderMid[2] + 0.1];
  const dx = handsXZ[0] - leadShoulder[0];
  const dz = handsXZ[2] - leadShoulder[2];
  const hands: Vec3 = [
    handsXZ[0],
    leadShoulder[1] - Math.sqrt(Math.max(0.01, reach * reach - dx * dx - dz * dz)),
    handsXZ[2],
  ];

  return {
    joints: {
      head,
      neck,
      pelvis,
      leadShoulder,
      trailShoulder,
      leadHip,
      trailHip,
      leadAnkle: lead.ankle,
      trailAnkle: trail.ankle,
      leadToe: lead.toe,
      trailToe: trail.toe,
      leadKnee: solveTwoBone(leadHip, lead.ankle, THIGH, SHIN, add(Z, scale(X, 0.15))).mid,
      trailKnee: solveTwoBone(trailHip, trail.ankle, THIGH, SHIN, add(Z, scale(X, -0.15))).mid,
    },
    spineDir,
    hands,
    face,
  };
}

/**
 * Pose the golfer at swing phase `phase` (0 address, 0.45 top, 0.65 impact, 1 finish) in the
 * right-handed world frame (ball at the origin, target +x). Stylised: a hub-and-plane swing,
 * not biomechanics.
 */
export function poseGolfer(scene: ShotScene, phase = 0): Pose {
  const setup = deriveSetup(scene);
  const spec = CLUB_SPECS[scene.swing.club];
  const isPutt = scene.swing.club === "putter";
  const armMax = isPutt ? 18 : SWING_LENGTH_ARM[scene.swing.length];
  const hingeMax = isPutt ? 0 : Math.min(100, armMax * 0.85);
  const turnMax = isPutt ? 8 : armMax * 0.72;
  const address = sampleKeys(0);
  const key = isPutt ? { ...sampleKeys(phase), hinge: 0, rise: 0, weight: 0 } : sampleKeys(phase);

  // Club from hands to clubhead at address; the ball sits on the ground at the origin.
  const shaft = spec.length - 0.07 - setup.gripDown;
  const ballY = groundHeight(scene.terrain, 0, 0);
  const sole: Vec3 = [0, ballY + 0.01, -0.035];

  // Solve for how far from the ball the golfer stands so the club reaches it.
  let depth = 0.7;
  let body = buildBody(scene, setup, depth, address, turnMax);
  for (let i = 0; i < 6; i++) {
    const h = body.hands;
    const dy = h[1] - sole[1];
    const dx = h[0] - sole[0];
    const horiz = Math.sqrt(Math.max(0.01, shaft * shaft - dx * dx - dy * dy));
    const targetZ = sole[2] - horiz;
    depth += h[2] - targetZ;
    body = buildBody(scene, setup, depth, address, turnMax);
  }
  const handsAddress = body.hands;
  const shaftDir = normalize(sub(sole, handsAddress));

  // Swing plane: contains the target line and the shaft at address, hinged at the upper chest.
  const hub = add(body.joints.neck, scale(body.spineDir, -0.08));
  let normal = normalize(cross(shaftDir, X));
  const r = sub(handsAddress, hub);
  // Positive rotation must carry the hands away from the target in the backswing.
  if (dot(cross(normal, r), X) > 0) normal = scale(normal, -1);

  const posed = phase === 0 ? body : buildBody(scene, setup, depth, key, turnMax);
  const armAngle = key.arm * armMax * DEG;
  const clubAngle = armAngle + key.hinge * hingeMax * DEG;
  const clubDir = rotate(shaftDir, normal, clubAngle);
  let handsTarget = add(hub, rotate(r, normal, armAngle));
  if (!isPutt && phase > PHASE.impact) {
    // The hub stays put while the shoulders turn and rise, which would fold the lead arm right
    // after impact ("chicken wing"). Keep it extended through the ball, with the trail arm still
    // reaching the grip (alternating the two limits settles where both hold); fold at the finish.
    const fold = smoothstep((phase - 0.8) / (1 - 0.8));
    const minReach = (UPPER_ARM + FOREARM) * mix(0.95, 0.7, fold);
    const maxTrail = (UPPER_ARM + FOREARM) * 0.99;
    for (let i = 0; i < 8; i++) {
      const toHands = sub(handsTarget, posed.joints.leadShoulder);
      if (length(toHands) < minReach) {
        handsTarget = add(posed.joints.leadShoulder, scale(normalize(toHands), minReach));
      }
      const toGrip = sub(add(handsTarget, scale(clubDir, 0.09)), posed.joints.trailShoulder);
      const excess = length(toGrip) - maxTrail;
      if (excess > 0) handsTarget = sub(handsTarget, scale(normalize(toGrip), excess));
    }
  }
  const lead = solveTwoBone(
    posed.joints.leadShoulder,
    handsTarget,
    UPPER_ARM,
    FOREARM,
    add(sub(posed.joints.pelvis, posed.joints.leadShoulder), scale(Z, -0.2)),
  );
  const leadHand = add(lead.end, scale(clubDir, -0.02));
  const trailHandTarget = add(lead.end, scale(clubDir, 0.09));
  const trail = solveTwoBone(
    posed.joints.trailShoulder,
    trailHandTarget,
    UPPER_ARM,
    FOREARM,
    add(sub(posed.joints.pelvis, posed.joints.trailShoulder), scale(Z, -0.2)),
  );

  const grip = add(lead.end, scale(clubDir, -0.07));
  const hosel = add(lead.end, scale(clubDir, shaft));
  // The head extends away from the golfer along the ground at address.
  const toe = add(hosel, scale(rotate(Z, normal, clubAngle), 0.1));

  // Aim turns the whole golfer and club about the ball; positive aims right (toward +z).
  const aim = (p: Vec3) => rotate(p, UP, -scene.golfer.aim * DEG);
  const joints = {
    ...posed.joints,
    leadElbow: lead.mid,
    trailElbow: trail.mid,
    leadHand,
    trailHand: trail.end,
  };
  return {
    joints: Object.fromEntries(JOINTS.map((j) => [j, aim(joints[j])])) as Record<Joint, Vec3>,
    club: { grip: aim(grip), hosel: aim(hosel), toe: aim(toe) },
    headRadius: HEAD_RADIUS,
    face: aim(posed.face),
  };
}

const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => add(scale(a, 1 - t), scale(b, t));

/** Distance between joints, handy for tests and debugging. */
export function boneLength(pose: Pose, a: Joint, b: Joint) {
  return distance(pose.joints[a], pose.joints[b]);
}

export { BALL_RADIUS };
