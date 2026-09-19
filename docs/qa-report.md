# QA report — SHAIVI website

**Build:** five pages plus a 404, prerendered, with one on-demand route.
**Mode:** pitch mode — `PUBLIC_SITE_INDEXABLE=false`, `CONTACT_DELIVERY=log`.

---

## 1. Acceptance criteria

| ID | Requirement | Status | How it was verified |
|---|---|---|---|
| R1 | Exact brand colours, gradients, type and logos | **Met, with a caveat** | Tokens in `src/styles/global.css` are the §4.1 values unchanged; `npm run test:contrast` covers 39 pairs. The logo and photographs are generated stand-ins — see §6. |
| R2 | Brochure copy verbatim, zero invented facts | **Met** | `npm run test:content` checks every brochure string is on its page and that no number or certification appears that is not in `content.json`. |
| R3 | MD photo, name and title on About and Home | **Met** | `tests/e2e/pages.spec.ts` and `test:content`. The portrait is a placeholder. |
| R4 | Contact form, delivery stubbed, minimal data, consent, privacy link | **Met** | 19 form tests plus 16 API tests. Eight fields, consent required, Privacy Policy linked from the consent label and the summary. |
| R5 | Exactly one `<h1>`, clean H2/H3 hierarchy | **Met** | `npm run test:seo` across all six pages. |
| R6 | Unique titles under 60 chars, descriptions 140–155 | **Met** | `npm run test:seo`. Measured: 43–54 and 149–154 characters. |
| R7 | Descriptive alt text, decorative images `alt=""` | **Met** | `npm run test:seo` plus axe. |
| R8 | LCP ≤ 2.0 s, page loaded under 2 s on 4G | **Met** | Lighthouse LCP 1.51–1.81 s; `tests/perf/load.spec.ts` measures 469–649 ms on an emulated 4G profile. |
| R9 | Responsive 320–1920 px, no horizontal scroll | **Met** | `tests/responsive/overflow.spec.ts` across ten widths plus 667×375 landscape, 200% zoom and text-spacing overrides. |
| R10 | WCAG 2.2 AA | **Met** | axe: 0 violations on every page at 375 and 1440 px, plus the open menu and the form's error and success states. Manual checks in §4. |
| R11 | OWASP Top 10:2025, headers, CSP, dependency audit | **Met** | `docs/security-review.md`; 12 security tests; `npm audit` clean on runtime dependencies. |
| R12 | Every interactive element tested | **Met** | 92 e2e tests covering links, buttons, the menu, and every form submission path including no-JavaScript. |
| R13 | Version history, tag per phase, documented rollback | **Met** | Tags `phase-0` … `phase-9`; rollback steps in the README. |

---

## 2. Checks

All run against the production build.

| Check | Command | Result |
|---|---|---|
| Type check and build | `npm run build` | 0 errors, 0 warnings |
| SEO structure | `npm run test:seo` | 6 pages pass |
| Content fidelity | `npm run test:content` | Pass, with 4 content gaps noted |
| Colour contrast | `npm run test:contrast` | 39 pairs pass |
| HTML validity | `npm run test:html` | 0 problems |
| Internal links | `npm run test:links` | 108 links, all resolve |
| Playwright | `npm run test:e2e` | 175 tests pass |
| Lighthouse CI | `npm run lhci` | 5 pages × 3 runs, all assertions pass |
| Dependency audit | `npm run audit` | 0 vulnerabilities in runtime dependencies |

### Playwright breakdown

| Suite | Tests | What it proves |
|---|---|---|
| `tests/e2e/pages.spec.ts` | 14 | 200 responses, one H1, title and description from `content.json`, no console errors, no failed requests, no CSP violations, 404 is `noindex`, robots.txt blocks crawling |
| `tests/e2e/navigation.spec.ts` | 6 | Logo goes home, `aria-current` marks the active page, skip link moves focus, every internal link and anchor resolves, contact details in the footer on every page, breadcrumbs on inner pages only |
| `tests/e2e/mobile-menu.spec.ts` | 4 | Popover opens, links are keyboard-reachable, Esc and outside clicks close it, focus returns to the button, choosing a link navigates |
| `tests/e2e/cta.spec.ts` | 10 | All three `tel:` links match `^tel:\+91\d{10}$`, non-breaking spaces in displayed numbers, `mailto:` correct, directions link opens safely in a new tab, WhatsApp absent while disabled, `?enquiry=` preselect works and rejects junk, mobile action bar works and is absent on `/contact/` |
| `tests/e2e/contact-form.spec.ts` | 19 | Empty submit, invalid email, short message, bad phone, missing consent, `maxlength`, keyboard-only completion, honeypot hidden, success, 400, 429, 500, network failure, double-click, and the full no-JavaScript path against the real endpoint |
| `tests/api/contact.spec.ts` | 16 | 405, 415, 413, 403, 400 with field errors, honeypot and time trap, valid form and JSON, CR/LF handling, 303 redirect, and the 429 path against the rate-limited preview |
| `tests/unit/enquiry.spec.ts` | 24 | Sanitisers, schema, rate limiter with an injected clock, log redaction, email escaping |
| `tests/a11y/axe.spec.ts` | 14 | 0 violations on 5 pages × 2 widths, the 404 page, the open menu, and the form's error and success states |
| `tests/responsive/overflow.spec.ts` | 15 | No overflow at 10 widths plus landscape, header and footer present, 200% zoom and text-spacing overrides, screenshots |
| `tests/perf/load.spec.ts` | 10 | Load under 2 s on emulated 4G, and the §12 transfer budgets |
| `tests/security/headers.spec.ts` | 12 | Every header in `vercel.json`, CSP with no unsafe directives, no inline styles, no source maps, no third-party requests, no committed secrets |

