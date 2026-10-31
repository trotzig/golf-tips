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
  /** Front of the face, one head radius from `head`: where the eyes (and a cap's bill) point. */
  face: Vec3;
}

// Segment lengths (m) for a ~1.78 m golfer.
const SHIN = 0.45;
const THIGH = 0.45;
const UPPER_ARM = 0.3;
const FOREARM = 0.3;
const TORSO = 0.52;
/** Half the shoulder and hip widths: narrower shoulders and wider hips for a woman. */
const BUILD: Record<ShotScene["golfer"]["gender"], { shoulderHalf: number; hipHalf: number }> = {
  male: { shoulderHalf: 0.19, hipHalf: 0.1 },
  female: { shoulderHalf: 0.16, hipHalf: 0.12 },
};
const HEAD_RADIUS = 0.11;
const ANKLE_HEIGHT = 0.08;
const HEAD_LENGTH = 0.1;

/** Shoulder turn (°) of a full swing; shorter swings scale some motions by their share of it. */
const FULL_TURN = 90;

/** Swing phase keyframes: where in [0, 1] each position sits. */
export const PHASE = { address: 0, top: 0.45, impact: 0.65, finish: 1 } as const;

export interface SwingKey {
  p: number;
  /** Arm rotation along the swing plane, as a fraction of the backswing maximum. */
  arm: number;
  /** Wrist hinge (club relative to the arms); negative re-hinges past the arms. */
  hinge: number;
  /** Shoulder turn, as a fraction of the backswing maximum (negative = open to the target). */
  turn: number;
  /** Hip turn, as a fraction of the maximum shoulder turn. */
  hips: number;
  weight: number;
  rise: number;
}

/** The knobs that shape the swing motion; the swing-tuning playground edits these. */
export interface SwingTuning {
  /** Keyframes, in phase order: address (0), top (`PHASE.top`), impact, finish (1). */
  keys: SwingKey[];
  /** "spline" eases through the keys (monotone cubic); "smoothstep" stops at every key. */
  interpolation: "spline" | "smoothstep";
  /** How much the spine's forward bend turns with the hips (the chest faces the target). */
  spineFollowsHips: number;
  /** How much the knees point with the hips. */
  kneesFollowHips: number;
  /** After impact, how much the arms' swing plane turns with the hips (around the body). */
  planeFollow: number;
  /** After impact, how much the swing hub moves with the chest. */
  hubFollow: number;
  /** Phase where the lead arm starts to fold, and its reach at the finish (× arm length). */
  foldStart: number;
  foldReach: number;
  /**
   * Trail heel lift at the finish of a full swing, in degrees. The heel comes up as the hips open
   * toward their finish position, and less in shorter swings.
   */
  heelLift: number;
  /**
   * How far (in phase) the body runs ahead of the arms from the start of the downswing, so the
   * hips and chest are already turning through when the club reaches the ball. The arms keep
   * their own keys, so the club still meets the ball at impact.
   */
  bodyLead: number;
}

/** The swing as it was before the follow-through rework; kept for comparison. */
export const CLASSIC_SWING: SwingTuning = {
  keys: [
    { p: 0, arm: 0, hinge: 0, turn: 0, hips: 0, weight: 0, rise: 0 },
    { p: 0.15, arm: 0.3, hinge: 0.15, turn: 0.35, hips: 0.175, weight: -0.1, rise: 0 },
    { p: PHASE.top, arm: 1, hinge: 1, turn: 1, hips: 0.5, weight: -0.2, rise: 0 },
    { p: 0.57, arm: 0.45, hinge: 0.9, turn: 0.45, hips: 0.225, weight: 0.2, rise: 0 },
    {
      p: PHASE.impact,
      arm: -0.03,
      hinge: 0.04,
      turn: -0.2,
      hips: -0.1,
      weight: 0.35,
      rise: 0.05,
    },
    { p: 0.8, arm: -0.85, hinge: -0.6, turn: -0.85, hips: -0.425, weight: 0.4, rise: 0.4 },
    {
      p: PHASE.finish,
      arm: -1.15,
      hinge: -0.95,
      turn: -1.2,
      hips: -0.6,
      weight: 0.42,
      rise: 1,
    },
  ],
  interpolation: "smoothstep",
  spineFollowsHips: 0,
  kneesFollowHips: 0,
  planeFollow: 0,
  hubFollow: 0,
  foldStart: 0.8,
  foldReach: 0.7,
  heelLift: 0,
  bodyLead: 0,
};

