import { describe, expect, it } from "vitest";
import { buildShapes2D, exampleScenes, forHand, handedScene } from "../src/index.ts";

describe("handedness", () => {
  it("resolves direction tokens", () => {
    expect(forHand("{Right} to {left}", "right")).toBe("Right to left");
    expect(forHand("{Right} to {left}", "left")).toBe("Left to right");
    expect(forHand("keep {unknown}", "left")).toBe("keep {unknown}");
  });

  it("flips a scene's text and golfer for left-handers", () => {
    const draw = exampleScenes["intentional-draw"]!;
    const lefty = handedScene(draw, "left");
    expect(lefty.golfer.handedness).toBe("left");
    expect(lefty.tips.join(" ")).toMatch(/aim your feet, hips and shoulders left/i);
    expect(lefty.annotations.map((a) => a.label)).toContain("Starts left, curves right");
    expect(handedScene(lefty)).toEqual(lefty);
  });

  it("never leaves tokens or one-handed wording in rendered text", () => {
    for (const scene of Object.values(exampleScenes)) {
      for (const hand of ["right", "left"] as const) {
        const shapes = buildShapes2D(handedScene(scene, hand));
        const text = [
          shapes.description,
          ...shapes.shapes.flatMap((s) => (s.kind === "text" ? [s.text] : [])),
        ].join(" ");
        expect(text).not.toMatch(/[{}]|mirror this|left-handers/);
      }
    }
  });
});
