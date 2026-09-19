import { test, expect, type Page } from "@playwright/test";
import { PAGES, seoFor } from "../support/pages";

/** Collects console errors, failed requests and CSP violations for one page. */
function watchForProblems(page: Page) {
  const problems: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    problems.push(`request failed: ${request.url()} (${request.failure()?.errorText})`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`http ${response.status()}: ${response.url()}`);
  });

  return problems;
}

for (const { path, seoKey, h1 } of PAGES) {
  test(`${path} renders correctly and cleanly`, async ({ page }) => {
    const problems = watchForProblems(page);

    // The CSP is enforced from a <meta> tag, so violations only surface in the page.
    await page.addInitScript(() => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        (window as unknown as { __csp: string[] }).__csp.push(
          `${event.violatedDirective} blocked ${event.blockedURI}`,
        );
      });
    });

    const response = await page.goto(path);
    expect(response?.status(), `${path} should return 200`).toBe(200);

    const h1s = page.locator("h1");
    await expect(h1s).toHaveCount(1);
    await expect(h1s.first()).toHaveText(new RegExp(escapeRegExp(h1), "i"));

    await expect(page).toHaveTitle(seoFor(seoKey).title);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toBe(seoFor(seoKey).description);

    const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp ?? []);
    expect(violations, "CSP violations").toEqual([]);
    expect(problems, "console errors and failed requests").toEqual([]);
  });
}

test("an unknown URL returns 404 and is noindex", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist/");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page not found");
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toContain("noindex");
});

test("robots.txt keeps the site out of search while in pitch mode", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Disallow: /");
});

test("every page declares the same organisation structured data", async ({ page }) => {
  for (const { path } of PAGES) {
    await page.goto(path);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = blocks.flatMap((block) => {
      const parsed: unknown = JSON.parse(block);
      return (Array.isArray(parsed) ? parsed : [parsed]).map(
        (entry) => (entry as { "@type": string })["@type"],
      );
    });
    expect(types, `${path} structured data`).toContain("Organization");
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
