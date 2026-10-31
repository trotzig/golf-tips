import { getCategory, type Situation } from "@shotbook/content";
import type { APIRoute } from "astro";
import { getSituations } from "../../../lib/content";
import { defaultHand } from "../../../lib/handed";
import { shareImagePng } from "../../../lib/images";

// One share image per situation, shown when a situation link is posted.
export function getStaticPaths() {
  return getSituations().map((situation) => ({
    params: { id: situation.id },
    props: { situation },
  }));
}

export const GET: APIRoute<{ situation: Situation }> = async ({ props: { situation: s } }) =>
  new Response(
    await shareImagePng({
      title: defaultHand(s.title),
      summary: defaultHand(s.summary),
      eyebrow: getCategory(s.category).title,
    }),
    { headers: { "Content-Type": "image/png" } },
  );
