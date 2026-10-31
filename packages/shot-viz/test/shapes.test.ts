import { describe, expect, it } from "vitest";
import {
  buildShapes2D,
  cameraPresets,
  describeScene,
  exampleScenes,
  parseScene,
} from "../src/index.ts";

describe("2D shapes", () => {
  it("builds finite shapes for every example scene and view", () => {
    for (const scene of Object.values(exampleScenes)) {
      for (const view of cameraPresets) {
        const out = buildShapes2D(scene, { view });
        expect(out.shapes.length).toBeGreaterThan(20);
        // Size budget: diagrams are inlined in every situation page, twice (both hands).
        expect(out.shapes.length).toBeLessThan(400);
        for (const s of out.shapes) {
          const pts = s.kind === "circle" ? [s.c] : s.kind === "text" ? [s.at] : s.points;
          for (const p of pts) {
            expect(Number.isFinite(p.x)).toBe(true);
            expect(Number.isFinite(p.y)).toBe(true);
          }
        }
      }
    }
  });

  it("draws labels last so they sit on top", () => {
    const out = buildShapes2D(exampleScenes["uphill-lie"]!, { view: "face-on" });
    const firstText = out.shapes.findIndex((s) => s.kind === "text");
    expect(firstText).toBeGreaterThan(0);
    expect(out.shapes.slice(firstText).every((s) => s.kind === "text")).toBe(true);
    expect(out.shapes.some((s) => s.kind === "text" && s.text === "Slope")).toBe(true);
  });

  it("mirrors the drawing for a left-handed golfer", () => {
    const right = parseScene({ id: "r", title: "r" });
    const left = parseScene({ id: "l", title: "l", golfer: { handedness: "left" } });
    const head = (s: typeof right) => {
      const circles = buildShapes2D(s, { view: "down-the-line", width: 400 }).shapes.filter(
        (x) => x.kind === "circle",
      );
      return circles.reduce((a, b) => (b.r > a.r ? b : a));
    };
    expect(head(right).c.x).toBeCloseTo(400 - head(left).c.x, 3);
  });

  it("hides the ball flight before impact when animating", () => {
    const scene = exampleScenes["flat-lie"]!;
    const before = buildShapes2D(scene, { view: "behind", ballTime: -0.5 });
    const after = buildShapes2D(scene, { view: "behind", ballTime: 2 });
    const flightLines = (o: typeof before) =>
      o.shapes.filter((s) => s.kind === "polyline" && s.stroke === "#d9480f");
    expect(flightLines(before)).toHaveLength(0);
    expect(flightLines(after)).toHaveLength(1);
  });

  it("describes the scene in plain language for screen readers", () => {
    const scene = exampleScenes["uphill-lie"]!;
    const text = describeScene(scene, "face-on");
    expect(text).toMatch(
      /^Face-on view: a right-handed golfer with a 7-iron on an uphill lie \(10° up toward the target\)/,
    );
    expect(text).not.toMatch(/\d+ m\b/);
    expect(text).toContain(scene.tips[0]);
    const wind = describeScene(exampleScenes["into-the-wind"]!);
    expect(wind).toMatch(/Wind 20 mph into the golfer's face/);
  });
});
