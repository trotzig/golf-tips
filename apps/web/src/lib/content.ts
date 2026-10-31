import { findContentDir, loadSituations } from "@shotbook/content/node";
import { formatErrors, type CategoryId, type Situation } from "@shotbook/content";

let cached: Situation[] | undefined;

/**
 * All valid situations, sorted by title. Fails the build on content errors.
 * Set SHOTBOOK_CONTENT_DIR to render another folder (e.g. test fixtures).
 */
export function getSituations(): Situation[] {
  if (cached && !import.meta.env.DEV) return cached;
  const dir = process.env.SHOTBOOK_CONTENT_DIR ?? findContentDir();
  const { situations, errors } = loadSituations(dir);
  if (errors.length > 0) {
    throw new Error(`Content errors in ${dir}:\n${formatErrors(errors)}`);
  }
  cached = situations;
  return situations;
}

export function situationsIn(category: CategoryId): Situation[] {
  return getSituations().filter((s) => s.category === category);
}

/** Prefix a site-relative path with the deploy base (`/golf-tips/`). */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}
