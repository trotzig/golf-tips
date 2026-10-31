import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeFlight, type FlightResult } from "../core/flight.ts";
import type { ShotScene } from "../core/schema.ts";
import { timelineAt, timelineDuration } from "../core/timeline.ts";

export interface ShotPlayerState {
  /** Animation length in seconds. */
  duration: number;
  /** Current time in seconds (0 = address). */
  t: number;
  playing: boolean;
  /** Props for `ShotDiagram` at the current time. */
  frame: { phase: number; ballTime: number; flight: FlightResult };
  play(): void;
  stop(): void;
  seek(t: number): void;
}

/**
 * Plays a swing and ball flight for the native `ShotDiagram`, on the same clock as the web
 * player (`timelineAt`). Starts at address with the whole flight drawn, like a still diagram.
 */
export function useShotPlayer(scene: ShotScene): ShotPlayerState {
  const flight = useMemo(() => computeFlight(scene), [scene]);
  const duration = useMemo(() => timelineDuration(flight), [flight]);
  const [t, setT] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setPlaying(false);
  }, []);

  const seek = useCallback(
    (to: number) => {
      stop();
      setT(Math.max(0, Math.min(duration, to)));
    },
    [duration, stop],
  );

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setPlaying(true);
    const start = performance.now();
    const tick = (now: number) => {
      const at = Math.min(duration, (now - start) / 1000);
      setT(at);
      if (at < duration) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
  }, [duration]);

  // A new scene (another hand, another situation) starts over at the still diagram.
  useEffect(() => {
    setT(null);
    return () => cancelAnimationFrame(raf.current);
  }, [scene]);

  const frame = useMemo(() => {
    if (t === null) return { phase: 0, ballTime: Infinity, flight };
    const { phase, ballTime } = timelineAt(t);
    return { phase, ballTime, flight };
  }, [t, flight]);

  return { duration, t: t ?? 0, playing, frame, play, stop, seek };
}
