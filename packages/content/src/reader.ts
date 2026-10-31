import { splitHanded, type Handedness } from "./handedness.ts";
import {
  DEFAULT_UNITS,
  MEASUREMENT_PATTERN,
  measurementFor,
  parseMeasurement,
  type Measurement,
  type Units,
} from "./units.ts";

/**
 * Everything a reader sets once and every text follows: their hand, and the units they measure
 * distance and wind in. Content keeps the raw tokens; renderers resolve them here.
 */
export interface Reader extends Units {
  hand: Handedness;
}

export const DEFAULT_READER: Reader = { hand: "right", ...DEFAULT_UNITS };

/** A run of plain text, a direction that differs by hand, or a measurement in either unit. */
export type TextSegment = string | { pref: "hand"; right: string; left: string } | Measurement;

/** Splits text into plain runs and tokens, for renderers that show every variant. */
export function splitText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const pushHanded = (run: string) => {
    for (const s of splitHanded(run)) segments.push(typeof s === "string" ? s : { pref: "hand", ...s });
  };
  let last = 0;
  for (const match of text.matchAll(MEASUREMENT_PATTERN)) {
    const measurement = parseMeasurement(match[0]);
    if (!measurement) continue;
    if (match.index > last) pushHanded(text.slice(last, match.index));
    segments.push(measurement);
    last = match.index + match[0].length;
  }
  if (last < text.length) pushHanded(text.slice(last));
  return segments;
}

/** The variant of a segment for one reader. */
export function segmentFor(segment: TextSegment, reader: Reader): string {
  if (typeof segment === "string") return segment;
  return segment.pref === "hand" ? segment[reader.hand] : measurementFor(segment, reader);
}

/** Resolves every token for one reader; settings left out take their defaults. */
export function forReader(text: string, reader: Partial<Reader>): string {
  const full = { ...DEFAULT_READER, ...reader };
  return splitText(text)
    .map((segment) => segmentFor(segment, full))
    .join("");
}

/** Resolves direction tokens for one handedness, with measurements in the default units. */
export function forHand(text: string, hand: Handedness): string {
  return forReader(text, { hand });
}
