import { parseScene, type ShotScene, type ShotSceneInput } from "../core/schema.ts";
import ballAboveFeet from "./ball-above-feet.json";
import ballBelowFeet from "./ball-below-feet.json";
import downhillLie from "./downhill-lie.json";
import flatLie from "./flat-lie.json";
import highShot from "./high-shot.json";
import intentionalDraw from "./intentional-draw.json";
import intentionalFade from "./intentional-fade.json";
import intoTheWind from "./into-the-wind.json";
import lowShot from "./low-shot.json";
import uphillLie from "./uphill-lie.json";

/** Example scenes as authored (JSON), in display order. */
export const exampleSceneInputs: ShotSceneInput[] = [
  flatLie,
  uphillLie,
  downhillLie,
  ballAboveFeet,
  ballBelowFeet,
  intoTheWind,
  highShot,
  lowShot,
  intentionalFade,
  intentionalDraw,
] as ShotSceneInput[];

/** Example scenes parsed with defaults, keyed by id. */
export const exampleScenes: Record<string, ShotScene> = Object.fromEntries(
  exampleSceneInputs.map((input) => {
    const scene = parseScene(input);
    return [scene.id, scene];
  }),
);
