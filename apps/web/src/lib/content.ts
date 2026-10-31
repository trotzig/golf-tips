import { findContentDir, loadSituations } from "@shotbook/content/node";
import { formatErrors, type CategoryId, type Situation } from "@shotbook/content";
import { exampleScenes } from "@shotbook/shot-viz";

let cached: Situation[] | undefined;

/**
 * All valid situations, sorted by title. Fails the build on content errors.
 * Set SHOTBOOK_CONTENT_DIR to render another folder (e.g. test fixtures).
 */
export function getSituations(): Situation[] {
  if (cached && !import.meta.env.DEV) return cached;
  const dir = process.env.SHOTBOOK_CONTENT_DIR ?? findContentDir();
  const { situations, errors } = loadSituations(dir);
  for (const s of situations) {
    if (s.viz && !(s.viz in exampleScenes)) {
      errors.push({ id: s.id, message: `viz: unknown scene "${s.viz}" (see packages/shot-viz)` });
    }
  }
  if (errors.length > 0) {
    throw new Error(`Content errors in ${dir}:\n${formatErrors(errors)}`);
  }
  cached = situations;
  return situations;
}

export function situationsIn(category: CategoryId): Situation[] {
  return getSituations().filter((s) => s.category === category);
}

/** Every tag in use, most used first, with its situations. */
export function getTags(): Array<{ tag: string; situations: Situation[] }> {
  const byTag = new Map<string, Situation[]>();
  for (const s of getSituations()) {
    for (const tag of s.tags) byTag.set(tag, [...(byTag.get(tag) ?? []), s]);
  }
  return [...byTag]
    .map(([tag, situations]) => ({ tag, situations }))
    .sort((a, b) => b.situations.length - a.situations.length || a.tag.localeCompare(b.tag));
}

/** "ball-position" → "Ball position". */
export function tagLabel(tag: string): string {
  const words = tag.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Hand-picked starting points for the home page, in order. Missing ids are skipped. */
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

export function commonSituations(): Situation[] {
  const byId = new Map(getSituations().map((s) => [s.id, s]));
  return COMMON.flatMap((id) => byId.get(id) ?? []);
}

/** Prefix a site-relative path with the deploy base (`/golf-tips/`). */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}
