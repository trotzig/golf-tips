// Content bundled with the app (see scripts/bundle-content.mts), so everything works offline.
import {
  loadSearchIndex,
  type CategoryId,
  type SearchIndexJson,
  type Situation,
  type SituationsJson,
} from "@shotbook/content";
import { exampleScenes, type ShotScene } from "@shotbook/shot-viz";
import searchIndexJson from "./generated/search-index.json";
import situationsJson from "./generated/situations.json";

const data = situationsJson as unknown as SituationsJson;

export const categories = data.categories;

/** All situations, sorted by title (the order the site uses). */
export const situations: Situation[] = [...data.situations].sort((a, b) =>
  a.title.localeCompare(b.title),
);

const byId = new Map(situations.map((s) => [s.id, s]));

export function getSituation(id: string): Situation | undefined {
  return byId.get(id);
}

export function getCategory(id: string) {
  return categories.find((c) => c.id === id);
}

export function situationsIn(category: CategoryId): Situation[] {
  return situations.filter((s) => s.category === category);
}

/** Hand-picked starting points, as on the site's home page. Missing ids are skipped. */
const COMMON = [
  "ball-above-feet",
  "uphill-lie",
  "downhill-lie",
  "thick-rough",
  "greenside-bunker",
  "chip-or-putt",
  "into-the-wind",
  "first-tee-nerves",
];

export const commonSituations: Situation[] = COMMON.flatMap((id) => byId.get(id) ?? []);

export function sceneFor(situation: Situation): ShotScene | undefined {
  return situation.viz ? exampleScenes[situation.viz] : undefined;
}

let index: ReturnType<typeof loadSearchIndex> | undefined;

/** The prebuilt search index (same as the site's), loaded on first search. */
export function searchIndex() {
  index ??= loadSearchIndex(searchIndexJson as unknown as SearchIndexJson);
  return index;
}
