import { handednessIssues } from "./handedness.ts";
import { parseSituation, type ContentError, type SourceFile } from "./parse.ts";
import type { Situation } from "./schema.ts";

export interface ValidationResult {
  /** Valid situations, sorted by title. */
  situations: Situation[];
  errors: ContentError[];
}

/** Parse every file, then check cross-references (`related` ids). */
export function validateSituations(files: readonly SourceFile[]): ValidationResult {
  const errors: ContentError[] = [];
  const situations: Situation[] = [];
  const allIds = new Set(files.map((f) => f.id));

  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.id)) {
      errors.push({ id: file.id, message: "duplicate id" });
      continue;
    }
    seen.add(file.id);
    const result = parseSituation(file);
    if (result.ok) situations.push(result.situation);
    else errors.push(...result.errors);
  }

  for (const s of situations) {
    for (const ref of s.related) {
      if (ref === s.id) errors.push({ id: s.id, message: "related: must not reference itself" });
      else if (!allIds.has(ref)) {
        errors.push({ id: s.id, message: `related: unknown situation "${ref}"` });
      }
    }
  }

  for (const s of situations) {
    for (const [field, text] of textFields(s)) {
      for (const issue of handednessIssues(text)) errors.push({ id: s.id, message: `${field}: ${issue}` });
    }
  }

  situations.sort((a, b) => a.title.localeCompare(b.title, "en"));
  return { situations, errors };
}

/** Every piece of reader-facing text in a situation, labelled by field. */
export function textFields(s: Situation): Array<[string, string]> {
  const fields: Array<[string, string]> = [
    ["title", s.title],
    ["summary", s.summary],
    ["body", s.body],
  ];
  for (const key of ["club_choice", "drill", "advanced"] as const) {
    const value = s[key];
    if (value) fields.push([key, value]);
  }
  for (const key of ["aliases", "setup", "swing", "expect", "mistakes"] as const) {
    s[key]?.forEach((value, i) => fields.push([`${key}[${i}]`, value]));
  }
  return fields;
}

export function formatErrors(errors: readonly ContentError[]): string {
  return errors.map((e) => `  ${e.id}.md: ${e.message}`).join("\n");
}