/** The swing the diagrams use: classic keys with the body turning through (tuned 2026-10-31). */
export const DEFAULT_SWING: SwingTuning = {
  keys: CLASSIC_SWING.keys,
  interpolation: "spline",
  spineFollowsHips: 0.1,
  kneesFollowHips: 0,
  planeFollow: 0.6,
  hubFollow: 0.2,
  foldStart: 0.83,
  foldReach: 0.62,
  heelLift: 32,
  bodyLead: 0.02,
};

const CHANNELS = ["arm", "hinge", "turn", "hips", "weight", "rise"] as const;

/** Monotone cubic (Fritsch–Carlson) tangents: no overshoot, flat at each turning point. */
function tangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const d = xs.slice(1).map((x, i) => (ys[i + 1]! - ys[i]!) / (x - xs[i]!));
  const m = xs.map((_, i) => {
    if (i === 0 || i === n - 1) return 0;
    const a = d[i - 1]!;
    const b = d[i]!;
    return a * b <= 0 ? 0 : (a + b) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) continue;
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = (3 * a * d[i]!) / h;
      m[i + 1] = (3 * b * d[i]!) / h;
    }
  }
  return m;
}

export function sampleKeys(p: number, tuning: SwingTuning = DEFAULT_SWING): SwingKey {
  const keys = tuning.keys;
  const c = Math.min(1, Math.max(0, p));
  const i = Math.max(
    1,
    keys.findIndex((k, j) => j > 0 && c <= k.p),
  );
  const a = keys[i - 1]!;
  const b = keys[i]!;
  const span = b.p - a.p;
  const u = span > 0 ? Math.min(1, Math.max(0, (c - a.p) / span)) : 1;
  const out = { p: c } as SwingKey;
  for (const ch of CHANNELS) {
    if (tuning.interpolation === "smoothstep") {
      out[ch] = mix(a[ch], b[ch], smoothstep(u));
      continue;
    }
    const m = tangents(
      keys.map((k) => k.p),
      keys.map((k) => k[ch]),
    );
    const u2 = u * u;
    const u3 = u2 * u;
    out[ch] =
      (2 * u3 - 3 * u2 + 1) * a[ch] +
      (u3 - 2 * u2 + u) * span * m[i - 1]! +
      (-2 * u3 + 3 * u2) * b[ch] +
      (u3 - u2) * span * m[i]!;
  }
  return out;
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
  tuning: SwingTuning,
): Body {
  const { terrain, golfer } = scene;
  const { shoulderHalf, hipHalf } = BUILD[golfer.gender];
  const w = setup.stanceWidth;
  const centreX = -setup.ballPosition * w * 0.42;
  const centre: Vec3 = [centreX, 0, -depth];

  // Hips turn on their own key, so they can lead the shoulders in the downswing.
  const hipTurn = -key.hips * turnMax * DEG + golfer.alignment * 0.5 * DEG;

  // The trail heel comes up as the hips open toward their finish, less in shorter swings.
  const finishHips = -(tuning.keys[tuning.keys.length - 1]?.hips ?? 0);
  const heelUp =
    scene.swing.club === "putter" || finishHips <= 0
      ? 0
      : Math.min(1, Math.max(0, -key.hips / finishHips)) * Math.min(1, turnMax / FULL_TURN);

  const foot = (side: 1 | -1): { ankle: Vec3; toe: Vec3 } => {
    let heel: Vec3 = [centreX + (side * w) / 2, 0, -depth];
    // Open alignment pulls the lead foot back from the line (toward −z).
    heel = rotateAbout(heel, centre, UP, golfer.alignment * DEG);
    const flare = (side === 1 ? 20 : 8) * DEG * side;
    let toe = add(heel, rotate([0, 0, 0.2], UP, flare));
    toe = rotateAbout(toe, centre, UP, golfer.alignment * DEG);
    const gh = (p: Vec3) => groundHeight(terrain, p[0], p[2]);
    const out: { ankle: Vec3; toe: Vec3 } = {
      ankle: [heel[0], gh(heel) + ANKLE_HEIGHT, heel[2] - 0.03],
      toe: [toe[0], gh(toe) + 0.02, toe[2]],
    };
    const lift = side === -1 ? heelUp * tuning.heelLift * DEG : 0;
    if (lift > 0) {
      // The foot pivots on its toe.
      const along = sub(out.toe, out.ankle);
      const axis = normalize(cross(UP, [along[0], 0, along[2]]));
      const up = rotateAbout(out.ankle, out.toe, axis, lift);
      out.ankle = up[1] >= out.ankle[1] ? up : rotateAbout(out.ankle, out.toe, axis, -lift);
    }
    return out;
  };
  const lead = foot(1);
  const trail = foot(-1);

  const weight = setup.weightLead + key.weight;
  const flex = setup.kneeFlex * (1 - key.rise * 0.6) * DEG;
  const spineBend = setup.spineBend * (1 - key.rise * 0.55) * DEG;
  const hipHeight = (SHIN + THIGH) * Math.cos(flex) * 0.97;
  const ankleMid = scale(add(lead.ankle, trail.ankle), 0.5);
  let pelvis: Vec3 = [
    ankleMid[0] + (weight - 0.5) * w * 0.6,
    ankleMid[1] + hipHeight,
    -depth - 0.05 - Math.sin(spineBend) * 0.12,
  ];

  // Hips: level with the slope.
  let hipAxis = rotate(X, Z, setup.hipTilt * DEG);
  hipAxis = rotate(hipAxis, UP, hipTurn);
  // Sink the pelvis if a turned hip would leave its leg short of the ankle.
  const legReach = (THIGH + SHIN) * 0.995;
  let sink = 0;
  for (const [side, ankle] of [
    [1, lead.ankle],
    [-1, trail.ankle],
  ] as const) {
    const hip = add(pelvis, scale(hipAxis, side * hipHalf));
    const flat = Math.hypot(hip[0] - ankle[0], hip[2] - ankle[2]);
    const high = Math.sqrt(Math.max(0, legReach * legReach - flat * flat));
    sink = Math.max(sink, hip[1] - ankle[1] - high);
  }
  pelvis = [pelvis[0], pelvis[1] - sink, pelvis[2]];
  const leadHip = add(pelvis, scale(hipAxis, hipHalf));
  const trailHip = add(pelvis, scale(hipAxis, -hipHalf));

  // Spine bends forward toward the ball and tilts away from the target with the shoulders.
  // As the hips open, the bend turns with them, so the chest faces the target at the finish.
  const yaw = hipTurn * tuning.spineFollowsHips;
  let spineDir = rotate(UP, X, spineBend);
  spineDir = rotate(spineDir, Z, setup.shoulderTilt * 0.5 * DEG);
  spineDir = rotate(spineDir, UP, yaw);
  const neck = add(pelvis, scale(spineDir, TORSO));

  // Shoulder line: tilted (lead up), then turned around the spine. Backswing turn is negative
  // rotation about the up-ish spine axis (lead shoulder moves toward the ball, then away).
  let shoulderAxis = rotate(rotate(X, Z, setup.shoulderTilt * 0.5 * DEG), UP, yaw);
  shoulderAxis = normalize(sub(shoulderAxis, scale(spineDir, dot(shoulderAxis, spineDir))));
  shoulderAxis = rotate(shoulderAxis, spineDir, -key.turn * turnMax * DEG - yaw);
  const shoulderDrop = scale(spineDir, -0.04);
  const leadShoulder = add(add(neck, scale(shoulderAxis, shoulderHalf)), shoulderDrop);
  const trailShoulder = add(add(neck, scale(shoulderAxis, -shoulderHalf)), shoulderDrop);

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

  const kneeTurn = -key.hips * turnMax * DEG * tuning.kneesFollowHips;
  const kneePole = (out: number, extra = 0) => rotate(add(Z, scale(X, out)), UP, kneeTurn + extra);

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
      leadKnee: solveTwoBone(leadHip, lead.ankle, THIGH, SHIN, kneePole(0.15)).mid,
      // With the heel up, the trail knee drives toward the target.
      trailKnee: solveTwoBone(
        trailHip,
        trail.ankle,
        THIGH,
        SHIN,
        kneePole(-0.15, heelUp * 70 * DEG),
      ).mid,
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
export function poseGolfer(scene: ShotScene, phase = 0, tuning = DEFAULT_SWING): Pose {
  const setup = deriveSetup(scene);
  const spec = CLUB_SPECS[scene.swing.club];
  const isPutt = scene.swing.club === "putter";
  const armMax = isPutt ? 18 : SWING_LENGTH_ARM[scene.swing.length];
  const hingeMax = isPutt ? 0 : Math.min(100, armMax * 0.85);
  const turnMax = isPutt ? 8 : armMax * 0.72;
  const still = { hinge: 0, rise: 0, weight: 0 };
  const keyAt = (p: number): SwingKey => {
    const arms = sampleKeys(p, tuning);
    if (isPutt) return { ...arms, ...still };
    // The body takes its keys from later in the swing than the arms, easing in from the top.
    const ramp = smoothstep((p - PHASE.top) / ((PHASE.impact - PHASE.top) / 2));
    const body = sampleKeys(p + tuning.bodyLead * ramp, tuning);
    return { ...body, p, arm: arms.arm, hinge: arms.hinge };
  };
  const address = keyAt(0);
  const key = keyAt(phase);

  // Club from hands to clubhead at address; the ball sits on the ground at the origin.
  const shaft = spec.length - 0.07 - setup.gripDown;
  const ballY = groundHeight(scene.terrain, 0, 0);
  const sole: Vec3 = [0, ballY + 0.01, -0.035];

  // Solve for how far from the ball the golfer stands so the club reaches it.
  let depth = 0.7;
  let body = buildBody(scene, setup, depth, address, turnMax, tuning);
  for (let i = 0; i < 6; i++) {
    const h = body.hands;
    const dy = h[1] - sole[1];
    const dx = h[0] - sole[0];
    const horiz = Math.sqrt(Math.max(0.01, shaft * shaft - dx * dx - dy * dy));
    const targetZ = sole[2] - horiz;
    depth += h[2] - targetZ;
    body = buildBody(scene, setup, depth, address, turnMax, tuning);
  }
  const handsAddress = body.hands;
  const shaftDir = normalize(sub(sole, handsAddress));

  // Swing plane: contains the target line and the shaft at address, hinged at the upper chest.
  const hub = add(body.joints.neck, scale(body.spineDir, -0.08));
  let normal = normalize(cross(shaftDir, X));
  const r = sub(handsAddress, hub);
  // Positive rotation must carry the hands away from the target in the backswing.
  if (dot(cross(normal, r), X) > 0) normal = scale(normal, -1);

  const posed = phase === 0 ? body : buildBody(scene, setup, depth, key, turnMax, tuning);
  const armAngle = key.arm * armMax * DEG;
  const clubAngle = armAngle + key.hinge * hingeMax * DEG;
  let clubDir = rotate(shaftDir, normal, clubAngle);
  let toeDir = rotate(Z, normal, clubAngle);
  let handsTarget = add(hub, rotate(r, normal, armAngle));
  if (!isPutt && phase > PHASE.impact) {
    // Past impact the arms swing around the turning body rather than on a plane fixed in space:
    // the plane turns with the hips and the hub travels with the chest, both from impact on.
    const atImpact = buildBody(scene, setup, depth, keyAt(PHASE.impact), turnMax, tuning);
    const yaw = (key.hips - keyAt(PHASE.impact).hips) * -turnMax * DEG * tuning.planeFollow;
    const pivot = posed.joints.pelvis;
    const shift = scale(sub(posed.joints.neck, atImpact.joints.neck), tuning.hubFollow);
    handsTarget = add(rotateAbout(handsTarget, pivot, UP, yaw), shift);
    clubDir = rotate(clubDir, UP, yaw);
    toeDir = rotate(toeDir, UP, yaw);
    // The hub stays put while the shoulders turn and rise, which would fold the lead arm right
    // after impact ("chicken wing"). Keep it extended through the ball, with the trail arm still
    // reaching the grip (alternating the two limits settles where both hold); fold at the finish.
    const fold = smoothstep((phase - tuning.foldStart) / (1 - tuning.foldStart));
    const minReach = (UPPER_ARM + FOREARM) * mix(0.95, tuning.foldReach, fold);
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
  const toe = add(hosel, scale(toeDir, 0.1));

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
