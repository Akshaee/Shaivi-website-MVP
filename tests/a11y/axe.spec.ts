import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
