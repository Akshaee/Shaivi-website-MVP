import { test, expect } from "@playwright/test";
import { PAGES, content } from "../support/pages";

const TEL = /^tel:\+91\d{10}$/;

test("every phone link is a valid Indian tel: URI", async ({ page }) => {
  const expected = new Set(content.contact.phones.map((phone) => phone.tel));

  await page.goto("/contact/");
  const hrefs = await page
    .locator('a[href^="tel:"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute("href") ?? ""));

  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href, `${href} should match ${TEL}`).toMatch(TEL);
    expect(expected.has(href), `${href} is not one of the three published numbers`).toBe(true);
  }
  for (const tel of expected) {
    expect(hrefs, `${tel} should appear on the contact page`).toContain(tel);
  }
});

test("displayed phone numbers use non-breaking spaces so they never wrap", async ({ page }) => {
  // htmlvalidate.config.mjs turns off tel-non-breaking because it also flags
  // plain labels such as "Call us"; this is the check that replaces it.
  for (const { path } of PAGES) {
    await page.goto(path);
    const texts = await page
      .locator('a[href^="tel:"]')
      .evaluateAll((links) => links.map((link) => link.textContent ?? ""));

    for (const text of texts) {
      const trimmed = text.trim();
      if (!/\d/.test(trimmed)) continue; // a label like "Call", not a number
      expect(trimmed, `"${trimmed}" should use non-breaking spaces`).not.toMatch(/\d \d/);
      expect(trimmed).toContain("\u00a0");
    }
  }
});

test("the email link is correct everywhere", async ({ page }) => {
  for (const { path } of PAGES) {
    await page.goto(path);
    const mails = await page
      .locator('a[href^="mailto:"]')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute("href") ?? ""));
    for (const href of mails) {
      expect(href).toBe(`mailto:${content.contact.email}`);
    }
  }
});

test("every page offers a visible route to the contact page", async ({ page }) => {
  for (const { path } of PAGES.filter((p) => p.path !== "/contact/")) {
    await page.goto(path);
    // On desktop that is the header CTA; at 375px it is the mobile action bar.
    // Either way at least one visible link must reach /contact/.
    const routes = page.locator('a[href^="/contact/"]:visible');
    expect(await routes.count(), `${path} has no visible link to /contact/`).toBeGreaterThan(0);
  }
});

test("Request a Quote points at the contact page wherever it appears", async ({ page }) => {
  for (const { path } of PAGES) {
    await page.goto(path);
    const quotes = page.getByRole("link", { name: content.ui.primaryCta });
    for (let i = 0; i < (await quotes.count()); i++) {
      await expect(quotes.nth(i)).toHaveAttribute("href", /\/contact\//);
    }
  }
});

test("the directions link opens safely in a new tab", async ({ page }) => {
  await page.goto("/contact/");
  const directions = page.getByRole("link", { name: /Get directions/ }).first();
  await expect(directions).toHaveAttribute("target", "_blank");
  await expect(directions).toHaveAttribute("rel", /noopener/);
  await expect(directions).toHaveAttribute("rel", /noreferrer/);
  await expect(directions).toHaveAttribute("href", content.contact.mapsUrl);
  await expect(directions).toContainText("opens in a new tab");
});

test("the WhatsApp link only appears when enabled, and is well formed", async ({ page }) => {
  await page.goto("/contact/");
  const whatsapp = page.locator('a[href^="https://wa.me/"]');

  if (!content.contact.whatsapp.enabled) {
    await expect(whatsapp).toHaveCount(0);
    return;
  }

  await expect(whatsapp).toHaveCount(1);
  const href = (await whatsapp.getAttribute("href")) ?? "";
  expect(href).toMatch(/^https:\/\/wa\.me\/\d{10,15}(\?text=.*)?$/);
});

test("?enquiry= and ?product= preselect the form, and bad values are ignored", async ({ page }) => {
  const gownsId = content.gowns.categoryId;

  await page.goto(`/contact/?enquiry=product&product=${gownsId}`);
  await expect(page.locator("#enquiryType")).toHaveValue("product");
  await expect(page.locator("#product")).toHaveValue(gownsId);

  await page.goto("/contact/?enquiry=custom");
  await expect(page.locator("#enquiryType")).toHaveValue("custom");

  // Anything not in the allowlist leaves the defaults alone.
  await page.goto("/contact/?enquiry=%3Cscript%3E&product=../../etc/passwd");
  await expect(page.locator("#enquiryType")).toHaveValue("product");
  await expect(page.locator("#product")).toHaveValue("");
});

test("the mobile action bar works and stays off the contact page", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });

  await page.goto("/");
  const bar = page.locator("#mobile-action-bar");
  await expect(bar).toBeVisible();
  await expect(bar.locator('a[href^="tel:"]')).toHaveAttribute("href", TEL);

  await bar.getByRole("link", { name: "Enquire" }).click();
  await expect(page).toHaveURL(/\/contact\/$/);
  await expect(page.locator("#mobile-action-bar")).toHaveCount(0);
});

test("every link and button has a destination", async ({ page }) => {
  for (const { path } of PAGES) {
    await page.goto(path);

    const emptyLinks = await page
      .locator("a")
      .evaluateAll((links) =>
        links
          .map((link) => (link as HTMLAnchorElement).getAttribute("href"))
          .filter((href) => href === null || href.trim() === ""),
      );
    expect(emptyLinks, `${path} has links without href`).toEqual([]);

    const buttons = await page.locator("button").evaluateAll((elements) =>
      elements.map((element) => ({
        text: (element.textContent ?? "").trim(),
        label: element.getAttribute("aria-label"),
        popover: element.getAttribute("popovertarget"),
        type: element.getAttribute("type"),
      })),
    );
    for (const button of buttons) {
      const named = button.text.length > 0 || Boolean(button.label);
      expect(named, `${path} has an unlabelled button`).toBe(true);
      expect(button.popover ?? button.type, `${path} button "${button.text}" has no role`).toBeTruthy();
    }
  }
});
