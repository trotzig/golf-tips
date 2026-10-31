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
  /** Played to the end. */
  ended: boolean;
  /** Props for `ShotDiagram` at the current time. */
  frame: { phase: number; ballTime: number; flight: FlightResult };
  /** Play from the current time, or from the start once it has finished. */
  play(): void;
  pause(): void;
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
  // The time playback resumes from, kept outside state so `play` needn't change on every frame.
  const now = useRef(0);

  const pause = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setPlaying(false);
  }, []);

  const seek = useCallback(
    (to: number) => {
      pause();
      now.current = Math.max(0, Math.min(duration, to));
      setT(now.current);
    },
    [duration, pause],
  );

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setPlaying(true);
    const from = now.current >= duration ? 0 : now.current;
    const start = performance.now();
    const tick = (time: number) => {
      const at = Math.min(duration, from + (time - start) / 1000);
      now.current = at;
      setT(at);
      if (at < duration) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
  }, [duration]);

  // A new scene (another hand, another situation) starts over at the still diagram.
  useEffect(() => {
    setT(null);
    now.current = 0;
    setPlaying(false);
    return () => cancelAnimationFrame(raf.current);
  }, [scene]);

  const frame = useMemo(() => {
    if (t === null) return { phase: 0, ballTime: Infinity, flight };
    const { phase, ballTime } = timelineAt(t);
    return { phase, ballTime, flight };
  }, [t, flight]);

  const ended = t !== null && t >= duration;
  return { duration, t: t ?? 0, playing, ended, frame, play, pause, seek };
}
