import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { findContentDir } from "@shotbook/content/node";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { serviceWorker } from "./src/pwa/integration.ts";

const contentDir = process.env.SHOTBOOK_CONTENT_DIR ?? findContentDir();

// Deployed to https://trotzig.github.io/golf-tips/ — all internal links go through `href()`.
export default defineConfig({
  site: "https://trotzig.github.io",
  base: "/golf-tips",
  trailingSlash: "ignore",
  integrations: [
    // React renders shot diagrams to static SVG at build time; no React ships to the browser.
    react(),
    sitemap({ filter: (page) => !page.endsWith("/404/") }),
    serviceWorker(),
  ],
  vite: {
    plugins: [
      tailwindcss(),
      {
        // Content lives outside the Vite root, so `astro dev` doesn't see edits to it. On a change,
        // tell Astro to drop its cached getStaticPaths results (the same event its own content
        // collections send), then reload the page.
        name: "shotbook-content-reload",
        configureServer(server) {
          server.watcher.add(contentDir);
          const reload = (file: string) => {
            if (!file.startsWith(contentDir)) return;
            for (const env of Object.values(server.environments)) {
              if (env.name !== "client") env.hot.send("astro:content-changed", {});
            }
            server.environments.client.hot.send({ type: "full-reload", path: "*" });
          };
          server.watcher.on("change", reload);
          server.watcher.on("add", reload);
          server.watcher.on("unlink", reload);
        },
      },
    ],
  },
});
