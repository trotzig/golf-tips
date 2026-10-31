import { describe, expect, it } from "vitest";
import { precacheManifest, type BuiltFile } from "./precache.ts";

const file = (path: string, content = path): BuiltFile => ({ path, content: Buffer.from(content) });

const site = [
  file("index.html", '<link href="/b/_astro/Base.css"><script src="/b/_astro/search.js">'),
  file("situations/downhill-lie/index.html"),
  file("404.html"),
  file("_astro/Base.css", "url(/b/_astro/jost.woff2)"),
  file("_astro/jost.woff2"),
  file("_astro/search.js", 'import "./chunk.js"'),
  file("_astro/chunk.js"),
  file("_astro/client.js"),
  file("data/search-index.json"),
  file("og/default.png"),
  file("og/situations/downhill-lie.png"),
  file("sitemap-index.xml"),
  file("robots.txt"),
  file("sw.js"),
];

describe("precacheManifest", () => {
  it("lists pages under their directory URL, plus assets and data", () => {
    expect(precacheManifest(site, "/b").urls).toEqual([
      "/b/404.html",
      "/b/_astro/Base.css",
      "/b/_astro/chunk.js",
      "/b/_astro/jost.woff2",
      "/b/_astro/search.js",
      "/b/data/search-index.json",
      "/b/",
      "/b/situations/downhill-lie/",
    ]);
  });

  it("changes the version when any precached file changes", () => {
    const { version } = precacheManifest(site, "/b/");
    const edited = site.map((f) =>
      f.path === "data/search-index.json" ? file(f.path, "new index") : f,
    );
    expect(precacheManifest(edited, "/b/").version).not.toBe(version);
  });

  it("keeps the version when only skipped files change", () => {
    const { version } = precacheManifest(site, "/b/");
    const edited = site.map((f) => (f.path === "og/default.png" ? file(f.path, "new image") : f));
    expect(precacheManifest(edited, "/b/").version).toBe(version);
  });
});
