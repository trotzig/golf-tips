import { useId, useMemo, type CSSProperties } from "react";
import { shapesMarkup } from "../2d/markup.ts";
import { buildShapes2D, type Shapes2DOptions } from "../2d/shapes.ts";
import { describeScene } from "../core/describe.ts";
import type { ShotScene } from "../core/schema.ts";

export interface ShotDiagramProps extends Shapes2DOptions {
  scene: ShotScene;
  className?: string;
  style?: CSSProperties;
  /** Overrides the generated accessible description. */
  description?: string;
}

/**
 * 2D shot diagram as inline SVG. Works without WebGL and renders on the server (Astro) with no
 * client JavaScript. Exposed to assistive tech as one image with a generated description.
 * The shapes sit in `<g data-shapes>`, which the player (`@shotbook/shot-viz/player`) redraws.
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
  const markup = useMemo(() => ({ __html: shapesMarkup(out.shapes) }), [out]);
  // A description that names a wind speed comes in both units for the page's `data-wind` CSS.
  // `<desc>` is never rendered, so it would read both: an invisible `<text>` reads the shown one.
  const metric = useMemo(() => describeScene(scene, out.view, "m/s"), [scene, out.view]);
  const descId = `${id}-desc`;
  return (
    <svg
      viewBox={`0 0 ${out.width} ${out.height}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
      className={className}
      style={{ display: "block", width: "100%", height: "auto", ...style }}
    >
      <title id={`${id}-title`}>{out.title}</title>
      {description !== undefined || metric === out.description ? (
        <desc id={descId}>{description ?? out.description}</desc>
      ) : (
        <text id={descId} opacity={0} fontSize={1}>
          <tspan className="wind-mph">{out.description}</tspan>
          <tspan className="wind-ms">{metric}</tspan>
        </text>
      )}
      <g data-shapes="" dangerouslySetInnerHTML={markup} />
    </svg>
  );
}
