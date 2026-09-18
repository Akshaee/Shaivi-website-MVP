import content from "../data/content.json";

export type SeoKey = keyof typeof content.seo;

export interface SeoMeta {
  title: string;
  description: string;
}

/** Titles and descriptions come only from content.json — never hard-coded in a page. */
export function getSeo(key: SeoKey): SeoMeta {
  const meta = content.seo[key];
  if (!meta) throw new Error(`No SEO entry in content.json for "${key}"`);
  return meta;
}

/** Absolute URL for `pathname` against the configured site origin. */
export function absoluteUrl(pathname: string, site: URL | undefined): string {
  const origin = (site?.origin ?? "https://www.dhrithisurgicalsolutions.com").replace(/\/$/, "");
  return `${origin}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

/** Canonical URL: absolute, with a trailing slash everywhere except the 404 page. */
export function canonicalFor(key: SeoKey, site: URL | undefined): string | null {
  if (key === "/404") return null;
  return absoluteUrl(key, site);
}
