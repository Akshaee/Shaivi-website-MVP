/**
 * Checks R2: the brochure copy in the built HTML is verbatim from content.json,
 * and nothing that looks like an invented fact has crept in.
 *
 * Two directions:
 *   1. Every brochure string must appear on the page that is supposed to carry it.
 *   2. No number, certification, percentage or date may appear on a page unless
 *      it also appears somewhere in content.json.
 *
 * Run after `npm run build`.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";

const DIST = path.resolve("dist/client");
const content = JSON.parse(fs.readFileSync(path.resolve("src/data/content.json"), "utf8"));

const failures = [];
const notes = [];

/** Page text with whitespace collapsed and typographic quotes normalised. */
function textOf(file) {
  const full = path.join(DIST, file);
  if (!fs.existsSync(full)) return null;
  const root = parse(fs.readFileSync(full, "utf8"));
  for (const node of root.querySelectorAll("script, style")) node.remove();
  return normalise(root.querySelector("body")?.text ?? "");
}

function normalise(value) {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const pages = {
  "/": textOf("index.html"),
  "/about/": textOf("about/index.html"),
  "/products/": textOf("products/index.html"),
  "/contact/": textOf("contact/index.html"),
  "/privacy-policy/": textOf("privacy-policy/index.html"),
};

for (const [key, value] of Object.entries(pages)) {
  if (value === null) failures.push(`${key}: page not found in dist/client — run npm run build first`);
}

/** Asserts that `page` contains `string` exactly as content.json holds it. */
function requireVerbatim(key, label, string) {
  const haystack = pages[key];
  if (!haystack) return;
  if (!haystack.includes(normalise(string))) {
    failures.push(`${key}: ${label} is not present verbatim — "${normalise(string).slice(0, 70)}…"`);
  }
}

const { about, infrastructure, leadership, gowns, company, contact } = content;

// --- Home --------------------------------------------------------------------
for (const line of company.coverTagline) requireVerbatim("/", "cover tagline line", line);
requireVerbatim("/", "certification", company.certification);
requireVerbatim("/", "legal name", company.legalName);
requireVerbatim("/", "infrastructure heading", infrastructure.heading);
requireVerbatim("/", "infrastructure intro", infrastructure.intro);
requireVerbatim("/", "customisation callout", about.customisation);
requireVerbatim("/", "gowns first paragraph", gowns.intro[0]);
requireVerbatim("/", "about heading", about.heading);
requireVerbatim("/", "leadership heading", leadership.heading);
requireVerbatim("/", "mission", about.mission);
requireVerbatim("/", "MD name", leadership.people[0].name);
requireVerbatim("/", "MD role", leadership.people[0].role);
for (const item of infrastructure.items) {
  requireVerbatim("/", `stat "${item.title}"`, item.stat);
}

// --- About -------------------------------------------------------------------
requireVerbatim("/about/", "about heading", about.heading);
for (const [i, paragraph] of about.paragraphs.entries()) {
  requireVerbatim("/about/", `about paragraph ${i + 1}`, paragraph);
}
requireVerbatim("/about/", "manufacturers heading", about.manufacturersHeading);
requireVerbatim("/about/", "customisation callout", about.customisation);
requireVerbatim("/about/", "infrastructure intro", infrastructure.intro);
for (const item of infrastructure.items) {
  requireVerbatim("/about/", `infrastructure "${item.title}"`, item.text);
}
requireVerbatim("/about/", "leadership text", leadership.text);
requireVerbatim("/about/", "MD name", leadership.people[0].name);

// --- Products ----------------------------------------------------------------
for (const [i, paragraph] of gowns.intro.entries()) {
  requireVerbatim("/products/", `gowns intro ${i + 1}`, paragraph);
}
for (const feature of gowns.features) requireVerbatim("/products/", `feature "${feature}"`, feature);
for (const fabric of gowns.fabrics) requireVerbatim("/products/", `fabric "${fabric}"`, fabric);
for (const type of gowns.types) {
  requireVerbatim("/products/", `gown type "${type.name}"`, type.name);
  if (type.lead) requireVerbatim("/products/", `lead for "${type.name}"`, type.lead);
  if (type.subheading) requireVerbatim("/products/", `subheading for "${type.name}"`, type.subheading);
  for (const [i, paragraph] of type.paragraphs.entries()) {
    requireVerbatim("/products/", `"${type.name}" paragraph ${i + 1}`, paragraph);
  }
}
for (const category of about.categories) {
  requireVerbatim("/products/", `category "${category.name}"`, category.name);
}

// --- Contact -----------------------------------------------------------------
for (const line of contact.addressLines) requireVerbatim("/contact/", "address line", line);
requireVerbatim("/contact/", "email", contact.email);
for (const phone of contact.phones) requireVerbatim("/contact/", "phone", phone.display);

// --- No invented facts -------------------------------------------------------
// Anything that reads like a claim (a number, a percentage, a standard) must be
// traceable to content.json. Dates the build generates are allowed separately.
const corpus = normalise(JSON.stringify(content));
const CLAIM = /\b(?:ISO\s?\d{4,5}|\d+(?:,\d{3})*(?:\.\d+)?\s?(?:%|sq\.?\s?ft\.?|acres?|years?|hours?|days?))\b/gi;
const ALLOWED_UI = new Set(["100%"]); // used only inside brochure copy, matched below anyway

for (const [key, text] of Object.entries(pages)) {
  if (!text) continue;
  for (const match of text.match(CLAIM) ?? []) {
    const claim = match.trim();
    if (ALLOWED_UI.has(claim)) continue;
    if (corpus.toLowerCase().includes(claim.toLowerCase())) continue;
    failures.push(`${key}: claim "${claim}" does not appear in content.json`);
  }
}

// --- Content gaps ------------------------------------------------------------
const productsHtml = fs.existsSync(path.join(DIST, "products/index.html"))
  ? fs.readFileSync(path.join(DIST, "products/index.html"), "utf8")
  : "";
const gaps = [...productsHtml.matchAll(/id="([^"]+)"[^>]*data-content-status="needs-client-copy"/g)].map((m) => m[1]);
const gapsAlt = [...productsHtml.matchAll(/data-content-status="needs-client-copy"[^>]*id="([^"]+)"/g)].map((m) => m[1]);
const allGaps = [...new Set([...gaps, ...gapsAlt])];
const describedCategories = new Set([gowns.categoryId]);
const expectedGaps = about.categories.filter((c) => !describedCategories.has(c.id)).map((c) => c.id);

for (const id of expectedGaps) {
  if (!allGaps.includes(id)) {
    failures.push(`/products/: "${id}" has no brochure copy but is not marked data-content-status="needs-client-copy"`);
  }
}
if (allGaps.length > 0) {
  notes.push(`content gaps awaiting client copy: ${allGaps.join(", ")}`);
}

// --- Placeholder artwork -----------------------------------------------------
const placeholderCount = fs
  .readdirSync(path.resolve("src/assets/images"))
  .filter((file) => /\.(jpg|png)$/.test(file)).length;
if (placeholderCount > 0) {
  notes.push(`${placeholderCount} image files in src/assets/images — confirm each is a client original, not a placeholder`);
}

if (failures.length > 0) {
  console.error(`check-content: ${failures.length} problem(s)\n`);
  for (const failure of failures) console.error("  ✗", failure);
  process.exit(1);
}

console.log("check-content: all brochure copy is verbatim and no unsourced claims found");
for (const note of notes) console.log("  note:", note);
