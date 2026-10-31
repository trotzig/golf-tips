import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { precacheManifest, type BuiltFile } from "./precache.ts";

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Writes dist/sw.js after the build, precaching every page and asset the site needs offline. */
export function serviceWorker(): AstroIntegration {
  let base = "/";
  return {
    name: "shotbook-service-worker",
    hooks: {
      "astro:config:done": ({ config }) => {
        base = config.base.endsWith("/") ? config.base : `${config.base}/`;
      },
      "astro:build:done": ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const files: BuiltFile[] = filesIn(out).map((file) => ({
          path: relative(out, file).split(sep).join("/"),
          content: readFileSync(file),
        }));
        const { urls, version } = precacheManifest(files, base);
        const template = readFileSync(new URL("./sw.js", import.meta.url), "utf8");
        writeFileSync(
          join(out, "sw.js"),
          template
            .replace('"__BASE__"', JSON.stringify(base))
            .replace('"__VERSION__"', JSON.stringify(version))
            .replace("/* __PRECACHE__ */ []", JSON.stringify(urls, null, 2)),
        );
        logger.info(`sw.js: ${urls.length} files precached, version ${version}`);
      },
    },
  };
}
