import { describe, expect, it } from "vitest";
import { buildShapes2D, exampleScenes, shapeMarkup, shapesMarkup } from "../src/index.ts";

describe("SVG markup", () => {
  it("escapes text and attributes", () => {
    const text = shapeMarkup({
      kind: "text",
      at: { x: 1.04, y: 2 },
      text: `<"Lift" & roll>`,
      size: 12,
      fill: "#000",
      anchor: "start",
    });
    expect(text).toContain("&#60;&#34;Lift&#34; &#38; roll&#62;");
    expect(text).toContain('x="1"');
  });

  it("draws an arrowhead for arrowed lines", () => {
    const line = shapeMarkup({
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
      stroke: "#f00",
      strokeWidth: 2,
      arrow: true,
    });
    expect(line.match(/<polygon/g)).toHaveLength(1);
  });

  it("emits one element per shape", () => {
    const out = buildShapes2D(exampleScenes["lob-shot"]!, { view: "face-on" });
    const markup = shapesMarkup(out.shapes);
    const elements = markup.match(/<(polygon|polyline|circle|text)\b/g) ?? [];
    const arrows = out.shapes.filter((s) => s.kind === "polyline" && s.arrow).length;
    expect(elements.length).toBe(out.shapes.length + arrows);
  });
});
