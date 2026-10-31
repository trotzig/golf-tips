import { useId, useMemo, type CSSProperties } from "react";
import {
  arrowHead,
  buildShapes2D,
  type Pt,
  type Shape,
  type Shapes2DOptions,
} from "../2d/shapes.ts";
import type { ShotScene } from "../core/schema.ts";

export interface ShotDiagramProps extends Shapes2DOptions {
  scene: ShotScene;
  className?: string;
  style?: CSSProperties;
  /** Overrides the generated accessible description. */
  description?: string;
}

const pts = (points: Pt[]) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

function renderShape(shape: Shape, key: number) {
  switch (shape.kind) {
    case "polygon":
      return (
        <polygon
          key={key}
          points={pts(shape.points)}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          strokeLinejoin="round"
          opacity={shape.opacity}
        />
      );
    case "polyline": {
      const head = shape.arrow
        ? arrowHead(shape.points, Math.max(9, shape.strokeWidth * 3.5))
        : null;
      return (
        <g key={key} opacity={shape.opacity}>
          <polyline
            points={pts(shape.points)}
            fill="none"
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={shape.dash?.join(" ")}
          />
          {head && <polygon points={pts(head)} fill={shape.stroke} />}
        </g>
      );
    }
    case "circle":
      return (
        <circle
          key={key}
          cx={shape.c.x}
          cy={shape.c.y}
          r={shape.r}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
        />
      );
    case "text":
      return (
        <text
          key={key}
          x={shape.at.x}
          y={shape.at.y}
          fontSize={shape.size}
          fontWeight={shape.weight}
          fontFamily="system-ui, sans-serif"
          textAnchor={shape.anchor}
          fill={shape.fill}
          stroke={shape.halo}
          strokeWidth={shape.halo ? 3.5 : undefined}
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {shape.text}
        </text>
      );
  }
}

/**
 * 2D shot diagram as inline SVG. Works without WebGL and renders on the server (Astro) with no
 * client JavaScript. Exposed to assistive tech as one image with a generated description.
 */
export function ShotDiagram({
  scene,
  className,
  style,
  description,
  ...options
}: ShotDiagramProps) {
  const id = useId();
  const { view, phase, ballTime, width, height, theme, flight } = options;
  const out = useMemo(
    () => buildShapes2D(scene, { view, phase, ballTime, width, height, theme, flight }),
    [scene, view, phase, ballTime, width, height, theme, flight],
  );
  return (
    <svg
      viewBox={`0 0 ${out.width} ${out.height}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
      className={className}
      style={{ display: "block", width: "100%", height: "auto", ...style }}
    >
      <title id={`${id}-title`}>{out.title}</title>
      <desc id={`${id}-desc`}>{description ?? out.description}</desc>
      {out.shapes.map(renderShape)}
    </svg>
  );
}
