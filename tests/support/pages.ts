import fs from "node:fs";
import path from "node:path";

// Read rather than import: Playwright runs these files as ESM, where a JSON
// import needs an import attribute that the TypeScript config here does not emit.
const raw = fs.readFileSync(path.resolve("src/data/content.json"), "utf8");
const content = JSON.parse(raw) as Content;

export interface Content {
  company: {
    brand: string;
    legalName: string;
    tagline: string;
    certification: string;
    heroScriptWord: string;
    heroHeadline: string;
    coverTagline: string[];
  };
  about: {
    heading: string;
    customisation: string;
    manufacturersHeading: string;
    categories: { id: string; name: string }[];
  };
  gowns: { categoryId: string; heading: string; features: string[] };
  leadership: { heading: string; people: { name: string; role: string }[] };
  contact: {
    email: string;
    officeLabel: string;
    mapsUrl: string;
    phones: { display: string; tel: string }[];
    whatsapp: { enabled: boolean; number: string; prefill: string };
  };
  seo: Record<string, { title: string; description: string }>;
  ui: { primaryCta: string; detailsOnRequest: string };
}

export interface PageUnderTest {
  path: string;
  seoKey: string;
  h1: string;
}

/** Title and description for a page, from content.json. */
export function seoFor(key: string): { title: string; description: string } {
  const meta = content.seo[key];
  if (!meta) throw new Error(`No SEO entry for "${key}"`);
  return meta;
}

/** The five indexable pages, with the H1 each one must render. */
export const PAGES: PageUnderTest[] = [
  { path: "/", seoKey: "/", h1: `${content.company.heroScriptWord} ${content.company.heroHeadline}` },
  { path: "/about/", seoKey: "/about/", h1: content.about.heading },
  { path: "/products/", seoKey: "/products/", h1: "Surgical Disposables & Protective Products" },
  { path: "/contact/", seoKey: "/contact/", h1: "Contact Dhrithi Surgical Solutions" },
  { path: "/privacy-policy/", seoKey: "/privacy-policy/", h1: "Privacy Policy" },
];

/** Widths from §13, checked for overflow on every page. */
export const WIDTHS = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920];

export const RATE_LIMITED_ORIGIN = "http://localhost:4322";

export { content };