---

## 3. Measurements

### Lighthouse — mobile emulation, simulated slow 4G, median of 3 runs

| Page | Perf | A11y | Best practices | SEO | LCP | CLS | TBT | Speed Index | Total |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 100 | 100 | 100 | 100 | 1805 ms | 0.000 | 0 ms | 1055 ms | 129 KB |
| `/about/` | 100 | 100 | 100 | 100 | 1699 ms | 0.000 | 0 ms | 977 ms | 105 KB |
| `/products/` | 100 | 100 | 100 | 100 | 1699 ms | 0.000 | 0 ms | 981 ms | 129 KB |
| `/contact/` | 100 | 100 | 100 | 100 | 1505 ms | 0.000 | 0 ms | 943 ms | 85 KB |
| `/privacy-policy/` | 100 | 100 | 100 | 100 | 1509 ms | 0.000 | 0 ms | 956 ms | 84 KB |

Budgets: LCP ≤ 2000 ms, CLS ≤ 0.05, TBT ≤ 100 ms, Speed Index ≤ 2000 ms,
JavaScript ≤ 25 KB, total ≤ 450 KB. All met with room to spare.

### Load time on an emulated 4G connection, 375 px, cold cache

| Page | `load` event |
|---|---|
| `/` | 649 ms |
| `/about/` | 586 ms |
| `/products/` | 580 ms |
| `/contact/` | 515 ms |
| `/privacy-policy/` | 469 ms |

### Transfer sizes

| Resource | Budget | Actual |
|---|---|---|
| HTML | ≤ 30 KB | ~10 KB gzipped |
| CSS | ≤ 35 KB | ~8 KB gzipped, one file |
| JavaScript | ≤ 25 KB | 2.5 KB (prefetch) + 2.5 KB (form, contact page only) |
| Fonts | ≤ 90 KB | 64 KB total: Exo 2 variable 40 KB, Open Sans subsets 21 KB, Dancing Script subset 2.2 KB |
| Total initial load | ≤ 450 KB | 84–129 KB |
| Requests | ≤ 25 | 13–17 |

Third-party requests: **zero**, asserted by a test.

---

## 4. Manual accessibility checks

| Check | Result |
|---|---|
| Keyboard-only walkthrough of all five pages | Pass. Skip link first, visible focus throughout, no traps. The popover menu closes on Esc and returns focus to the button. |
| Focus visibility on dark surfaces | Pass. The focus ring switches to white on the footer, the violet panels and the CTA band. |
| 200% zoom (1280 → 640 px) | Pass, no horizontal scrolling or lost content. |
| Text-spacing overrides (1.4.12) | Pass at 640 px and 320 px. |
| Target sizes | Pass. Primary controls are at least 48 px tall; nothing interactive is under 24 × 24 px. |
| Focus not obscured (2.4.11) | Pass. `scroll-padding-top` clears the sticky header and `scroll-padding-bottom` clears the mobile action bar. |
| Consistent help (3.2.6) | Pass. Phone, email and address sit in the same footer position on every page. |
| Forced colours | Gradient text falls back to `CanvasText` and ribbons to `Highlight`/`HighlightText`. Verified by rule inspection, not in Windows High Contrast — see §7. |
| Screen-reader pass | **Not performed** — see §7. |

Automated axe coverage is 0 violations across 14 scenarios, which covers the
machine-checkable half of WCAG. The manual rows above were checked by keyboard
and by inspecting computed styles.

---

## 5. Decisions and deviations from the brief

