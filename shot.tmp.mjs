import { chromium } from "playwright-core";
const pages = process.argv[2].split(",");
const width = Number(process.argv[3] || 375);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
for (const p of pages) {
  await page.goto(`http://localhost:4321${p}`, { waitUntil: "networkidle" });
  await page.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 800)); window.scrollTo(0, 0); });
  await page.waitForTimeout(800);
  await page.waitForTimeout(400);
  const name = p.replace(/\//g, "_") || "_home";
  await page.screenshot({ path: `/tmp/claude-0/shots/${name}-${width}.png`, fullPage: true });
  console.log("shot", p, width);
}
await browser.close();
