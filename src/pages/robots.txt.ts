import type { APIRoute } from "astro";
import { PUBLIC_SITE_INDEXABLE } from "astro:env/client";

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const origin = (site?.origin ?? "https://www.dhrithisurgicalsolutions.com").replace(/\/$/, "");

  // Pitch mode keeps the whole site out of search until the client approves it.
  const body = PUBLIC_SITE_INDEXABLE
    ? `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap-index.xml\n`
    : `User-agent: *\nDisallow: /\n`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
