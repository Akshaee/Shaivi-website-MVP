# SHAIVI website

Marketing site for **SHAIVI** — the brand of Dhrithi Surgical Solutions Private
Limited, an ISO 13485 certified manufacturer of surgical disposables in Bhatkal,
Karnataka.

Five pages plus a 404, prerendered as static HTML, with one on-demand route for
the enquiry form. No client framework, no third-party scripts, no cookies.

> **The site is in pitch mode.** It is deliberately not indexable
> (`PUBLIC_SITE_INDEXABLE=false`) and sends no real email
> (`CONTACT_DELIVERY=log`). See [Going live](#going-live).

---

## Requirements

- **Node 22.12 or newer** (Astro 7 requires it)
- npm — the lockfile is committed and CI installs with `npm ci`

## Getting started

```bash
npm install
cp .env.example .env     # adjust if you need to
npm run dev              # http://localhost:4321
```

Astro 7 runs `dev` and `preview` in the background when it detects an AI coding
agent. Manage them with `npx astro dev status|logs|stop`. Test runners need a
foreground server, so Playwright and Lighthouse start their own with
`--ignore-lock`; stop any background preview before running the suite or
`reuseExistingServer` will pick it up.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the build, including the enquiry API |
| `npm run assets` | Regenerate the brand assets, icons, fonts and placeholders |
| `npm run test:seo` | One H1 per page, heading order, title and description lengths, alt text |
| `npm run test:content` | Brochure copy is verbatim; no unsourced claims |
| `npm run test:contrast` | Every colour pair against WCAG 2.2 AA |
| `npm run test:html` | `html-validate` over the built HTML |
| `npm run test:links` | Every internal link and anchor resolves |
| `npm run test:e2e` | The Playwright suite (e2e, API, a11y, responsive, performance, security, unit) |
| `npm run lhci` | Lighthouse CI against the performance budgets |
| `npm run audit` | `npm audit` on runtime dependencies, plus signature verification |
| `npm run lint` | ESLint over the Node scripts |
| `npm run format` / `format:check` | Prettier |
| `npm run verify` | Build, checks, tests, Lighthouse and audit, in order — this is what CI runs |

ESLint covers the plain JavaScript in `scripts/`. `.astro` files are excluded
because linting the TypeScript in their frontmatter needs `typescript-eslint`,
which is outside the agreed dependency list; `astro check` type-checks every
`.astro` file and runs as the first step of `npm run build`.

## Environment variables

Copy `.env.example` to `.env` (git-ignored) and set the same values in Vercel.

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_SITE_URL` | the production domain | Canonical URLs, Open Graph, structured data, sitemap |
| `PUBLIC_SITE_INDEXABLE` | `false` | `false` serves `noindex` and a blocking `robots.txt` |
| `CONTACT_DELIVERY` | `log` | `log`, `resend`, `smtp` or `webhook` |
| `CONTACT_TO_EMAIL` | — | Where enquiries are sent, once delivery is on |
| `RESEND_API_KEY` | — | Only for `CONTACT_DELIVERY=resend` |
| `PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | — | Optional spam challenge; both empty disables it |
| `IP_HASH_SALT` | — | Salts the SHA-256 of client IPs in logs. **Set a long random value in production.** |
| `RATE_LIMIT_PER_10_MIN` | `5` | Enquiries per client per ten minutes |
| `RATE_LIMIT_PER_DAY` | `20` | Enquiries per client per day |

Anything marked `access: "secret"` in `astro.config.mjs` never reaches the
browser bundle.

---

## How it is put together

```
src/
  components/   Brand pieces (BridgeBand, RibbonLabel, OrbCallout, …) and page furniture
  data/         content.json — the single source of truth for all copy
  layouts/      BaseLayout
  lib/          seo.ts, schema.ts, images.ts, text.ts, enquiry/*
  pages/        The five pages, 404, robots.txt.ts, api/contact.ts
  scripts/      Two small progressive-enhancement modules
  styles/       global.css — the whole design system
scripts/        Asset generation and the check scripts
tests/          Playwright: e2e, api, a11y, responsive, perf, security, unit
docs/           Security review, QA report, client checklist, brand board
```

**All copy comes from `src/data/content.json`.** Pages never hard-code a
sentence, a title or an alt text. `npm run test:content` fails if a brochure
string is not on the page it belongs to, and if a number or certification appears
that is not traceable to that file.

**The design system is in `src/styles/global.css`.** Tailwind's default palette
is switched off (`--color-*: initial`), so only the brochure's colours can be
used. `npm run test:contrast` recomputes every pair actually in the UI, including
each stop of each gradient.

### The enquiry form

It works without JavaScript: the form posts to `/api/contact/`, which replies
`303` to `/contact/#enquiry-sent` or `#enquiry-error`, and CSS `:target` reveals
the matching panel. With JavaScript, `src/scripts/contact-form.ts` adds inline
validation, an error summary and a `fetch` submission. Both paths are tested.

The API validates with Zod, strips CR/LF from every single-line field, applies a
honeypot, a three-second time trap and a per-client rate limit, and then hands
off to one `deliverEnquiry()` interface chosen by `CONTACT_DELIVERY`.

### Switching delivery on

1. Decide where enquiries go, and set `CONTACT_TO_EMAIL`.
2. For email through Resend: set `CONTACT_DELIVERY=resend` and `RESEND_API_KEY`,
   and change the `from:` address in `src/lib/enquiry/deliver.ts` to a sender on
   a domain you have verified with Resend.
3. `smtp` and `webhook` are stubs with TODOs. SMTP needs a mail library, which
   the dependency policy does not yet allow — ask before adding one.
4. Submit the form on the preview and confirm the message arrives.

Provider errors are logged, never shown to the visitor.

---

## Generated assets

The original brand kit never arrived, so `scripts/build-assets.mjs` generates
everything from the tokens in `global.css`: the logo lockups, the mark, the
favicon and app icons, the social preview image, the Dhrithi emblem, the bridge
mask, the font subsets and the brand board.

**The seven photographs are placeholders.** They render a panel reading "PHOTO
PENDING". Replacing one is a drop-in — same filename, same folder, then
`npm run build`. See `docs/client-checklist.md` for the full list.

Two failure modes in that pipeline were silent, so the generator guards against
both: opentype.js 2.0 returns NaN coordinates for some glyphs in these fonts, and
librsvg can stop partway through long path data. `npm run assets` rasterises
probe strings and fails if any glyph is missing. CI regenerates the assets and
fails if they differ from the committed files.

## Fonts

Exo 2, Open Sans and a nine-character Dancing Script subset are vendored into
`src/assets/fonts/` and served from the site's own origin through Astro's Fonts
API — no request ever leaves the domain. Open Sans is subset to the characters
the taglines use; Dancing Script carries only the letters of the word
"Elevating". Licences sit beside the files.

---

## Testing

```bash
npm run verify
```

The Playwright config defines four projects: `mobile-375`, `iphone-webkit`,
`desktop-chromium` and `desktop-firefox`. It also starts two previews — port 4321
with relaxed rate limits for the main suite, and port 4322 with production limits
so the 429 path can be tested for real.

If your environment has only Chromium, set `PW_CHROMIUM_PATH` to the binary and
run the Chromium projects:

```bash
PW_CHROMIUM_PATH=/path/to/chromium npx playwright test --project=desktop-chromium --project=mobile-375
```

Lighthouse runs against `scripts/serve-static.mjs` rather than `astro preview`,
because `astro preview` serves everything uncompressed while Vercel serves
brotli. Measuring against the uncompressed server made the HTML look five times
heavier than it is in production and pushed LCP past its budget for a reason that
does not exist on the real site.

## Deployment

Pushing to Vercel builds with the Vercel adapter (`process.env.VERCEL` selects
it) and applies the headers in `vercel.json`. Locally the Node adapter is used
instead, because the Vercel adapter cannot run `astro preview`.

After every deploy:

```bash
bash scripts/check-headers.sh https://<your-deployment>
```

That script checks the security headers, the CSP, the crawl controls, the cache
headers on hashed assets and the enquiry endpoint. It expects a full deployment —
run locally it will flag the API or the cache headers, because no local server
provides both.

## Going live

1. Get the client's sign-off on `docs/client-checklist.md`, especially the
   photographs, the logo and the claims that need evidence.
2. Have the Privacy Policy reviewed by a legal adviser, then remove the
   "Draft – pending legal review" badge from `src/pages/privacy-policy.astro`.
3. Set `PUBLIC_SITE_INDEXABLE=true` and `PUBLIC_SITE_URL` to the live domain.
4. Set `CONTACT_DELIVERY` and its credentials, and set a random `IP_HASH_SALT`.
5. Remove the `is-crawlable` skip from `lighthouserc.json` — it exists only
   because pitch mode is deliberately `noindex`.
6. Move rate limiting to a shared store or a Vercel WAF rule
   (`docs/security-review.md` §4 explains why).
7. Add the domain in Vercel, deploy, and re-run `scripts/check-headers.sh`.
8. Submit `https://<domain>/sitemap-index.xml` to Google Search Console.
9. Configure a Vercel log drain and alert on spikes in `rate_limited`, `spam`
   and `error`.
10. Consider adding `preload` to the HSTS header — only once the client agrees to
    submit the domain to the preload list, because it is hard to undo.

## Version control and rollback

The build phases from the brief are tagged `phase-0` … `phase-8`. It was built
in one pass rather than stopping for approval after each phase, so several phase
tags point at the same commit — the tag marks where that phase's deliverables
landed, not a separate checkpoint. There is no `phase-9`: nothing has been
deployed yet.

| Tag | Commit contains |
|---|---|
| `phase-0` – `phase-2` | Scaffold, config, design system, site shell, 404, robots.txt |
| `phase-3` – `phase-6` | The five pages, the enquiry form and the API |
| `phase-7` – `phase-8` | Test suite, performance pass, checks and documentation |

```bash
git log --oneline --decorate     # see the history and the tags
git revert <sha>                 # undo one commit, safely, keeping history
git reset --hard phase-4         # go back to a tagged state (local branches only)
git reflog                       # recover anything that seems lost
```

Never `reset --hard` a branch that has been pushed and shared. `git revert` is
the safe undo for anything already published.

## Further reading

- `docs/security-review.md` — OWASP Top 10:2025 review, threat model, residual risks
- `docs/qa-report.md` — test matrix, measurements, manual accessibility checks
- `docs/client-checklist.md` — everything we need from the client
- `docs/brand-board.png` — colours, gradients and type, as generated
