import type { APIRoute } from "astro";
import { shareImagePng } from "../../lib/images";

// Share image for every page that doesn't have its own.
export const GET: APIRoute = async () =>
  new Response(
    await shareImagePng({
      title: "How do I play this shot?",
      summary: "Slopes, wind, bunkers, nerves: what to do in every golf situation, on one card.",
    }),
    { headers: { "Content-Type": "image/png" } },
  );
