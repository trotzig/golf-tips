import type { FlightResult } from "./flight.ts";
import { PHASE } from "./pose.ts";

/** Seconds from address to impact; roughly a 3:1 backswing-to-downswing tempo. */
export const SWING_TO_IMPACT = 1.2;
/** Seconds from impact to the finish. */
export const FOLLOW_THROUGH = 0.6;

export interface TimelineState {
  /** Swing phase for poseGolfer: 0 address … 0.65 impact … 1 finish. */
  phase: number;
  /** Seconds since impact (negative before impact). */
  ballTime: number;
}

/**
 * Map animation time (s) to swing phase and ball time, so renderers share one clock.
 * The backswing (0 → top) takes 75% of the time to impact, the downswing 25%.
 */
export function timelineAt(t: number): TimelineState {
  const back = SWING_TO_IMPACT * 0.75;
  const down = SWING_TO_IMPACT - back;
  let phase: number;
  if (t <= 0) phase = 0;
  else if (t < back) phase = (t / back) * PHASE.top;
  else if (t < SWING_TO_IMPACT)
    phase = PHASE.top + ((t - back) / down) * (PHASE.impact - PHASE.top);
  else
    phase = Math.min(
      1,
      PHASE.impact + ((t - SWING_TO_IMPACT) / FOLLOW_THROUGH) * (1 - PHASE.impact),
    );
  return { phase, ballTime: t - SWING_TO_IMPACT };
}

/** Total animation length for a shot, with a short hold at the end. */
export function timelineDuration(flight: FlightResult): number {
  return SWING_TO_IMPACT + Math.max(FOLLOW_THROUGH, flight.duration) + 0.8;
}
