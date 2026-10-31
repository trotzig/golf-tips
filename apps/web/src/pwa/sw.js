// Shotbook service worker: keeps the whole site readable offline on the course.
// This is a template: the build (src/pwa/integration.ts) fills in BASE, VERSION and PRECACHE and
// writes it to dist/sw.js. VERSION hashes every precached file, so each deploy that changes
// anything installs a fresh cache and drops the old one.
const BASE = "__BASE__";
const VERSION = "__VERSION__";
const PRECACHE = /* __PRECACHE__ */ [];
const CACHE = `shotbook-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Skip the HTTP cache, or a page from the previous deploy could land in the new cache.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("shotbook-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin + BASE)) return;
  event.respondWith(respond(request));
});

async function respond(request) {
  const cache = await caches.open(CACHE);
  const page = request.mode === "navigate";
  // Pages ignore the query string: the search page reads ?q= itself. Vary is ignored because
  // scripts and fonts are CORS requests and servers may vary on Origin, which the precache lacked.
  const cached = await cache.match(request, { ignoreSearch: page, ignoreVary: true });
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch (error) {
    // Offline and not part of the site we cached: show the not-found page.
    const notFound = page && (await cache.match(`${BASE}404.html`));
    if (notFound) return notFound;
    throw error;
  }
}
