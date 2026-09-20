import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PAGES } from "../support/pages";

interface VercelConfig {
  trailingSlash: boolean;
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

const config = JSON.parse(fs.readFileSync(path.resolve("vercel.json"), "utf8")) as VercelConfig;

function headersFor(source: string): Map<string, string> {
  const rule = config.headers.find((entry) => entry.source === source);
  if (!rule) throw new Error(`No header rule for "${source}" in vercel.json`);
  return new Map(rule.headers.map((header) => [header.key.toLowerCase(), header.value]));
}

test.describe("vercel.json", () => {
  test("every site-wide security header is declared", () => {
    const headers = headersFor("/(.*)");

    expect(headers.get("strict-transport-security")).toBe("max-age=63072000; includeSubDomains");
    expect(headers.get("content-security-policy")).toBe("frame-ancestors 'none'; upgrade-insecure-requests");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(headers.get("cross-origin-resource-policy")).toBe("same-origin");

    const permissions = headers.get("permissions-policy") ?? "";
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(permissions, `Permissions-Policy should disable ${feature}`).toContain(`${feature}=()`);
    }
  });

  test("insecure requests are upgraded, and only by the header", () => {
    // The directive lives in the header rather than the per-page meta CSP.
    // WebKit applies `upgrade-insecure-requests` to http://localhost as well,
    // which Chromium and Firefox do not; in the meta tag it would make every
    // subresource fail the TLS handshake against the plain-HTTP preview server
    // and the cross-browser suite would test an unstyled page. Production still
    // gets the directive because Vercel sends this header on every response.
    expect(headersFor("/(.*)").get("content-security-policy")).toContain("upgrade-insecure-requests");
  });

  test("HSTS preload is not enabled until the client opts in", () => {
    // Preload is effectively irreversible, so it waits for the client's decision.
    expect(headersFor("/(.*)").get("strict-transport-security")).not.toContain("preload");
  });

  test("hashed build assets are cached immutably", () => {
    expect(headersFor("/_astro/(.*)").get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  test("the API is never cached and never indexed", () => {
    const headers = headersFor("/api/(.*)");
    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.get("x-robots-tag")).toBe("noindex");
  });

  test("trailing slashes are enforced, matching Astro", () => {
    expect(config.trailingSlash).toBe(true);
  });
});

test.describe("built output", () => {
  const dist = path.resolve("dist/client");

  function htmlFor(pagePath: string): string {
    const file = pagePath === "/" ? "index.html" : `${pagePath.replace(/^\/|\/$/g, "")}/index.html`;
    return fs.readFileSync(path.join(dist, file), "utf8");
  }

  test("every page carries a CSP meta tag with no unsafe directives", () => {
    for (const { path: pagePath } of PAGES) {
      const html = htmlFor(pagePath);
      const match = /<meta http-equiv="content-security-policy" content="([^"]+)"/i.exec(html);
      expect(match, `${pagePath} has no CSP meta tag`).not.toBeNull();

      const policy = match![1]!;
      expect(policy, `${pagePath} CSP`).not.toContain("unsafe-inline");
      expect(policy, `${pagePath} CSP`).not.toContain("unsafe-eval");
      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("object-src 'none'");
      expect(policy).toContain("base-uri 'self'");
      expect(policy).toContain("form-action 'self'");
      expect(policy).toMatch(/script-src [^;]*'sha256-/);
    }
  });

  test("no inline style attributes are emitted", () => {
    for (const { path: pagePath } of PAGES) {
      const html = htmlFor(pagePath);
      // `style=""` would be blocked by the CSP and is banned by §3.
      expect(html, `${pagePath} contains an inline style attribute`).not.toMatch(/<[^>]+\sstyle="/);
    }
  });

  test("no source maps are shipped", () => {
    const astroDir = path.join(dist, "_astro");
    const maps = fs.readdirSync(astroDir).filter((file) => file.endsWith(".map"));
    expect(maps).toEqual([]);
  });
});

test.describe("live responses", () => {
  test("the CSP blocks an injected inline style", async ({ page }) => {
    await page.goto("/");

    const blocked = await page.evaluate(() => {
      const style = document.createElement("style");
      style.textContent = "body { background: red !important; }";
      document.head.append(style);
      return getComputedStyle(document.body).backgroundColor;
    });

    // rgb(255, 0, 0) would mean the injected style applied.
    expect(blocked).not.toBe("rgb(255, 0, 0)");
  });

  test("the API responses are not cacheable", async ({ request }) => {
    const response = await request.get("/api/contact/", { headers: { Accept: "application/json" } });
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("no third-party origin is contacted", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname !== "localhost" && url.protocol !== "data:") external.push(request.url());
    });

    for (const { path: pagePath } of PAGES) {
      await page.goto(pagePath, { waitUntil: "networkidle" });
    }
    expect(external, "the site must make no third-party requests").toEqual([]);
  });

  test("the repository holds no committed secrets", () => {
    // Mirrors the §14 pre-commit scan.
    const pattern = /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}/i;
    const roots = ["src", "scripts", "tests", "public", "astro.config.mjs", "vercel.json", "package.json"];
    const offenders: string[] = [];

    const walk = (target: string) => {
      const full = path.resolve(target);
      if (!fs.existsSync(full)) return;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(full)) walk(path.join(target, entry));
        return;
      }
      if (!/\.(ts|tsx|js|mjs|cjs|astro|json|css|txt|md)$/.test(full)) return;
      const contents = fs.readFileSync(full, "utf8");
      if (pattern.test(contents)) offenders.push(target);
    };

    for (const root of roots) walk(root);
    expect(offenders).toEqual([]);
  });
});
