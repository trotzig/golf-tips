import { parseScene, type ShotScene, type ShotSceneInput } from "../core/schema.ts";
import ballAboveFeet from "./ball-above-feet.json";
import ballBelowFeet from "./ball-below-feet.json";
import basicChip from "./basic-chip.json";
import bumpAndRun from "./bump-and-run.json";
import crosswind from "./crosswind.json";
import divotLie from "./divot-lie.json";
import downhillLie from "./downhill-lie.json";
import downwind from "./downwind.json";
import fairwayBunker from "./fairway-bunker.json";
import flatLie from "./flat-lie.json";
import flyerLie from "./flyer-lie.json";
import greensideBunker from "./greenside-bunker.json";
import highShot from "./high-shot.json";
import intentionalDraw from "./intentional-draw.json";
import intentionalFade from "./intentional-fade.json";
import intoTheWind from "./into-the-wind.json";
import lobShot from "./lob-shot.json";
import lowShot from "./low-shot.json";
import pitchShot from "./pitch-shot.json";
import pluggedBunkerLie from "./plugged-bunker-lie.json";
import punchOutFromTrees from "./punch-out-from-trees.json";
import thickRough from "./thick-rough.json";
import tightLie from "./tight-lie.json";
import uphillLie from "./uphill-lie.json";

/** Example scenes as authored (JSON), in display order. */
export const exampleSceneInputs: ShotSceneInput[] = [
  flatLie,
  uphillLie,
  downhillLie,
  tightLie,
  divotLie,
  ballAboveFeet,
  ballBelowFeet,
  intoTheWind,
  crosswind,
  downwind,
  highShot,
  lowShot,
  intentionalFade,
  intentionalDraw,
  punchOutFromTrees,
  thickRough,
  flyerLie,
  basicChip,
  bumpAndRun,
  pitchShot,
  lobShot,
  greensideBunker,
  pluggedBunkerLie,
  fairwayBunker,
] as ShotSceneInput[];

/** Example scenes parsed with defaults, keyed by id. */
export const exampleScenes: Record<string, ShotScene> = Object.fromEntries(
  exampleSceneInputs.map((input) => {
    const scene = parseScene(input);
    return [scene.id, scene];
  }),
);
