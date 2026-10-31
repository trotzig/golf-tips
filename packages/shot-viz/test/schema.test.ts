import { describe, expect, it } from "vitest";
import {
  exampleSceneInputs,
  exampleScenes,
  parseScene,
  safeParseScene,
  SCENE_VERSION,
} from "../src/index.ts";

describe("ShotScene schema", () => {
  it("fills defaults for a minimal scene", () => {
    const scene = parseScene({ id: "minimal", title: "Minimal" });
    expect(scene.version).toBe(SCENE_VERSION);
    expect(scene.terrain).toMatchObject({ slopeAlong: 0, slopeAcross: 0, lie: "fairway" });
    expect(scene.golfer.handedness).toBe("right");
    expect(scene.swing).toMatchObject({ club: "7-iron", length: "full" });
    expect(scene.camera).toBe("face-on");
    expect(scene.annotations).toEqual([]);
  });

  it("rejects bad ids, out-of-range slopes and unknown cameras", () => {
    expect(safeParseScene({ id: "Not Kebab", title: "x" }).success).toBe(false);
    expect(safeParseScene({ id: "x", title: "x", terrain: { slopeAlong: 60 } }).success).toBe(
      false,
    );
    expect(safeParseScene({ id: "x", title: "x", camera: "drone" }).success).toBe(false);
  });

  it("round-trips through JSON", () => {
    for (const scene of Object.values(exampleScenes)) {
      expect(parseScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
    }
  });

  it("ships the required example scenes, all valid", () => {
    const ids = exampleSceneInputs.map((s) => s.id);
    for (const id of [
      "flat-lie",
      "uphill-lie",
      "downhill-lie",
      "ball-above-feet",
      "into-the-wind",
      "high-shot",
      "low-shot",
    ]) {
      expect(ids).toContain(id);
    }
    for (const input of exampleSceneInputs) expect(safeParseScene(input).success).toBe(true);
  });
});
