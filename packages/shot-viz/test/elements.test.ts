import { describe, expect, it } from "vitest";
import { buildShapes2D, exampleScenes, shapeElements, shapesElements } from "../src/index.ts";

describe("SVG elements (react-native-svg)", () => {
  it("uses camelCase props and rounds numbers", () => {
    const [circle] = shapeElements({
      kind: "circle",
      c: { x: 1.04, y: 2 },
      r: 3,
      fill: "#fff",
      strokeWidth: 1.26,
    });
    expect(circle).toEqual({
      tag: "circle",
      props: { cx: 1, cy: 2, r: 3, fill: "#fff", strokeWidth: 1.3 },
    });
  });

  it("shows wind speeds in the requested unit", () => {
    const shape = {
      kind: "text",
      at: { x: 0, y: 0 },
      text: "Wind 20 mph",
      size: 12,
      fill: "#000",
      anchor: "start",
      wind: { mph: "Wind 20 mph", "m/s": "Wind 9 m/s" },
    } as const;
    expect(shapeElements(shape)[0]).toMatchObject({ text: "Wind 20 mph" });
    expect(shapeElements(shape, "m/s")[0]).toMatchObject({ text: "Wind 9 m/s" });
  });

  it("draws a text halo as a stroked copy underneath", () => {
    const els = shapeElements({
      kind: "text",
      at: { x: 0, y: 0 },
      text: "Aim",
      size: 12,
      fill: "#000",
      anchor: "middle",
      halo: "#fff",
    });
    expect(els.map((e) => e.props.fill)).toEqual(["#fff", "#000"]);
    expect(els[0]!.props.stroke).toBe("#fff");
    expect(els[1]!.props.stroke).toBeUndefined();
  });

  it("matches the web markup element for element", () => {
    const out = buildShapes2D(exampleScenes["lob-shot"]!, { view: "face-on" });
    const arrows = out.shapes.filter((s) => s.kind === "polyline" && s.arrow).length;
    const halos = out.shapes.filter((s) => s.kind === "text" && s.halo).length;
    expect(shapesElements(out.shapes)).toHaveLength(out.shapes.length + arrows + halos);
  });
});
