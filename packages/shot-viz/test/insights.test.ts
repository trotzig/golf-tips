import { describe, expect, it } from "vitest";
import { compareWithNormal, exampleScenes, normalScene, setupInsight } from "../src/index.ts";

describe("normal shot", () => {
  it("keeps the club, hand and golfer and drops everything else", () => {
    const scene = { ...exampleScenes["downhill-lie"]! };
    scene.golfer = { ...scene.golfer, handedness: "left", gender: "female" };
    const normal = normalScene(scene);
    expect(normal.swing.club).toBe(scene.swing.club);
    expect(normal.golfer.handedness).toBe("left");
    expect(normal.golfer.gender).toBe("female");
    expect(normal.terrain.slopeAlong).toBe(0);
    expect(normal.golfer.aim).toBe(0);
    expect(normal.swing.length).toBe("full");
  });
});

describe("setup insight", () => {
  it("finds nothing unusual in a normal shot", () => {
    const i = setupInsight(exampleScenes["flat-lie"]!);
    expect([i.ballPosition, i.weight, i.stance, i.matchesSlope]).toEqual([
      "normal",
      "even",
      "normal",
      false,
    ]);
  });

  it("moves the ball toward the higher foot on slopes", () => {
    const down = setupInsight(exampleScenes["downhill-lie"]!);
    expect([down.ballPosition, down.weight, down.matchesSlope]).toEqual(["less", "lead", true]);
    const up = setupInsight(exampleScenes["uphill-lie"]!);
    expect([up.ballPosition, up.weight]).toEqual(["more", "trail"]);
  });

  it("narrows the stance for a chip", () => {
    expect(setupInsight(exampleScenes["basic-chip"]!).stance).toBe("narrow");
  });
});

describe("flight comparison", () => {
  it("matches a normal shot with itself", () => {
    const c = compareWithNormal(exampleScenes["flat-lie"]!);
    expect([c.height, c.roll, c.curve]).toEqual(["normal", "normal", "none"]);
  });

  it("flies a downhill lie lower, with more roll, curving right", () => {
    const c = compareWithNormal(exampleScenes["downhill-lie"]!);
    expect([c.height, c.roll, c.curve]).toEqual(["less", "more", "right"]);
  });

  it("flies an uphill lie higher, with less roll, curving left", () => {
    const c = compareWithNormal(exampleScenes["uphill-lie"]!);
    expect([c.height, c.roll, c.curve]).toEqual(["more", "less", "left"]);
  });

  it("sees the shape of a curve, not the aim", () => {
    expect(compareWithNormal(exampleScenes["intentional-draw"]!).curve).toBe("left");
    expect(compareWithNormal(exampleScenes["intentional-fade"]!).curve).toBe("right");
  });

  it("compares a chip by shape: low and mostly rolling", () => {
    const c = compareWithNormal(exampleScenes["basic-chip"]!);
    expect([c.height, c.roll]).toEqual(["less", "much-more"]);
  });

  it("doesn't call a short wedge that stops quickly a rolling shot", () => {
    for (const id of ["greenside-bunker", "pitch-shot", "lob-shot"]) {
      expect(compareWithNormal(exampleScenes[id]!).roll, id).toBe("normal");
    }
  });

  it("still sees a plugged lie run out", () => {
    expect(compareWithNormal(exampleScenes["plugged-bunker-lie"]!).roll).toBe("much-more");
  });
});
