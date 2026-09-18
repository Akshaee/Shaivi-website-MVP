// @ts-check
import { defineConfig, envField, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import node from "@astrojs/node";

const onVercel = Boolean(process.env.VERCEL); // Vercel sets VERCEL=1 during its builds

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? "https://www.dhrithisurgicalsolutions.com",
  output: "static",
  adapter: onVercel ? vercel() : node({ mode: "standalone" }),
  trailingSlash: "always",
  build: { format: "directory", inlineStylesheets: "auto" },
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  integrations: [sitemap({ filter: (page) => !/\/(404|api)(\/|$)/.test(page) })],
  vite: { plugins: [tailwindcss()], build: { sourcemap: false } },
  image: { responsiveStyles: true, layout: "constrained" },
  // No markdown content ships, and Shiki would emit inline styles the CSP blocks.
  markdown: { syntaxHighlight: false },
  env: {
    schema: {
      PUBLIC_SITE_URL: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_SITE_INDEXABLE: envField.boolean({ context: "client", access: "public", default: false }),
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: "client", access: "public", optional: true }),
      CONTACT_DELIVERY: envField.enum({
        context: "server",
        access: "secret",
        values: ["log", "resend", "smtp", "webhook"],
        default: "log",
      }),
      CONTACT_TO_EMAIL: envField.string({ context: "server", access: "secret", optional: true }),
      RESEND_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      IP_HASH_SALT: envField.string({ context: "server", access: "secret", optional: true }),
      RATE_LIMIT_PER_10_MIN: envField.number({ context: "server", access: "secret", default: 5 }),
      RATE_LIMIT_PER_DAY: envField.number({ context: "server", access: "secret", default: 20 }),
    },
  },
  // All three families are vendored into src/assets/fonts and served from the
  // site's own origin: no build-time or runtime request to a font CDN.
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Exo 2",
      cssVariable: "--font-exo2",
      fallbacks: ["system-ui", "sans-serif"],
      optimizedFallbacks: true,
      options: {
        variants: [
          {
            weight: "300 700",
            style: "normal",
            src: ["./src/assets/fonts/exo2-latin-variable.woff2"],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Open Sans",
      cssVariable: "--font-opensans",
      fallbacks: ["system-ui", "sans-serif"],
      optimizedFallbacks: true,
      options: {
        variants: [
          { weight: 400, style: "normal", src: ["./src/assets/fonts/open-sans-400-latin.woff2"] },
          { weight: 600, style: "normal", src: ["./src/assets/fonts/open-sans-600-latin.woff2"] },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Dancing Script Elevating",
      cssVariable: "--font-dancing",
      fallbacks: ["cursive"],
      options: {
        variants: [
          { weight: 600, style: "normal", src: ["./src/assets/fonts/dancing-script-600-elevating.woff2"] },
        ],
      },
    },
  ],
  security: {
    checkOrigin: true,
    csp: {
      algorithm: "SHA-256",
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
      ],
    },
  },
});
