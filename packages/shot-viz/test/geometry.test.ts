import { describe, expect, it } from "vitest";
import {
  cameraPreset,
  computeFlight,
  distance,
  groundHeight,
  groundNormal,
  handed,
  parseScene,
  boneLength,
  poseGolfer,
  projector,
  rotate,
  solveTwoBone,
  timelineAt,
  PHASE,
  type ShotScene,
  type Vec3,
} from "../src/index.ts";

const close = (a: Vec3, b: Vec3, eps = 1e-9) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, -Math.log10(eps)));

describe("vector maths", () => {
  it("rotates around an axis", () => {
    close(rotate([1, 0, 0], [0, 1, 0], Math.PI / 2), [0, 0, -1]);
    close(rotate([0, 1, 0], [1, 0, 0], Math.PI / 2), [0, 0, 1]);
  });

  it("two-bone IK keeps bone lengths and bends toward the pole", () => {
    const { mid, end } = solveTwoBone([0, 1, 0], [0, 0.2, 0.1], 0.45, 0.45, [0, 0, 1]);
    expect(distance([0, 1, 0], mid)).toBeCloseTo(0.45);
    expect(distance(mid, end)).toBeCloseTo(0.45);
    expect(mid[2]).toBeGreaterThan(0.1);
  });

  it("two-bone IK straightens toward unreachable targets", () => {
    const { end } = solveTwoBone([0, 0, 0], [5, 0, 0], 1, 1, [0, 1, 0]);
    expect(end[0]).toBeCloseTo(2, 3);
  });
});

describe("terrain", () => {
  it("is level by default with the ball at the origin", () => {
    const t = { slopeAlong: 0, slopeAcross: 0 };
    expect(groundHeight(t, 3, -2)).toBe(0);
    close(groundNormal(t, 0, 0), [0, 1, 0]);
  });

  it("rises toward the target on an uphill lie and toward the ball with it above the feet", () => {
    expect(groundHeight({ slopeAlong: 10, slopeAcross: 0 }, 1, 0)).toBeCloseTo(
      Math.tan((10 * Math.PI) / 180),
    );
    expect(groundHeight({ slopeAlong: 0, slopeAcross: 10 }, 0, -0.8)).toBeLessThan(0);
  });

  it("levels out away from the ball (a terrace, not an endless slope)", () => {
    const t = { slopeAlong: 10, slopeAcross: 0 };
    const far = groundHeight(t, 100, 0);
    expect(far).toBeLessThan(Math.tan((10 * Math.PI) / 180) * 8);
    expect(groundHeight(t, 200, 0)).toBeCloseTo(far, 3);
    expect(groundNormal(t, 100, 0)[1]).toBeCloseTo(1, 3);
  });
});

