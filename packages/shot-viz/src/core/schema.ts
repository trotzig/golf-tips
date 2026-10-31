import { z } from "zod";

/**
 * ShotScene: a declarative, serialisable description of a golf shot that any renderer can draw.
 *
 * Conventions (see README):
 * - Units are metres, seconds, degrees and metres per second.
 * - Lateral directions are written for a right-handed golfer ("right" = the side a slice goes).
 *   Left-handed scenes are drawn as the mirror image, so the same numbers work for both.
 * - Optional golfer values are derived from the terrain when omitted ("slope-adjusted").
 */

export const SCENE_VERSION = 1;

export const lieTypes = ["fairway", "rough", "bunker", "fringe", "green", "tee"] as const;
export const grassLengths = ["none", "short", "medium", "long"] as const;
export const firmnessLevels = ["soft", "normal", "firm"] as const;
export const clubs = [
  "driver",
  "3-wood",
  "hybrid",
  "5-iron",
  "7-iron",
  "9-iron",
  "pitching-wedge",
  "sand-wedge",
  "lob-wedge",
  "putter",
] as const;
export const swingLengths = ["quarter", "half", "three-quarter", "full"] as const;
export const trajectories = ["low", "normal", "high"] as const;
export const cameraPresets = ["face-on", "down-the-line", "behind", "overhead"] as const;
export const stanceWidths = ["narrow", "normal", "wide"] as const;
/** Changes the golfer's figure only (build and hair); the outfit is the same for both. */
export const genders = ["male", "female"] as const;

const degrees = (min: number, max: number) => z.number().min(min).max(max);
const vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const terrainSchema = z.object({
  /** Slope along the target line. Positive = ground rises toward the target (uphill lie). */
  slopeAlong: degrees(-30, 30).default(0),
  /**
   * Slope across the target line. Positive = ground rises from the golfer toward the ball
   * (ball above feet); negative = ball below feet.
   */
  slopeAcross: degrees(-30, 30).default(0),
  lie: z.enum(lieTypes).default("fairway"),
  grass: z.enum(grassLengths).optional(),
  /** Ground firmness where the ball lands; affects roll. */
  firmness: z.enum(firmnessLevels).default("normal"),
});

export const golferSchema = z.object({
  handedness: z.enum(["right", "left"]).default("right"),
  gender: z.enum(genders).default("male"),
  stanceWidth: z.enum(stanceWidths).default("normal"),
  /** Aim of the whole body and club, degrees right (+) or left (−) of the target line. */
  aim: degrees(-45, 45).default(0),
  /** Stance line relative to the aim line: positive = open (lead foot pulled back). */
  alignment: degrees(-30, 30).default(0),
  /** Share of weight on the lead foot, 0–1. Derived from the slope when omitted. */
  weightLead: z.number().min(0).max(1).optional(),
  /** Shoulder tilt in degrees; positive = lead shoulder higher. Derived when omitted. */
  shoulderTilt: degrees(-40, 40).optional(),
  /** Ball position: −1 = trail foot, 0 = centre, 1 = lead heel. Derived when omitted. */
  ballPosition: z.number().min(-1).max(1).optional(),
  /** How far down the grip the hands are, in metres (e.g. 0.05). Derived when omitted. */
  gripDown: z.number().min(0).max(0.15).optional(),
});

export const swingSchema = z.object({
  club: z.enum(clubs).default("7-iron"),
  length: z.enum(swingLengths).default("full"),
  /** Club path relative to the aim line; positive = in-to-out (right for a right-hander). */
  path: degrees(-15, 15).default(0),
  /** Face angle relative to the aim line at impact; positive = open (right). */
  face: degrees(-15, 15).default(0),
  /** Attack angle; negative = hitting down. */
  attackAngle: degrees(-10, 10).optional(),
});

export const windSchema = z.object({
  /** Wind speed in metres per second (5 m/s ≈ 11 mph). */
  speed: z.number().min(0).max(25),
  /** Where the wind comes from: 0 = from the target (into), 90 = from the right, 180 = behind. */
  from: z.number().min(0).max(360),
});

export const flightSchema = z.object({
  trajectory: z.enum(trajectories).default("normal"),
  /** Overrides for the club's typical launch conditions. */
  launchAngle: degrees(0, 60).optional(),
  ballSpeed: z.number().min(0).max(90).optional(),
  spinRpm: z.number().min(0).max(12000).optional(),
  wind: windSchema.optional(),
});

export const annotationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum([
      "target-line",
      "aim-line",
      "start-line",
      "shoulder-line",
      "slope-line",
      "ball-flight",
    ]),
    label: z.string().max(60).optional(),
  }),
  z.object({
    type: z.literal("arrow"),
    from: vec3,
    to: vec3,
    label: z.string().max(60).optional(),
  }),
]);

export const shotSceneSchema = z.object({
  version: z.literal(SCENE_VERSION).default(SCENE_VERSION),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ids are kebab-case"),
  title: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  terrain: terrainSchema.prefault({}),
  golfer: golferSchema.prefault({}),
  swing: swingSchema.prefault({}),
  flight: flightSchema.prefault({}),
  annotations: z.array(annotationSchema).default([]),
  /**
   * What to expect and what to do about it, in plain words (no numbers), shown next to the
   * diagram. Write directions for a right-hander with `{left}`/`{right}` tokens; they flip for left-handers.
   */
  tips: z.array(z.string().min(1).max(120)).max(4).default([]),
  camera: z.enum(cameraPresets).default("face-on"),
});

/** A scene as written by authors (most fields optional). */
export type ShotSceneInput = z.input<typeof shotSceneSchema>;
/** A parsed scene with defaults filled in. Renderers take this. */
export type ShotScene = z.output<typeof shotSceneSchema>;
export type Terrain = ShotScene["terrain"];
export type Golfer = ShotScene["golfer"];
export type Swing = ShotScene["swing"];
export type Flight = ShotScene["flight"];
export type Wind = z.output<typeof windSchema>;
export type Annotation = ShotScene["annotations"][number];
export type Club = (typeof clubs)[number];
export type SwingLength = (typeof swingLengths)[number];
export type CameraPreset = (typeof cameraPresets)[number];
export type Lie = (typeof lieTypes)[number];

/** Parse and fill defaults; throws a ZodError with readable paths on invalid input. */
export function parseScene(input: unknown): ShotScene {
  return shotSceneSchema.parse(input);
}

export function safeParseScene(input: unknown) {
  return shotSceneSchema.safeParse(input);
}
