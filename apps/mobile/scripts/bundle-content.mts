// Writes the content the app bundles for offline use: the same situations.json and search index
// the site publishes under /data/. Run before starting or type-checking the app.
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatErrors, toSearchIndexJson, toSituationsJson } from "@shotbook/content";
import { findContentDir, loadSituations } from "@shotbook/content/node";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "src", "generated");
const contentDir = process.env.SHOTBOOK_CONTENT_DIR ?? findContentDir(here);

// Scene ids are the JSON file names; the scenes themselves are bundled from @shotbook/shot-viz.
const scenesDir = join(
  dirname(createRequire(import.meta.url).resolve("@shotbook/shot-viz/package.json")),
  "src",
  "scenes",
);
const sceneIds = new Set(
  readdirSync(scenesDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -5)),
);

const { situations, errors } = loadSituations(contentDir);
for (const s of situations) {
  if (s.viz && !sceneIds.has(s.viz)) {
    errors.push({ id: s.id, message: `viz: unknown scene "${s.viz}" (see packages/shot-viz)` });
  }
}
if (errors.length > 0) {
  console.error(`Content errors in ${contentDir}:\n${formatErrors(errors)}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "situations.json"), JSON.stringify(toSituationsJson(situations)));
writeFileSync(join(outDir, "search-index.json"), JSON.stringify(toSearchIndexJson(situations)));
console.log(`Bundled ${situations.length} situations into ${outDir}`);
