import { createHash } from "node:crypto";

export interface BuiltFile {
  /** Path relative to the build output, with forward slashes ("situations/x/index.html"). */
  path: string;
  content: Buffer;
}

// Built, but not needed to read the site offline.
const SKIP = [
  /^sw\.js$/,
  /^og\//, // share images are for link previews
  /\.xml$/, // sitemaps
  /^robots\.txt$/,
];

/**
 * The URLs the service worker precaches, and a version that changes whenever any of them does.
 * Pages are cached under their directory URL ("/base/situations/x/"), the URL readers visit.
 * Scripts nothing loads (Vite emits a React client for the build-time diagrams) are left out.
 */
export function precacheManifest(
  files: BuiltFile[],
  base: string,
): { urls: string[]; version: string } {
  const root = base.endsWith("/") ? base : `${base}/`;
  const kept = files.filter((f) => !SKIP.some((re) => re.test(f.path)));
  const loaders = kept
    .filter((f) => /\.(html|js|css)$/.test(f.path))
    .map((f) => ({ path: f.path, text: f.content.toString("utf8") }));
  const isLoaded = (f: BuiltFile) => {
    const name = f.path.split("/").pop() ?? f.path;
    return loaders.some((l) => l.path !== f.path && l.text.includes(name));
  };
  const precached = kept
    .filter((f) => !f.path.endsWith(".js") || isLoaded(f))
    .sort((a, b) => (a.path < b.path ? -1 : 1));

  const hash = createHash("sha256");
  for (const f of precached) hash.update(f.path).update("\0").update(f.content).update("\0");
  return {
    urls: precached.map((f) => root + f.path.replace(/(^|\/)index\.html$/, "$1")),
    version: hash.digest("hex").slice(0, 16),
  };
}
