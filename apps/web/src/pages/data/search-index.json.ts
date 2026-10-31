import { toSearchIndexJson } from "@shotbook/content";
import type { APIRoute } from "astro";
import { getSituations } from "../../lib/content";

// Prebuilt MiniSearch index, loaded by the search box (and later the native app) with
// `loadSearchIndex` from @shotbook/content. Shape: SearchIndexJson.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(toSearchIndexJson(getSituations())), {
    headers: { "Content-Type": "application/json" },
  });
