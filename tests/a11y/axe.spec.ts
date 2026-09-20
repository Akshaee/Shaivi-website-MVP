import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import nodePath from "node:path";
import { PAGES } from "../support/pages";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(TAGS).analyze();
}

function describeViolations(results: Awaited<ReturnType<typeof scan>>): string {
  return results.violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(" ")).join(", ");
      return `${violation.id} (${violation.impact}): ${violation.help}\n    at ${targets}`;
    })
    .join("\n  ");
}

for (const width of [375, 1440]) {
  for (const { path } of PAGES) {
    test(`${path} has no accessibility violations at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 375 ? 667 : 900 });
      await page.goto(path, { waitUntil: "networkidle" });

      const results = await scan(page);
      expect(results.violations.length, describeViolations(results)).toBe(0);
    });
  }
}

test("the 404 page has no accessibility violations", async ({ page }) => {
  await page.goto("/not-a-real-page/");
  const results = await scan(page);
  expect(results.violations.length, describeViolations(results)).toBe(0);
});

test("the open mobile menu has no accessibility violations", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await page.locator("#menu-button").click();
  await expect(page.locator("#site-menu")).toBeVisible();

  const results = await scan(page);
  expect(results.violations.length, describeViolations(results)).toBe(0);
});

test("the form in its error state has no accessibility violations", async ({ page }) => {
  await page.goto("/contact/", { waitUntil: "networkidle" });
  await page.click("#enquiry-submit");
  await expect(page.locator("#error-summary")).toBeVisible();

  const results = await scan(page);
  expect(results.violations.length, describeViolations(results)).toBe(0);
});

test("the form in its success state has no accessibility violations", async ({ page }) => {
  await page.goto("/contact/", { waitUntil: "networkidle" });
  await page.route("**/api/contact/", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }),
  );

  await page.fill("#name", "Anita Rao");
  await page.fill("#email", "anita.rao@hospital.in");
  await page.fill("#message", "We need 500 reinforced surgical gowns in size L, and a quote for drape kits.");
  await page.check("#consent");
  await page.click("#enquiry-submit");
  await expect(page.locator("#enquiry-success")).toBeVisible();

  const results = await scan(page);
  expect(results.violations.length, describeViolations(results)).toBe(0);
});

// A static check, so this fails in every engine rather than only where axe runs.
// A control whose visible content is just an icon has to carry its own name:
// WebKit does not compute an accessible name from an SVG <title>, so an
// icon-only button labelled through the icon is nameless in VoiceOver.
test("every icon-only control carries its own accessible name", () => {
  const dist = nodePath.resolve("dist/client");
  const offenders: string[] = [];

  for (const { path: pagePath } of PAGES) {
    const file = pagePath === "/" ? "index.html" : `${pagePath.replace(/^\/|\/$/g, "")}/index.html`;
    const html = fs.readFileSync(nodePath.join(dist, file), "utf8");

    for (const match of html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      const [, tag, attributes, inner] = match;
      // Strip the SVG whole. Its <title> is not visible text and does not name
      // the control in WebKit, so counting it as text is exactly the mistake
      // this test exists to catch.
      const withoutIcons = inner!.replace(/<svg\b[\s\S]*?<\/svg>/g, "");
      const text = withoutIcons.replace(/<[^>]*>/g, "").trim();
      const hasIcon = /<svg\b/.test(inner!);
      if (text.length > 0 || !hasIcon) continue;

      const named = /\baria-label="[^"]+"/.test(attributes!) || /\baria-labelledby="[^"]+"/.test(attributes!);
      if (!named) offenders.push(`${pagePath}: <${tag} ${attributes!.trim().slice(0, 80)}>`);
    }
  }

  expect(offenders, `icon-only controls with no accessible name:\n  ${offenders.join("\n  ")}`).toEqual([]);
});
