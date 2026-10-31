// Runs Happo on the examples a change affected. Every other example is passed to `--skip`, so
// Happo borrows its snapshot from the baseline report instead of rendering it again.
//
//   node apps/web/happo/run.ts [baseline-manifest.json]
//
// The baseline manifest is the one built for the commit `happo baseline` prints (CI caches one
// per commit). Without it, every example runs. With nothing affected, it posts a passing status.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { buildHappoBundle, manifestPath } from "./build.ts";
import type { Manifest } from "./examples.ts";

const readManifest = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Manifest;

/** Examples whose fingerprint matches the baseline's. Anything new or changed runs. */
export function unchanged(current: Manifest, baseline: Manifest): Manifest["examples"] {
  if (baseline.version !== current.version) return [];
  const before = new Map(baseline.examples.map((e) => [`${e.component}\0${e.variant}`, e]));
  return current.examples.filter(
    (e) => before.get(`${e.component}\0${e.variant}`)?.fingerprint === e.fingerprint,
  );
}

function happo(args: string[]): never {
  console.log(`$ happo ${args.join(" ")}`);
  const { status } = spawnSync("pnpm", ["exec", "happo", ...args], { stdio: "inherit" });
  process.exit(status ?? 1);
}

if (import.meta.main) {
  await buildHappoBundle();
  const current = readManifest(manifestPath);
  const baselinePath = process.argv[2];
  if (!baselinePath || !existsSync(baselinePath)) {
    console.log("No baseline manifest: running every example.");
    happo([]);
  }
  const skip = unchanged(current, readManifest(baselinePath)).map(({ component, variant }) => ({
    component,
    variant,
  }));
  const affected = current.examples.length - skip.length;
  console.log(`${affected} of ${current.examples.length} examples affected.`);
  if (affected === 0) happo(["skip"]);
  happo(skip.length > 0 ? ["--skip", JSON.stringify(skip)] : []);
}
