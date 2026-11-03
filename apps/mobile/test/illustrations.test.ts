import { compareWithNormal, exampleScenes } from "@shotbook/shot-viz";
import { describe, expect, it } from "vitest";
import {
  clockPoint,
  clubLadder,
  flightPaths,
  side,
  tiltedLine,
  topPath,
} from "../src/lib/illustrations.ts";

describe("side", () => {
  it("puts the lead side on the left for a right-hander and on the right for a left-hander", () => {
    expect(side(-1, 100, false)).toBe(0);
    expect(side(-1, 100, true)).toBe(100);
  });
});

describe("tiltedLine", () => {
  it("raises the lead end", () => {
    const right = tiltedLine(10, 40, 30, false);
    expect(right.x1).toBeLessThan(right.x2);
    expect(right.y1).toBeLessThan(right.y2);
    const left = tiltedLine(10, 40, 30, true);
    expect(left.x1).toBeGreaterThan(left.x2);
    expect(left.y1).toBe(right.y1);
  });
});

describe("clockPoint", () => {
  it("swings a right-hander's club back up the left side", () => {
    expect(clockPoint(9, 40, false)[0]).toBeLessThan(56);
    expect(clockPoint(9, 40, true)[0]).toBeGreaterThan(56);
  });
});

describe("clubLadder", () => {
  it("spans two clubs either way and picks the change", () => {
    const { steps, spoken } = clubLadder(-1);
    expect(steps.map((s) => s.n)).toEqual([-2, -1, 0, 1, 2]);
    expect(steps.filter((s) => s.picked).map((s) => s.label)).toEqual(["1 less"]);
    expect(spoken).toBe("Take one club less.");
  });

  it("widens for a range beyond two clubs", () => {
    const { steps, spoken } = clubLadder([1, 3]);
    expect(steps.at(-1)?.label).toBe("3 more");
    expect(spoken).toBe("Take one club more or three clubs more.");
  });
});

describe("flight paths", () => {
  const scene = Object.values(exampleScenes)[0]!;
  const cmp = compareWithNormal(scene);

  it("draws both flights as paths and lands inside the drawing", () => {
    const paths = flightPaths(cmp);
    expect(paths.shot).toMatch(/^M[\d.]+ [\d.]+ L/);
    expect(paths.normal).toMatch(/^M/);
    expect(paths.landX).toBeGreaterThan(12);
    expect(paths.landX).toBeLessThanOrEqual(288);
  });

  it("mirrors the view from above for a left-hander", () => {
    expect(topPath(cmp, false)).toMatch(/^M/);
    expect(topPath(cmp, true)).toMatch(/^M/);
  });
});
