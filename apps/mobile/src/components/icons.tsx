import Svg, { Circle, Path } from "react-native-svg";

// Tab bar icons, drawn as simple strokes so they need no icon font.

interface IconProps {
  color: string;
  size?: number;
}

const stroke = (color: string) => ({
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
});

export function FlagIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 21V3l11 4.5L6 12" {...stroke(color)} />
      <Path d="M3 21h8" {...stroke(color)} />
    </Svg>
  );
}

export function SearchIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={10.5} cy={10.5} r={6.5} {...stroke(color)} />
      <Path d="M15.5 15.5 21 21" {...stroke(color)} />
    </Svg>
  );
}

export function HeartIcon({ color, size = 24, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"
        {...stroke(color)}
        fill={filled ? color : "none"}
      />
    </Svg>
  );
}

export function SettingsIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...stroke(color)} />
      <Circle cx={16} cy={7} r={2} {...stroke(color)} />
      <Circle cx={8} cy={17} r={2} {...stroke(color)} />
    </Svg>
  );
}
