import { test, expect } from "@playwright/test";
import { PAGES, content } from "../support/pages";

test("the logo links home from every page", async ({ page }) => {
  for (const { path } of PAGES) {
    await page.goto(path);
    const home = page.locator('header a[aria-label*="home" i]').first();
    await expect(home).toHaveAttribute("href", "/");
  }
});

test("aria-current marks the active page", async ({ page }) => {
  for (const { path } of PAGES.filter((p) => p.path !== "/privacy-policy/")) {
    await page.goto(path);
    const current = page.locator('header [aria-current="page"]').first();
    await expect(current).toHaveAttribute("href", path);
  }
});

test("the skip link moves focus to main", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.locator('a[href="#main"]');
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("every internal link resolves", async ({ page, request }) => {
  const seen = new Set<string>();

  for (const { path } of [...PAGES, { path: "/404" }]) {
    await page.goto(path === "/404" ? "/not-a-real-page/" : path);
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute("href") ?? ""));

    for (const href of hrefs) {
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("http")
      ) {
        continue;
      }
      const [target, hash] = href.split("#");
      if (!target || seen.has(href)) continue;
      seen.add(href);

      const response = await request.get(target);
      expect(response.status(), `${href} linked from ${path}`).toBe(200);

      if (hash) {
        const body = await response.text();
        expect(body, `${target} should contain #${hash}`).toContain(`id="${hash}"`);
      }
    }
  }

  expect(seen.size).toBeGreaterThan(8);
});

test("the footer carries the contact details on every page", async ({ page }) => {
  const { contact } = content;
  for (const { path } of PAGES) {
    await page.goto(path);
    const footer = page.locator("footer");
    await expect(footer.locator(`a[href="mailto:${contact.email}"]`)).toBeVisible();
    for (const phone of contact.phones) {
      await expect(footer.locator(`a[href="${phone.tel}"]`)).toBeVisible();
    }
  }
});

test("breadcrumbs appear on inner pages but not on home", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toHaveCount(0);

  for (const { path } of PAGES.filter((p) => p.path !== "/")) {
    await page.goto(path);
    const crumbs = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(crumbs).toHaveCount(1);
    await expect(crumbs.locator('[aria-current="page"]')).toHaveCount(1);
  }
});
