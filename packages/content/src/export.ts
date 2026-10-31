import { CATEGORIES, type Category } from "./categories.ts";
import type { Situation } from "./schema.ts";

/**
 * Shape of `/data/situations.json`. This is a public API consumed by the native app:
 * make additive changes only, and bump SITUATIONS_JSON_VERSION on breaking changes.
 */
export const SITUATIONS_JSON_VERSION = 1;

export interface SituationsJson {
  version: typeof SITUATIONS_JSON_VERSION;
  categories: Category[];
  situations: Situation[];
}

export function toSituationsJson(situations: readonly Situation[]): SituationsJson {
  return {
    version: SITUATIONS_JSON_VERSION,
    categories: [...CATEGORIES],
    situations: [...situations],
  };
}
