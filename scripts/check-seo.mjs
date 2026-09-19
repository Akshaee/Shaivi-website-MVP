/**
 * Checks the built HTML against R5, R6 and R7:
 * one H1 per page, no skipped heading levels, unique titles under 60 characters,
 * meta descriptions of 140-155 characters taken verbatim from content.json, and
 * descriptive alt text on every content image.
 *
 * Run after `npm run build`.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";

const DIST = path.resolve("dist/client");
const content = JSON.parse(fs.readFileSync(path.resolve("src/data/content.json"), "utf8"));

const PAGES = [
  { file: "index.html", key: "/" },
  { file: "about/index.html", key: "/about/" },
  { file: "products/index.html", key: "/products/" },
  { file: "contact/index.html", key: "/contact/" },
  { file: "privacy-policy/index.html", key: "/privacy-policy/" },
  { file: "404.html", key: "/404" },
];

const BANNED_ALT = /^(image|photo|picture|placeholder|graphic|icon|img)\b/i;
const FILENAME_ALT = /\.(jpe?g|png|webp|avif|svg|gif)\b/i;

const failures = [];
const seenTitles = new Map();
const seenDescriptions = new Map();

function fail(page, message) {
  failures.push(`${page}: ${message}`);
}

for (const { file, key } of PAGES) {
  const full = path.join(DIST, file);
  if (!fs.existsSync(full)) {
    fail(file, "not found in dist/client — run npm run build first");
    continue;
  }

  const root = parse(fs.readFileSync(full, "utf8"));
  const expected = content.seo[key];

  // --- R6: title -----------------------------------------------------------
  const title = root.querySelector("title")?.text.trim() ?? "";
  if (title !== expected.title) fail(key, `title is "${title}", expected "${expected.title}"`);
  if (title.length >= 60) fail(key, `title is ${title.length} characters, must be under 60`);
  if (seenTitles.has(title)) fail(key, `title duplicates ${seenTitles.get(title)}`);
  seenTitles.set(title, key);

  // --- R6: meta description ------------------------------------------------
  const description = root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";
  if (description !== expected.description) fail(key, "meta description does not match content.json");
  if (description.length < 140 || description.length > 155) {
    fail(key, `meta description is ${description.length} characters, must be 140-155`);
  }
  if (seenDescriptions.has(description))
    fail(key, `meta description duplicates ${seenDescriptions.get(description)}`);
  seenDescriptions.set(description, key);

  // --- R5: headings --------------------------------------------------------
  const headings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const h1s = headings.filter((node) => node.tagName === "H1");
  if (h1s.length !== 1) fail(key, `found ${h1s.length} <h1> elements, expected exactly 1`);

  let previous = 0;
  for (const heading of headings) {
    const level = Number(heading.tagName.slice(1));
    if (previous !== 0 && level > previous + 1) {
      fail(key, `heading level jumps from h${previous} to h${level} ("${heading.text.trim().slice(0, 40)}")`);
    }
    if (heading.text.trim() === "") fail(key, `empty ${heading.tagName.toLowerCase()}`);
    previous = level;
  }

  // --- R7: image alt text --------------------------------------------------
  for (const img of root.querySelectorAll("img")) {
    const alt = img.getAttribute("alt");
    if (alt === undefined || alt === null) {
      fail(key, `<img src="${img.getAttribute("src")}"> has no alt attribute`);
      continue;
    }
    if (alt === "") continue; // decorative, and declared as such
    if (BANNED_ALT.test(alt)) fail(key, `alt text starts with a banned word: "${alt}"`);
    if (FILENAME_ALT.test(alt)) fail(key, `alt text looks like a filename: "${alt}"`);
    if (alt.length > 125)
      fail(key, `alt text is ${alt.length} characters, keep it under 125: "${alt.slice(0, 50)}…"`);
  }

  // --- canonical and robots ------------------------------------------------
  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute("href");
  if (key === "/404") {
    if (canonical) fail(key, "the 404 page must not declare a canonical URL");
    const robots = root.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "";
    if (!robots.includes("noindex")) fail(key, "the 404 page must be noindex");
  } else {
    if (!canonical) fail(key, "missing canonical link");
    else if (!canonical.startsWith("http")) fail(key, `canonical is not absolute: ${canonical}`);
    else if (!canonical.endsWith("/")) fail(key, `canonical has no trailing slash: ${canonical}`);
  }

  // --- Open Graph ----------------------------------------------------------
  for (const property of ["og:title", "og:description", "og:image", "og:type", "og:site_name"]) {
    if (!root.querySelector(`meta[property="${property}"]`)) fail(key, `missing ${property}`);
  }
}

if (failures.length > 0) {
  console.error(`check-seo: ${failures.length} problem(s)\n`);
  for (const failure of failures) console.error("  ✗", failure);
  process.exit(1);
}

console.log(
  `check-seo: ${PAGES.length} pages pass (titles, descriptions, headings, alt text, canonical, Open Graph)`,
);
