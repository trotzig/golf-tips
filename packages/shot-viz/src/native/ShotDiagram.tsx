import { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, G, Polygon, Polyline, Text } from "react-native-svg";
import { shapesElements, type SvgElement } from "../2d/elements.ts";
import { buildShapes2D, type Shapes2DOptions } from "../2d/shapes.ts";
import { describeScene } from "../core/describe.ts";
import type { ShotScene } from "../core/schema.ts";
import type { WindUnit } from "../core/units.ts";

export interface ShotDiagramProps extends Shapes2DOptions {
  scene: ShotScene;
  style?: StyleProp<ViewStyle>;
  /** Overrides the generated accessible description. */
  description?: string;
  /** Unit for wind speeds in labels and the description. Default mph. */
  wind?: WindUnit;
}

function renderElement(el: SvgElement, key: number) {
  switch (el.tag) {
    case "polygon":
      return <Polygon key={key} {...el.props} />;
    case "polyline":
      return <Polyline key={key} {...el.props} />;
    case "circle":
      return <Circle key={key} {...el.props} />;
    case "text":
      return (
        <Text key={key} fontFamily="System" {...el.props}>
          {el.text}
        </Text>
      );
  }
}

/**
 * 2D shot diagram drawn with react-native-svg, from the same shapes as the web diagram. It scales
 * to the width of its container and is exposed to screen readers as one image.
 */
export function ShotDiagram({
  scene,
  style,
  description,
  wind = "mph",
  ...options
}: ShotDiagramProps) {
  const { view, phase, ballTime, width, height, theme, flight } = options;
  const out = useMemo(
    () => buildShapes2D(scene, { view, phase, ballTime, width, height, theme, flight }),
    [scene, view, phase, ballTime, width, height, theme, flight],
  );
  const elements = useMemo(() => shapesElements(out.shapes, wind), [out, wind]);
  const generated = useMemo(
    () => (wind === "mph" ? out.description : describeScene(scene, out.view, wind)),
    [scene, out, wind],
  );
  return (
    <Svg
      viewBox={`0 0 ${out.width} ${out.height}`}
      width="100%"
      style={[{ aspectRatio: out.width / out.height }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${out.title}. ${description ?? generated}`}
    >
      <G>{elements.map(renderElement)}</G>
    </Svg>
  );
}
