import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 375, height: 667 } });

test("the popover menu opens, closes and returns focus", async ({ page }) => {
  await page.goto("/");

  const button = page.locator("#menu-button");
  const menu = page.locator("#site-menu");

  await expect(button).toBeVisible();
  await expect(menu).toBeHidden();

  await button.click();
  await expect(menu).toBeVisible();

  const links = menu.locator("a[href]");
  await expect(links.first()).toBeVisible();
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(4);

  // Every link must be reachable from the keyboard.
  for (let i = 0; i < count; i++) {
    await links.nth(i).focus();
    await expect(links.nth(i)).toBeFocused();
  }

  // Esc closes and hands focus back to the button that opened it.
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();
});

test("a click outside light-dismisses the menu", async ({ page }) => {
  await page.goto("/");
  const menu = page.locator("#site-menu");

  await page.locator("#menu-button").click();
  await expect(menu).toBeVisible();

  await page.mouse.click(10, 600);
  await expect(menu).toBeHidden();
});

test("choosing a menu link navigates", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menu-button").click();
  await page.locator('#site-menu a[href="/products/"]').click();
  await expect(page).toHaveURL(/\/products\/$/);
});

test("the close button dismisses the menu", async ({ page }) => {
  await page.goto("/");
  const menu = page.locator("#site-menu");
  await page.locator("#menu-button").click();
  await expect(menu).toBeVisible();
  await menu.locator('button[popovertargetaction="hide"]').click();
  await expect(menu).toBeHidden();
});
