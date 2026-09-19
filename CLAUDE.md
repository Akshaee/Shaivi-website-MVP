# SHAIVI website — standing rules

This is a five-page marketing site for SHAIVI, the brand of Dhrithi Surgical
Solutions Private Limited. It represents a real company that has not yet approved
it, so a few rules are absolute.

## Never invent facts

`src/data/content.json` is the single source of truth for every word on the site.
It holds the brochure copy verbatim, the SEO strings, the alt text and the
contact details.

- Pages read from it. They never hard-code a sentence, a title or an alt text.
- Do not add statistics, certifications, client names, testimonials, prices,
  awards, response-time promises or product specifications. If it is not in
  `content.json`, it does not go on the page.
- You may write neutral UI microcopy: navigation labels, button text, form labels
  and errors, eyebrows, breadcrumbs, 404 text and the privacy-policy template.
- Where a section has no brochure copy, use the "details on request" pattern,
  mark the section `data-content-status="needs-client-copy"`, and add it to
  `docs/client-checklist.md`.

`npm run test:content` enforces this in both directions: every brochure string
must appear on the page that owns it, and no number or certification may appear
that is not traceable to `content.json`.

## Pitch mode stays on

Until the client approves the site:

- `PUBLIC_SITE_INDEXABLE=false` — `noindex` on every page, `Disallow: /` in robots.txt.
- `CONTACT_DELIVERY=log` — the enquiry API never sends real email.

## Brand

`src/styles/global.css` holds the whole design system. Tailwind's default palette
is switched off, so only the brochure's colours exist. If a design needs a colour
that is not a token, map it to the nearest token and say so — do not add one.

Red (`--color-brand-red`) is for the logo mark only. Never a button, never
decoration.

Add every new colour pair you use to `scripts/contrast.mjs`. It fails below
4.5:1, or 3:1 for large text and non-text UI.

## Order of precedence

When rules conflict: **security → accessibility → performance → brand fidelity →
polish.** Report every trade-off.

## Gates

`npm run verify` must pass before anything is called done:

build (with `astro check`) → SEO → content → contrast → html-validate →
linkinator → Playwright → Lighthouse → npm audit.

Specifically:

- Exactly one `<h1>` per page, no skipped heading levels.
- Titles under 60 characters, meta descriptions 140–155, all unique.
- axe: zero violations at 375px and 1440px, including the open menu and the
  form's error and success states.
- No horizontal overflow from 320px to 1920px.
- LCP ≤ 2000 ms, CLS ≤ 0.05, TBT ≤ 100 ms in Lighthouse CI.
- No `unsafe-inline` in the CSP, ever. That means no inline `style` attributes
  and no `define:vars` — use classes and custom properties.

## Things that will bite you

- **Never use `<ClientRouter />`.** Astro's CSP does not support it. Page
  transitions use the native `@view-transition` rule instead.
- **The CSP is inactive in `astro dev`.** Verify with `npm run build && npm run preview`.
- **Call the API as `/api/contact/` with the trailing slash.** Without it the
  request is redirected and the browser turns the POST into a GET.
- **`astro preview` serves uncompressed.** Lighthouse runs against
  `scripts/serve-static.mjs`, which compresses the way Vercel does.
- **Do not make layout depend on container-query units above the fold.** `cqi`
  resolves after the first layout pass, so a `cqi`-based height paints at its
  floor and then jumps. The bridge band's height is in `vw` for this reason.
- **Size images by width, not height.** A `max-height` with `width: auto` leaves
  the box undetermined until the image loads, which shifts everything below it.
- **The asset pipeline has two silent failure modes** — opentype.js 2.0 returns
  NaN for some glyphs, and librsvg truncates long path data. `scripts/lib/text-path.mjs`
  works around both and `npm run assets` verifies the output. Do not simplify it
  without reading the comment at the top.

## Dependencies

Runtime dependencies are the six in `package.json` and nothing else. Ask before
adding anything. No UI kits, no icon or animation libraries, no analytics, no
chat widgets, no external CDNs, no map embeds.

## Commits

Conventional Commits (`feat:`, `fix:`, `test:`, `perf:`, `sec:`, `docs:`,
`chore:`), small and focused, each leaving the build green.
