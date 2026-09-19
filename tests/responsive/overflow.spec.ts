import { test, expect } from "@playwright/test";
import { PAGES, WIDTHS } from "../support/pages";

test.describe.configure({ mode: "parallel" });

for (const width of WIDTHS) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    for (const { path } of PAGES) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path, { waitUntil: "networkidle" });

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        widest: (() => {
          let worst = { selector: "", width: 0 };
          for (const element of document.querySelectorAll<HTMLElement>("body *")) {
            const rect = element.getBoundingClientRect();
            if (rect.right > window.innerWidth + 1 && rect.width > worst.width) {
              worst = {
                selector: `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).split(" ")[0]}` : ""}`,
                width: Math.round(rect.right),
              };
            }
          }
          return worst;
        })(),
      }));

      expect(
        overflow.scrollWidth,
        `${path} at ${width}px overflows; widest offender: ${overflow.widest.selector} reaching ${overflow.widest.width}px`,
      ).toBeLessThanOrEqual(overflow.innerWidth);
    }
  });
}

test("the header and footer are present at every width", async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  }
});

test("landscape phones have no overflow either", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  for (const { path } of PAGES) {
    await page.goto(path, { waitUntil: "networkidle" });
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth, `${path} at 667x375`).toBeLessThanOrEqual(innerWidth);
  }
});

// A user stylesheet is applied by the browser itself and is not subject to the
// page's CSP, so the context bypasses CSP to model it faithfully. (That the CSP
// does block page-injected inline styles is asserted in tests/security.)
test.describe("reflow and text spacing", () => {
  test.use({ bypassCSP: true });

  const USER_STYLESHEET = `
    * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
    p { margin-bottom: 2em !important; }
  `;

  test("the layout survives 200% zoom and text-spacing overrides", async ({ page }) => {
    // 1.4.10 Reflow: 1280px at 200% behaves like a 640px viewport.
    await page.setViewportSize({ width: 640, height: 900 });

    for (const { path } of PAGES) {
      await page.goto(path, { waitUntil: "networkidle" });
      // 1.4.12 Text Spacing: the user stylesheet every AA audit applies.
      await page.addStyleTag({ content: USER_STYLESHEET });

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth, `${path} with text-spacing overrides`).toBeLessThanOrEqual(innerWidth);
    }
  });

  test("content is still reachable at 320px with text spacing applied", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });

    for (const { path } of PAGES) {
      await page.goto(path, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: USER_STYLESHEET });

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth, `${path} at 320px with text spacing`).toBeLessThanOrEqual(innerWidth);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("footer")).toBeAttached();
    }
  });
});

test("full-page screenshots for the phase report", async ({ page }, testInfo) => {
  for (const width of [375, 1440]) {
    for (const { path } of PAGES) {
      await page.setViewportSize({ width, height: width === 375 ? 667 : 900 });
      await page.goto(path, { waitUntil: "networkidle" });
      // Prime lazy images so the screenshot shows the finished page.
      await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((resolve) => setTimeout(resolve, 600));
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(400);

      const name = path === "/" ? "home" : path.replace(/\//g, "");
      await page.screenshot({
        path: testInfo.outputPath(`../screens/${name}-${width}.png`),
        fullPage: true,
      });
    }
  }
});
