import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4321",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Build first (`npm run build`; `npm run verify` already does). Two previews of
  // the same build: 4321 with a relaxed rate limit for the main suite, 4322 with
  // production limits for the 429 test.
  webServer: [
    {
      command: "npx astro preview --port 4321 --ignore-lock",
      url: "http://localhost:4321",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { RATE_LIMIT_PER_10_MIN: "1000", RATE_LIMIT_PER_DAY: "10000" },
    },
    {
      command: "npx astro preview --port 4322 --ignore-lock",
      url: "http://localhost:4322",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { RATE_LIMIT_PER_10_MIN: "5", RATE_LIMIT_PER_DAY: "20" },
    },
  ],
  projects: [
    { name: "mobile-375", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 667 } } },
    { name: "iphone-webkit", use: { ...devices["iPhone 13"] } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
