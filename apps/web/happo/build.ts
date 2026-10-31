// Builds the Happo package: a JS bundle that registers every built page and every shot diagram
// as a Happo example, plus a manifest of per-example fingerprints that run.ts uses to skip the
// examples a change can't have affected. Run `pnpm build` first; Happo calls this from
// happo.config.ts, and `node apps/web/happo/build.ts` runs it on its own.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";
import {
  ANIMATED_DIAGRAMS,
  animatedVariant,
  DIAGRAM_COMPONENT,
  HANDS,
  femaleVariant,
  handedVariant,
  type Manifest,
  type ManifestEntry,
  type PageExample,
} from "./examples.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");
const siteDir = join(here, "../dist");
const shotVizDir = join(repoRoot, "packages/shot-viz");
export const outDir = join(here, "dist");
export const packageDir = join(outDir, "package");
export const manifestPath = join(outDir, "manifest.json");

const VIRTUAL_ID = "virtual:happo-examples";

const sha = (...parts: string[]) => {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\0");
  return hash.digest("hex").slice(0, 16);
};

function filesIn(dir: string, keep: (file: string) => boolean = () => true): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(keep)
    .sort();
}

/** One hash over a set of files, by path and content. */
function hashFiles(files: string[]): string {
  return sha(...files.flatMap((file) => [relative(repoRoot, file), readFileSync(file, "utf8")]));
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const [, name, value] of source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
    if (name) attrs[name] = value ?? "";
  }
  return attrs;
}

/** Component and variant for a built page, from its path under dist/. */
function pageName(file: string): { component: string; variant: string } {
  const path = relative(siteDir, file).split(sep).join("/");
  const parts = path.replace(/(^|\/)index\.html$/, "").split("/");
  if (path === "index.html") return { component: "Home page", variant: "default" };
  if (path === "404.html") return { component: "Not found page", variant: "default" };
  if (path === "search/index.html") return { component: "Search page", variant: "default" };
  if (path === "favourites/index.html") return { component: "Favourites page", variant: "default" };
  if (path === "tags/index.html") return { component: "Tags page", variant: "default" };
  if (path === "settings/index.html") return { component: "Settings page", variant: "default" };
  if (parts.length === 2 && parts[1]) {
    const component = {
      situations: "Situation page",
      category: "Category page",
      tags: "Tag page",
    }[parts[0] ?? ""];
    if (component) return { component, variant: parts[1] };
  }
  // A new kind of page is still covered; give it a name above when it settles.
  return { component: "Page", variant: path };
}

/** Every built page as static HTML, and the CSS they load. */
function readSite(): { pages: PageExample[]; css: string } {
  if (!existsSync(join(siteDir, "index.html"))) {
    throw new Error(`No built site in ${siteDir}. Run \`pnpm build\` first.`);
  }
  const stylesheets = new Set<string>();
  const pages: PageExample[] = [];
  for (const file of filesIn(siteDir, (f) => f.endsWith(".html"))) {
    const source = readFileSync(file, "utf8");
    for (const [, href] of source.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
      if (href) stylesheets.add(href);
    }
    const htmlTag = /<html([^>]*)>/.exec(source);
    const body = /<body([^>]*)>([\s\S]*)<\/body>/.exec(source);
    if (!htmlTag || !body) throw new Error(`Can't read ${file}`);
    // Scripts don't run in Happo, and their hashed file names would change every fingerprint.
    const html = (body[2] ?? "").replace(/<script\b[\s\S]*?<\/script>/g, "");
    pages.push({
      ...pageName(file),
      // Only pages with handed text look different for a left-hander.
      hands: html.includes("hand-l") ? HANDS : ["right"],
      htmlAttrs: parseAttrs(htmlTag[1] ?? ""),
      bodyAttrs: parseAttrs(body[1] ?? ""),
      html,
    });
  }
  const base = "/golf-tips/";
  const css = [...stylesheets]
    .sort()
    .map((href) => readFileSync(join(siteDir, href.replace(base, "")), "utf8"))
    .join("\n")
    // The bundle is served from elsewhere, so files the CSS loads (the web font) go in inline.
    .replace(/url\(\/golf-tips\/([^)]+\.woff2)\)/g, (_, path: string) => {
      const data = readFileSync(join(siteDir, path)).toString("base64");
      return `url(data:font/woff2;base64,${data})`;
    });
  return { pages, css };
}

