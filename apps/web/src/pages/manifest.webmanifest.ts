import type { APIRoute } from "astro";
import { href } from "../lib/content";

// Lets phones install the site; the service worker (src/pwa) keeps it working offline.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: "Shotbook",
      short_name: "Shotbook",
      description: "How to play every golf shot and situation, on one card.",
      id: href("/"),
      start_url: href("/"),
      scope: href("/"),
      display: "standalone",
      // --color-canvas (light), matching the theme-color meta tag.
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons: [
        { src: href("icons/icon-192.png"), sizes: "192x192", type: "image/png" },
        { src: href("icons/icon-512.png"), sizes: "512x512", type: "image/png" },
        {
          src: href("icons/icon-maskable-512.png"),
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
        { src: href("favicon.svg"), sizes: "any", type: "image/svg+xml" },
      ],
    }),
    { headers: { "Content-Type": "application/manifest+json" } },
  );
