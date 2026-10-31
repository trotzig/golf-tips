import type { APIRoute } from "astro";
import { ICONS, iconPng, type IconName } from "../../lib/images";

// App icons for the web manifest and iOS home screens, drawn from the header mark.
export function getStaticPaths() {
  return Object.keys(ICONS).map((name) => ({ params: { name } }));
}

export const GET: APIRoute = async ({ params }) =>
  new Response(await iconPng(params.name as IconName), {
    headers: { "Content-Type": "image/png" },
  });
