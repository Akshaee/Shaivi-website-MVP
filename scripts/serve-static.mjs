/**
 * A static server for the prerendered build, used by Lighthouse CI.
 *
 * `astro preview` serves every response uncompressed, while Vercel serves brotli
 * or gzip. Measuring against the uncompressed server makes the HTML look five
 * times heavier than it is in production and pushes LCP well past its budget for
 * reasons that do not exist on the real site. This server models what Vercel
 * actually does: content negotiation, the same cache headers, the same security
 * headers, and Astro's `trailingSlash: "always"` behaviour.
 *
 * It serves only the prerendered pages. Anything under /api/ is on-demand and is
 * exercised by `astro preview` in the Playwright suite instead.
 *
 *   node scripts/serve-static.mjs [port]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist/client");
const port = Number(process.argv[2] ?? 4321);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// Matching vercel.json, so the local lab sees the production header set.
const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest|javascript))/;

/** Resolves a URL path to a file, applying Astro's directory build layout. */
function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0]);

  // Reject anything that tries to climb out of the build directory.
  const target = path.normalize(path.join(root, decoded));
  if (!target.startsWith(root)) return null;

  const candidates = target.endsWith("/")
    ? [path.join(target, "index.html")]
    : [target, path.join(target, "index.html")];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);
  const file = resolveFile(url.pathname);

  const send = (status, body, type, extraHeaders = {}) => {
    const accept = request.headers["accept-encoding"] ?? "";
    const headers = { ...SECURITY_HEADERS, "Content-Type": type, ...extraHeaders };

    let payload = body;
    if (COMPRESSIBLE.test(type) && body.length > 512) {
      if (/\bbr\b/.test(accept)) {
        payload = zlib.brotliCompressSync(body);
        headers["Content-Encoding"] = "br";
      } else if (/\bgzip\b/.test(accept)) {
        payload = zlib.gzipSync(body);
        headers["Content-Encoding"] = "gzip";
      }
    }

    headers["Content-Length"] = String(payload.length);
    headers["Vary"] = "Accept-Encoding";
    response.writeHead(status, headers);
    response.end(request.method === "HEAD" ? undefined : payload);
  };

  if (!file) {
    const notFound = path.join(root, "404.html");
    if (fs.existsSync(notFound)) {
      send(404, fs.readFileSync(notFound), TYPES[".html"]);
    } else {
      send(404, Buffer.from("Not found"), TYPES[".txt"]);
    }
    return;
  }

  const extension = path.extname(file);
  const type = TYPES[extension] ?? "application/octet-stream";
  const cacheControl = url.pathname.startsWith("/_astro/")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=0, must-revalidate";

  send(200, fs.readFileSync(file), type, { "Cache-Control": cacheControl });
});

server.listen(port, () => {
  console.log(`Serving dist/client on http://localhost:${port}`);
});