| # | Deviation | Why |
|---|---|---|
| 1 | **The kit's assets are generated, not supplied.** The upload contained only the build prompt: no `content.json`, no logos, no photographs, no fonts, no icons. | `content.json` was reconstructed from Appendix A, which the brief states mirrors it exactly. Everything else is generated by `scripts/build-assets.mjs` from the §4 tokens. The seven photographs are labelled placeholders — no stock or AI imagery was used, as §0.3 requires. |
| 2 | **`npm audit` is scoped with `--omit=dev`.** | `@lhci/cli` depends on `extract-zip` and `tmp`, which carry high-severity advisories with no patched release upstream. They are CI-only and never shipped. `npm run audit:dev` reports them. A separate transitive advisory in `path-to-regexp` that *did* reach the runtime is pinned to the patched version through `overrides`. |
| 3 | **Lighthouse runs against `scripts/serve-static.mjs`, not `astro preview`.** | `astro preview` serves everything uncompressed; Vercel serves brotli. Measuring the uncompressed server made the HTML look five times heavier than production and pushed LCP to 2.2 s for a reason that does not exist on the real site. The new server compresses, sets the same cache and security headers, and models Vercel. Playwright still uses `astro preview`, because it needs the API route. |
| 4 | **`content-visibility: auto` was not applied.** | The brief lists it as a technique. Measured, it saved nothing on a site this small and risked layout shift as sections entered the viewport, which CLS ≤ 0.05 does not tolerate. |
| 5 | **The bridge band's height is in `vw`, not `cqi`.** | A container-query height resolves only after the container is laid out, so it painted at its clamp floor and then jumped — 0.113 CLS on the home page. The band is full-bleed, so `vw` and `cqi` agree and the mask still lines up. |
| 6 | **The hero image is sized by width, not height.** | `max-h-[55svh]` with `width: auto` left the box undetermined until the image loaded. Width-driven sizing with the intrinsic aspect ratio is shift-free and lands at about the same size. |
| 7 | **Inline links are underlined.** | Tailwind's preflight removes link underlines, which axe correctly flags: an inline link in a paragraph must be distinguishable without relying on colour. Navigation, buttons and card links opt out with `no-underline`. |
| 8 | **The gowns section carries two anchors.** | The brief gives it `id="gowns"` but also treats it as the "Surgical Disposable Gowns" category that the nav and footer link to. Both anchors exist so both link styles work. |
| 9 | **The mobile menu is labelled "Primary, mobile".** | Two `nav` elements both labelled "Primary" is a duplicate-landmark failure. |
| 10 | **`tel-non-breaking` is switched off in html-validate**, and replaced by a test. | The rule flags any spaced text inside a `tel:` link, including a plain label like "Call us". Displayed numbers are rendered with non-breaking spaces by `nonBreakingPhone()`, and a Playwright test asserts it. |
| 11 | **The API's no-JavaScript redirect is relative.** | An absolute `Location` built from the configured site sent local and preview deployments to the production domain. A relative `Location` resolves against whatever origin served the request and cannot become an open redirect through a forged `Host` header. |
| 12 | **The gradient panels use `royal-50`, not `royal-100`, for body text.** | `royal-100` measured 3.84:1 against the lightest dusk stop — below AA. The CTA band also gained a `brand-deep` scrim at 25%, because the dusk gradient's lightest stops cannot carry AA text over a photograph without one. `scripts/contrast.mjs` models that exact stack. |
| 13 | **Smooth scrolling is scoped to anchor navigation.** | Document-wide `scroll-behavior: smooth` animates every programmatic scroll, which is disorienting on long pages and made automation flaky. |
| 14 | **Exo 2 and Open Sans are served from local files, not the Fontsource provider.** | The provider could not reach the Fontsource API from the build environment. Vendoring the files removes a build-time network dependency, and Open Sans is subset to the characters the taglines actually use. |

---

## 6. Content gaps and client questions

The full list is in `docs/client-checklist.md`. In summary:

**Blocking a real launch**

1. **Seven photographs are placeholders.** Every one renders a "PHOTO PENDING" panel.
2. **The logo is a new drawing**, not the client's artwork, and needs explicit approval.
3. **Four product categories have no copy** — drape kits, dressings, packing materials, hygiene and protective products. They use the "details on request" pattern and are marked `data-content-status="needs-client-copy"`.
4. **Claims need evidence** — ISO 13485 certificate, the BVB viral-barrier claim, "100% breathable", and the facility, team and land figures.
5. **The Privacy Policy is a template** with placeholders for the retention period, hosting region and Grievance Officer, and must be reviewed by a legal adviser.
6. **Enquiry delivery has no destination.** The form works end to end but only logs a redacted summary.

**Decisions**

WhatsApp number, reply-time promise, data-retention period, production domain,
hosting region, and whether to add analytics.

---

## 7. Limits of this report

Two things in the brief could not be done in the build environment, and neither
is a property of the site:

- **Only Chromium was available.** Playwright's Firefox and WebKit downloads are
  blocked by the sandbox's egress policy. The config keeps all four projects and
  CI installs all three engines; locally, 175 tests ran on `desktop-chromium` and
  `mobile-375`. The `iphone-webkit` and `desktop-firefox` projects have not been
  executed.
- **`npm audit signatures` cannot run.** The sigstore TUF endpoint returns 403
  through the egress proxy. It stays in `npm run audit` and runs normally in CI.

Also outstanding:

- **No screen-reader pass.** The brief asks for NVDA + Firefox or VoiceOver +
  Safari on the header, the menu, one content page and the form. Neither is
  available here. This should be done before the pitch; the markup is built for
  it (landmarks, labelled navs, `aria-describedby` on every field, a focused
  error summary, a focused success heading), but built-for is not the same as
  tested-with.
- **Forced-colours mode** was verified by reading the CSS, not in Windows High
  Contrast.
- **No deployment.** Nothing has been pushed to Vercel, so the live header check,
  Lighthouse against a real URL and the Rich Results Test are all still to run.
  `scripts/check-headers.sh` is written and exercised locally.
