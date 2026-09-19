import { test, expect } from "@playwright/test";
import { PAGES } from "../support/pages";

/**
 * R8: the page must be fully loaded in under two seconds on a 4G profile.
 *
 * Network conditions are emulated through CDP, so this runs on the Chromium
 * projects only. Each page is measured from a cold cache.
 */
const FOUR_G = {
  offline: false,
  downloadThroughput: (9 * 1024 * 1024) / 8, // ~9 Mbps
  uploadThroughput: (1.5 * 1024 * 1024) / 8, // ~1.5 Mbps
  latency: 60,
};

const BUDGET_MS = 2000;

test.describe("load time on an emulated 4G connection", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "CDP network emulation is Chromium-only");
  test.use({ viewport: { width: 375, height: 667 } });

  for (const { path } of PAGES) {
    test(`${path} finishes loading in under ${BUDGET_MS}ms`, async ({ page, context }) => {
      const client = await context.newCDPSession(page);
      await client.send("Network.enable");
      await client.send("Network.emulateNetworkConditions", FOUR_G);
      await client.send("Network.clearBrowserCache");

      const started = Date.now();
      await page.goto(path, { waitUntil: "load" });
      const elapsed = Date.now() - started;

      const timing = await page.evaluate(() => {
        const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
        return entry ? Math.round(entry.loadEventEnd) : null;
      });

      const measured = timing ?? elapsed;
      expect(measured, `${path} loaded in ${measured}ms`).toBeLessThan(BUDGET_MS);

      await client.detach();
    });
  }
});

test.describe("transfer budgets", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "resource sizes are read through CDP");

  for (const { path } of PAGES) {
    test(`${path} stays inside the §12 budgets`, async ({ page }) => {
      const totals = { html: 0, css: 0, js: 0, font: 0, image: 0, other: 0, requests: 0 };

      page.on("response", async (response) => {
        if (response.request().method() !== "GET") return;
        totals.requests++;

        const type = response.headers()["content-type"] ?? "";
        let size = 0;
        try {
          size = Number((await response.headerValue("content-length")) ?? 0);
          if (!size) size = (await response.body()).byteLength;
        } catch {
          return;
        }

        if (type.includes("html")) totals.html += size;
        else if (type.includes("css")) totals.css += size;
        else if (type.includes("javascript")) totals.js += size;
        else if (type.includes("font")) totals.font += size;
        else if (type.includes("image")) totals.image += size;
        else totals.other += size;
      });

      await page.goto(path, { waitUntil: "networkidle" });

      const total = totals.html + totals.css + totals.js + totals.font + totals.image + totals.other;
      const report = JSON.stringify({ ...totals, total }, null, 2);

      expect(totals.js, `JavaScript budget\n${report}`).toBeLessThanOrEqual(25_000);
      expect(totals.css, `CSS budget\n${report}`).toBeLessThanOrEqual(35_000);
      expect(totals.font, `font budget\n${report}`).toBeLessThanOrEqual(90_000);
      expect(total, `total budget\n${report}`).toBeLessThanOrEqual(450_000);
      expect(totals.requests, `request budget\n${report}`).toBeLessThanOrEqual(25);
    });
  }
});
