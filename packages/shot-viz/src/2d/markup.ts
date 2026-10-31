import { arrowHead, type Pt, type Shape } from "./shapes.ts";

// SVG markup for 2D shapes, as a plain string: the same output on the server (React's
// `dangerouslySetInnerHTML`) and in the browser, where the player swaps it in every frame.

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const num = (n: number) => String(Math.round(n * 10) / 10);

const pts = (points: Pt[]) => points.map((p) => `${num(p.x)},${num(p.y)}`).join(" ");

function attrs(values: Record<string, string | number | undefined>): string {
  return Object.entries(values)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${typeof v === "number" ? num(v) : escape(v!)}"`)
    .join("");
}

export function shapeMarkup(shape: Shape): string {
  switch (shape.kind) {
    case "polygon":
      return `<polygon${attrs({
        points: pts(shape.points),
        fill: shape.fill,
        stroke: shape.stroke,
        "stroke-width": shape.strokeWidth,
        "stroke-linejoin": "round",
        opacity: shape.opacity,
      })}/>`;
    case "polyline": {
      const head = shape.arrow
        ? arrowHead(shape.points, Math.max(9, shape.strokeWidth * 3.5))
        : null;
      const line = `<polyline${attrs({
        points: pts(shape.points),
        fill: "none",
        stroke: shape.stroke,
        "stroke-width": shape.strokeWidth,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-dasharray": shape.dash?.join(" "),
      })}/>`;
      const arrow = head ? `<polygon${attrs({ points: pts(head), fill: shape.stroke })}/>` : "";
      return `<g${attrs({ opacity: shape.opacity })}>${line}${arrow}</g>`;
    }
    case "circle":
      return `<circle${attrs({
        cx: shape.c.x,
        cy: shape.c.y,
        r: shape.r,
        fill: shape.fill,
        stroke: shape.stroke,
        "stroke-width": shape.strokeWidth,
      })}/>`;
    case "text":
      return `<text${attrs({
        x: shape.at.x,
        y: shape.at.y,
        "font-size": shape.size,
        "font-weight": shape.weight,
        "font-family": "system-ui, sans-serif",
        "text-anchor": shape.anchor,
        fill: shape.fill,
        stroke: shape.halo,
        "stroke-width": shape.halo ? 3.5 : undefined,
        "stroke-linejoin": "round",
        "paint-order": "stroke",
      })}>${escape(shape.text)}</text>`;
  }
}

/** All shapes, painted in order, as SVG markup to put inside an `<svg>` or `<g>`. */
export function shapesMarkup(shapes: Shape[]): string {
  return shapes.map(shapeMarkup).join("");
}
