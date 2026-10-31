import { parse as parseYaml } from "yaml";
import { frontmatterSchema, idSchema, type Situation } from "./schema.ts";

export interface SourceFile {
  /** Situation id: the filename without `.md`. */
  id: string;
  /** Raw file contents. */
  raw: string;
}

export interface ContentError {
  id: string;
  message: string;
}

export type ParseResult = { ok: true; situation: Situation } | { ok: false; errors: ContentError[] };

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/;

/** Parse and schema-check one situation file. Does not check cross-references. */
export function parseSituation({ id, raw }: SourceFile): ParseResult {
  const errors: ContentError[] = [];
  const err = (message: string) => errors.push({ id, message });

  if (!idSchema.safeParse(id).success) {
    err(`filename "${id}.md" must be lowercase kebab-case`);
  }

  const match = FRONTMATTER.exec(raw.replace(/^\uFEFF/, ""));
  if (!match) {
    err("missing YAML frontmatter (file must start with ---)");
    return { ok: false, errors };
  }

  let data: unknown;
  try {
    // The default YAML 1.2 core schema keeps dates as strings.
    data = parseYaml(match[1] ?? "");
  } catch (e) {
    err(`invalid YAML: ${(e as Error).message}`);
    return { ok: false, errors };
  }

  const result = frontmatterSchema.safeParse(data ?? {});
  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      err(path ? `${path}: ${issue.message}` : issue.message);
    }
  }
  if (errors.length > 0 || !result.success) return { ok: false, errors };

  return { ok: true, situation: { id, ...result.data, body: (match[2] ?? "").trim() } };
}
