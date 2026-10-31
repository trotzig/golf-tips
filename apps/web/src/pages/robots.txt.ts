import type { APIRoute } from "astro";
import { href } from "../lib/content";

export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${new URL(href("sitemap-index.xml"), site)}\n`,
    { headers: { "Content-Type": "text/plain" } },
  );
