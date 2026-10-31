/** Units a reader can see wind speeds in: the same values as `WindUnit` in `@shotbook/content`. */
export type WindUnit = "mph" | "m/s";

/** A scene's wind speed (stored in m/s) as text in each unit, rounded to whole numbers. */
export function windSpeedText(speed: number): Record<WindUnit, string> {
  const whole = (v: number) => Math.max(1, Math.round(v));
  return { mph: `${whole(speed * 2.237)} mph`, "m/s": `${whole(speed)} m/s` };
}