/** Scene ids, read from the JSON files (Node can't import them as the shot-viz index does). */
function sceneIds(): string[] {
  const dir = join(shotVizDir, "src/scenes");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => (JSON.parse(readFileSync(join(dir, f), "utf8")) as { id: string }).id)
    .sort();
}

function buildManifest(pages: PageExample[], css: string): Manifest {
  // Anything that changes how every example renders: the bundle code and the Happo config.
  const harness = hashFiles([
    join(here, "entry.tsx"),
    join(here, "examples.ts"),
    join(repoRoot, "happo.config.ts"),
  ]);
  const cssHash = sha(css);
  const examples: ManifestEntry[] = pages.flatMap((p) =>
    p.hands.map((hand) => ({
      component: p.component,
      variant: handedVariant(p.variant, hand),
      fingerprint: sha(harness, cssHash, JSON.stringify([p.htmlAttrs, p.bodyAttrs]), p.html, hand),
    })),
  );
  // Diagrams render in the browser, so fingerprint their sources: the renderer, its React, and
  // the scene itself.
  const renderer = hashFiles([
    join(shotVizDir, "package.json"),
    ...filesIn(join(shotVizDir, "src"), (f) => !f.includes(`${sep}scenes${sep}`)),
    join(here, "../node_modules/react/package.json"),
    join(here, "../node_modules/react-dom/package.json"),
  ]);
  for (const id of sceneIds()) {
    const scene = readFileSync(join(shotVizDir, `src/scenes/${id}.json`), "utf8");
    for (const hand of HANDS) {
      examples.push({
        component: DIAGRAM_COMPONENT,
        variant: handedVariant(id, hand),
        fingerprint: sha(harness, cssHash, renderer, scene, hand),
      });
    }
    examples.push({
      component: DIAGRAM_COMPONENT,
      variant: femaleVariant(id),
      fingerprint: sha(harness, cssHash, renderer, scene, "female"),
    });
  }
  // Played diagrams: the same sources, with the player and timeline among the renderer's.
  for (const id of ANIMATED_DIAGRAMS) {
    const scene = readFileSync(join(shotVizDir, `src/scenes/${id}.json`), "utf8");
    examples.push({
      component: DIAGRAM_COMPONENT,
      variant: animatedVariant(id),
      fingerprint: sha(harness, cssHash, renderer, scene, "played"),
    });
  }
  return { version: 1, examples };
}

export async function buildHappoBundle(): Promise<{
  rootDir: string;
  entryPoint: string;
  estimatedSnapsCount: number;
}> {
  const { pages, css } = readSite();
  const manifest = buildManifest(pages, css);

  await build({
    configFile: false,
    root: here,
    logLevel: "warn",
    plugins: [
      react(),
      {
        name: "happo-examples",
        resolveId: (id) => (id === VIRTUAL_ID ? `\0${VIRTUAL_ID}` : undefined),
        load: (id) =>
          id === `\0${VIRTUAL_ID}`
            ? `export const pages = ${JSON.stringify(pages)};\nexport const css = ${JSON.stringify(css)};`
            : undefined,
      },
    ],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      outDir: packageDir,
      emptyOutDir: true,
      lib: {
        entry: join(here, "entry.tsx"),
        formats: ["iife"],
        name: "shotbookHappo",
        fileName: () => "bundle.js",
      },
    },
  });

  mkdirSync(outDir, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    rootDir: packageDir,
    entryPoint: "bundle.js",
    estimatedSnapsCount: manifest.examples.length,
  };
}

if (import.meta.main) {
  const { estimatedSnapsCount } = await buildHappoBundle();
  console.log(`Happo bundle: ${estimatedSnapsCount} examples in ${relative(repoRoot, outDir)}`);
}
