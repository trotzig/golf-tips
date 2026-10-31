// Browser (DOM) entry: plays a swing and ball flight on a server-rendered ShotDiagram, without
// React. Imports core modules directly so the schema (and zod) stay out of the client bundle.
import { shapesMarkup } from "../2d/markup.ts";
import { buildShapes2D, type Shapes2DOptions } from "../2d/shapes.ts";
import { computeFlight } from "../core/flight.ts";
import type { ShotScene } from "../core/schema.ts";
import { timelineAt, timelineDuration } from "../core/timeline.ts";

export { handedScene } from "../core/handedness.ts";
export type { ShotScene } from "../core/schema.ts";

export interface ShotPlayer {
  /** Animation length in seconds. */
  readonly duration: number;
  /** Time of the last drawn frame in seconds. */
  readonly time: number;
  readonly playing: boolean;
  /** Draw the frame at `t` seconds (0 = address, `duration` = finish with the full flight). */
  seek(t: number): void;
  /**
   * Play from the current time, or from the start once it has finished; `onFrame` gets the time
   * of each drawn frame (`duration` on the last one).
   */
  play(onFrame?: (t: number) => void): void;
  pause(): void;
}

/**
 * A player that redraws `svg` (rendered by `ShotDiagram` with the same scene and options) at any
 * point of the swing. The scene must already be handed (see `handedScene`).
 */
export function createShotPlayer(
  svg: SVGSVGElement,
  scene: ShotScene,
  options: Pick<Shapes2DOptions, "view" | "width" | "height" | "theme"> = {},
): ShotPlayer {
  const layer = svg.querySelector("[data-shapes]") ?? svg;
  const flight = computeFlight(scene);
  const duration = timelineDuration(flight);
  let raf = 0;
  let time = 0;
  let playing = false;

  const seek = (t: number) => {
    const at = Math.max(0, Math.min(duration, t));
    time = at;
    const { phase, ballTime } = timelineAt(at);
    // ballTime stays finite at the end too, so golfer views keep the wide shot of the flight.
    const out = buildShapes2D(scene, { ...options, flight, phase, ballTime });
    layer.innerHTML = shapesMarkup(out.shapes);
  };

  const pause = () => {
    cancelAnimationFrame(raf);
    playing = false;
  };

  const play = (onFrame?: (t: number) => void) => {
    pause();
    const from = time >= duration ? 0 : time;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(duration, from + (now - start) / 1000);
      seek(t);
      if (t < duration) raf = requestAnimationFrame(tick);
      else playing = false;
      onFrame?.(t);
    };
    playing = true;
    raf = requestAnimationFrame(tick);
  };

  return {
    duration,
    get time() {
      return time;
    },
    get playing() {
      return playing;
    },
    seek,
    play,
    pause,
  };
}
