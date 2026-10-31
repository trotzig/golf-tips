import { toSituationsJson } from "@shotbook/content";
import type { APIRoute } from "astro";
import { getSituations } from "../../lib/content";

// Public API for the native app: see SituationsJson in @shotbook/content.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(toSituationsJson(getSituations())), {
    headers: { "Content-Type": "application/json" },
  });