describe("golfer pose", () => {
  const flat = parseScene({ id: "flat", title: "Flat" });

  it("addresses the ball with the clubhead at the ball", () => {
    const pose = poseGolfer(flat);
    expect(distance(pose.club.hosel, [0, 0, 0])).toBeLessThan(0.08);
  });

  it("stands a right-hander on the near side (−z), head above hips above feet", () => {
    const { joints } = poseGolfer(flat);
    expect(joints.leadAnkle[2]).toBeLessThan(-0.4);
    expect(joints.head[1]).toBeGreaterThan(joints.pelvis[1]);
    expect(joints.pelvis[1]).toBeGreaterThan(joints.leadKnee[1]);
    expect(joints.leadAnkle[0]).toBeGreaterThan(joints.trailAnkle[0]);
  });

  it("keeps limb lengths constant through the swing", () => {
    const lengths = (p: number) => {
      const j = poseGolfer(flat, p).joints;
      return [
        distance(j.leadHip, j.leadKnee),
        distance(j.leadKnee, j.leadAnkle),
        distance(j.leadShoulder, j.leadElbow),
      ];
    };
    const a = lengths(0);
    for (const p of [0.2, PHASE.top, PHASE.impact, 1])
      lengths(p).forEach((l, i) => expect(l).toBeCloseTo(a[i]!, 5));
  });

  it("takes the hands back and up at the top, and returns the club to the ball at impact", () => {
    const address = poseGolfer(flat, 0);
    const top = poseGolfer(flat, PHASE.top);
    const impact = poseGolfer(flat, PHASE.impact);
    expect(top.joints.leadHand[0]).toBeLessThan(address.joints.leadHand[0] - 0.2);
    expect(top.joints.leadHand[1]).toBeGreaterThan(address.joints.leadHand[1] + 0.4);
    expect(top.club.hosel[1]).toBeGreaterThan(top.joints.leadHand[1]);
    expect(distance(impact.club.hosel, [0, 0, 0])).toBeLessThan(0.15);
  });

  it("extends both arms through the ball (no chicken wing), folding only at the finish", () => {
    for (const p of [0.7, 0.75, 0.8]) {
      const j = poseGolfer(flat, p).joints;
      expect(distance(j.leadShoulder, j.leadHand)).toBeGreaterThan(0.54);
      expect(distance(j.trailShoulder, j.trailHand)).toBeGreaterThan(0.54);
      expect(distance(j.leadHand, j.trailHand)).toBeCloseTo(0.11, 2);
    }
    const finish = poseGolfer(flat, 1).joints;
    expect(distance(finish.leadShoulder, finish.leadHand)).toBeLessThan(0.5);
  });

  it("lifts the trail heel through to the finish, less in a short swing and not in a putt", () => {
    const rise = (scene: ShotScene) =>
      poseGolfer(scene, 1).joints.trailAnkle[1] - poseGolfer(scene, 0).joints.trailAnkle[1];
    const half = parseScene({ id: "h", title: "h", swing: { length: "half" } });
    const putt = parseScene({ id: "p", title: "p", swing: { club: "putter" } });
    expect(rise(flat)).toBeGreaterThan(0.04);
    expect(rise(half)).toBeGreaterThan(0.005);
    expect(rise(half)).toBeLessThan(rise(flat));
    expect(rise(putt)).toBeCloseTo(0, 5);
    expect(poseGolfer(flat, 0.2).joints.trailAnkle[1]).toBeCloseTo(
      poseGolfer(flat, 0).joints.trailAnkle[1],
      5,
    );
  });

  it("tilts the shoulders with the slope", () => {
    const tilt = (slopeAlong: number) => {
      const j = poseGolfer(parseScene({ id: "s", title: "s", terrain: { slopeAlong } })).joints;
      return j.leadShoulder[1] - j.trailShoulder[1];
    };
    expect(tilt(10)).toBeGreaterThan(tilt(0));
    expect(tilt(-10)).toBeLessThan(tilt(0));
    expect(tilt(-10)).toBeLessThan(0);
  });

  it("stands taller with the ball above the feet and lower with it below", () => {
    const head = (slopeAcross: number) =>
      poseGolfer(parseScene({ id: "s", title: "s", terrain: { slopeAcross } })).joints.head[1] -
      groundHeight({ slopeAlong: 0, slopeAcross }, 0, -0.8);
    expect(head(10)).toBeGreaterThan(head(0));
    expect(head(-10)).toBeLessThan(head(0));
  });

  it("turns the whole setup with aim", () => {
    const aimed = poseGolfer(parseScene({ id: "a", title: "a", golfer: { aim: 10 } }));
    const straight = poseGolfer(flat);
    // Aiming right swings the golfer (who stands at −z) toward the target side.
    expect(aimed.joints.pelvis[0]).toBeGreaterThan(straight.joints.pelvis[0]);
  });

  it("gives a woman narrower shoulders and wider hips", () => {
    const woman = poseGolfer(parseScene({ id: "w", title: "w", golfer: { gender: "female" } }));
    const man = poseGolfer(flat);
    const shoulders = (pose: typeof man) => boneLength(pose, "leadShoulder", "trailShoulder");
    const hips = (pose: typeof man) => boneLength(pose, "leadHip", "trailHip");
    expect(shoulders(woman)).toBeLessThan(shoulders(man));
    expect(hips(woman)).toBeGreaterThan(hips(man));
  });
});

describe("cameras and projection", () => {
  const scene = parseScene({ id: "c", title: "c" });
  const flight = computeFlight(scene);

  it("face-on puts the target on the right for a right-hander and the left for a left-hander", () => {
    const right = projector(cameraPreset("face-on", flight));
    expect(right.project([5, 0, 0])!.x).toBeGreaterThan(right.project([-5, 0, 0])!.x);
    const lefty = parseScene({ id: "l", title: "l", golfer: { handedness: "left" } });
    const cam = cameraPreset("face-on", flight);
    const mirrored = projector({
      ...cam,
      position: handed(lefty, cam.position),
      target: handed(lefty, cam.target),
    });
    expect(mirrored.project([5, 0, 0])!.x).toBeLessThan(mirrored.project([-5, 0, 0])!.x);
  });

  it("down-the-line shows a right-hander to the left of the ball", () => {
    const p = projector(cameraPreset("down-the-line", flight));
    expect(p.project([0, 1, -0.8])!.x).toBeLessThan(p.project([0, 0, 0])!.x);
  });

  it("projects up as up (negative screen y) and drops points behind the camera", () => {
    const p = projector(cameraPreset("face-on", flight));
    expect(p.project([0, 2, 0])!.y).toBeLessThan(p.project([0, 0, 0])!.y);
    expect(p.project([0, 1, 50])).toBeNull();
  });

  it("overhead puts the target at the top of the frame", () => {
    const p = projector(cameraPreset("overhead", flight));
    expect(p.project([100, 0, 0])!.y).toBeLessThan(p.project([10, 0, 0])!.y);
    expect(p.project([50, 0, 10])!.x).toBeGreaterThan(p.project([50, 0, -10])!.x);
  });
});

describe("timeline", () => {
  it("runs address → top → impact → finish with the ball leaving at impact", () => {
    expect(timelineAt(0).phase).toBe(0);
    const impact = timelineAt(1.2);
    expect(impact.phase).toBeCloseTo(PHASE.impact);
    expect(impact.ballTime).toBeCloseTo(0);
    expect(timelineAt(10).phase).toBe(1);
    expect(timelineAt(0.9).phase).toBeCloseTo(PHASE.top);
  });
});
