import { arrowHead, type Pt, type Shape } from "./shapes.ts";

// 2D shapes as a list of SVG elements with camelCase props, for renderers that build an element
// tree instead of a markup string (react-native-svg). Mirrors `markup.ts`, which the web uses.

export type SvgElement =
  | { tag: "polygon"; props: Record<string, string | number> }
  | { tag: "polyline"; props: Record<string, string | number> }
  | { tag: "circle"; props: Record<string, string | number> }
  | { tag: "text"; props: Record<string, string | number>; text: string };

const round = (n: number) => Math.round(n * 10) / 10;

const pts = (points: Pt[]) => points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");

/** Drops undefined values and rounds numbers, like the markup output. */
function clean(
  values: Record<string, string | number | undefined>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined) out[k] = typeof v === "number" ? round(v) : v;
  }
  return out;
}

export function shapeElements(shape: Shape): SvgElement[] {
  switch (shape.kind) {
    case "polygon":
      return [
        {
          tag: "polygon",
          props: clean({
            points: pts(shape.points),
            fill: shape.fill,
            stroke: shape.stroke,
            strokeWidth: shape.strokeWidth,
            strokeLinejoin: "round",
            opacity: shape.opacity,
          }),
        },
      ];
    case "polyline": {
      const line: SvgElement = {
        tag: "polyline",
        props: clean({
          points: pts(shape.points),
          fill: "none",
          stroke: shape.stroke,
          strokeWidth: shape.strokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeDasharray: shape.dash?.join(" "),
          opacity: shape.opacity,
        }),
      };
      if (!shape.arrow) return [line];
      const head = arrowHead(shape.points, Math.max(9, shape.strokeWidth * 3.5));
      if (!head) return [line];
      return [
        line,
        {
          tag: "polygon",
          props: clean({ points: pts(head), fill: shape.stroke, opacity: shape.opacity }),
        },
      ];
    }
    case "circle":
      return [
        {
          tag: "circle",
          props: clean({
            cx: shape.c.x,
            cy: shape.c.y,
            r: shape.r,
            fill: shape.fill,
            stroke: shape.stroke,
            strokeWidth: shape.strokeWidth,
          }),
        },
      ];
    case "text": {
      const base = {
        x: shape.at.x,
        y: shape.at.y,
        fontSize: shape.size,
        fontWeight: shape.weight,
        textAnchor: shape.anchor,
      };
      const fill: SvgElement = {
        tag: "text",
        props: clean({ ...base, fill: shape.fill }),
        text: shape.text,
      };
      if (!shape.halo) return [fill];
      // No paint-order in react-native-svg: draw the halo as a stroked copy underneath.
      const halo: SvgElement = {
        tag: "text",
        props: clean({
          ...base,
          fill: shape.halo,
          stroke: shape.halo,
          strokeWidth: 3.5,
          strokeLinejoin: "round",
        }),
        text: shape.text,
      };
      return [halo, fill];
    }
  }
}

/** All shapes, painted in order, as SVG elements. */
export function shapesElements(shapes: Shape[]): SvgElement[] {
  return shapes.flatMap(shapeElements);
}
