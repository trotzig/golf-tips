// Usage: node src/cli.ts validate [dir]
//        node src/cli.ts export <out.json> [dir]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { toSituationsJson } from "./export.ts";
import { findContentDir, loadSituations } from "./node.ts";
import { formatErrors } from "./validate.ts";

const [command, ...args] = process.argv.slice(2);

function load(dir: string | undefined) {
  const contentDir = dir ?? findContentDir();
  const result = loadSituations(contentDir);
  const where = relative(process.cwd(), contentDir) || ".";
  if (result.errors.length > 0) {
    console.error(`✗ ${result.errors.length} content error(s) in ${where}:\n${formatErrors(result.errors)}`);
    process.exit(1);
  }
  console.log(`✓ ${result.situations.length} situation(s) valid in ${where}`);
  return result;
}

if (command === "validate") {
  load(args[0]);
} else if (command === "export" && args[0]) {
  const { situations } = load(args[1]);
  mkdirSync(dirname(args[0]), { recursive: true });
  writeFileSync(args[0], JSON.stringify(toSituationsJson(situations), null, 2) + "\n");
  console.log(`✓ wrote ${args[0]}`);
} else {
  console.error("Usage: cli.ts validate [dir] | cli.ts export <out.json> [dir]");
  process.exit(2);
}
