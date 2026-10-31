/**
 * Distances and wind speeds are written as tokens in the unit the author thinks in —
 * `{15–60 yd}`, `{3–6 ft}`, `{2 in}`, `{10 mph}` — and shown in the reader's units: yards or
 * meters, mph or m/s. Conversions are rounded to numbers a golfer would actually say.
 */
export const DISTANCE_UNITS = ["yards", "meters"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

export const WIND_UNITS = ["mph", "m/s"] as const;
export type WindUnit = (typeof WIND_UNITS)[number];

export interface Units {
  distance: DistanceUnit;
  wind: WindUnit;
}

/** What a reader sees before choosing: the units the content is written in. */
export const DEFAULT_UNITS: Units = { distance: "yards", wind: "mph" };

/** A measurement token resolved for both settings of its preference. */
export type Measurement =
  | { pref: "distance"; yards: string; meters: string }
  | { pref: "wind"; mph: string; "m/s": string };

/** `{15 yd}`, `{15–60 yd}` (en dash or hyphen), `{3 ft}`, `{2 in}`, `{10 mph}`. */
export const MEASUREMENT_PATTERN = /\{(\d+)(?:[–-](\d+))?\s+(yd|ft|in|mph)\}/g;

export const MEASUREMENT_UNITS = ["yd", "ft", "in", "mph"] as const;
type Unit = (typeof MEASUREMENT_UNITS)[number];

const round = (value: number, step: number) => Math.max(step, Math.round(value / step) * step);

const CONVERT: Record<Unit, { imperial: [string, string]; metric: string; to(v: number): number }> = {
  // Short distances to the meter, longer ones to the nearest 5 like yardage markers.
  yd: { imperial: ["yard", "yards"], metric: "m", to: (v) => round(v * 0.9144, v < 20 ? 1 : 5) },
  ft: { imperial: ["foot", "feet"], metric: "m", to: (v) => round(v * 0.3048, 0.5) },
  in: { imperial: ["inch", "inches"], metric: "cm", to: (v) => round(v * 2.54, 1) },
  mph: { imperial: ["mph", "mph"], metric: "m/s", to: (v) => round(v * 0.44704, 1) },
};

function range(low: number, high: number | undefined): string {
  return high === undefined || high === low ? String(low) : `${low}–${high}`;
}

/** Both variants of one measurement token, or null if it isn't one. */
export function parseMeasurement(token: string): Measurement | null {
  const match = new RegExp(`^${MEASUREMENT_PATTERN.source}$`).exec(token);
  if (!match) return null;
  const low = Number(match[1]);
  const high = match[2] === undefined ? undefined : Number(match[2]);
  const unit = match[3] as Unit;
  const { imperial, metric, to } = CONVERT[unit];
  const written = `${range(low, high)} ${imperial[high === undefined && low === 1 ? 0 : 1]}`;
  const converted = `${range(to(low), high === undefined ? undefined : to(high))} ${metric}`;
  return unit === "mph"
    ? { pref: "wind", mph: written, "m/s": converted }
    : { pref: "distance", yards: written, meters: converted };
}

/** The variant of a measurement for the reader's units. */
export function measurementFor(m: Measurement, units: Units): string {
  return m.pref === "wind" ? m[units.wind] : m[units.distance];
}

/** A number with a unit written out instead of as a token, so readers can't switch it. */
const BARE_MEASUREMENT =
  /\b\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*(?:yards?|yds?|feet|foot|ft|inch(?:es)?|cm|meters?|metres?|m|km\/h|mph|m\/s|knots?)(?![\p{L}/])/giu;

/** Problems with how a piece of text writes distances and wind speeds. */
export function measurementIssues(text: string): string[] {
  const issues: string[] = [];
  for (const match of text.matchAll(/\{([^{}]*\d[^{}]*)\}/g)) {
    if (!parseMeasurement(match[0])) {
      issues.push(
        `unknown measurement ${match[0]} (write {15 yd}, {15–60 yd}, {3 ft}, {2 in} or {10 mph})`,
      );
    }
  }
  const bare = BARE_MEASUREMENT.exec(text.replace(/\{[^{}]*\}/g, ""));
  BARE_MEASUREMENT.lastIndex = 0;
  if (bare) {
    issues.push(
      `"${bare[0]}": write measurements as tokens ({15 yd}, {10 mph}) so readers see their own units`,
    );
  }
  return issues;
}
