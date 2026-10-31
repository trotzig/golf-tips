// Node-only entry: filesystem loading.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { SourceFile } from "./parse.ts";
import { validateSituations, type ValidationResult } from "./validate.ts";

/** Find `content/situations` by walking up from `from` to the workspace root. */
export function findContentDir(from: string = process.cwd()): string {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return join(dir, "content", "situations");
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Could not find workspace root above ${from}`);
    dir = parent;
  }
}

/** Read every `*.md` file in `dir`. A missing directory yields no files. */
export function readSourceFiles(dir: string): SourceFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => ({ id: name.slice(0, -3), raw: readFileSync(join(dir, name), "utf8") }));
}

export function loadSituations(dir: string = findContentDir()): ValidationResult {
  return validateSituations(readSourceFiles(dir));
}
