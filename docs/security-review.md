# Security review — SHAIVI website

**Scope:** the static marketing site and its one on-demand route, `POST /api/contact/`.
**Reviewed against:** OWASP Top 10:2025.
**Mode at time of review:** pitch mode — `PUBLIC_SITE_INDEXABLE=false`, `CONTACT_DELIVERY=log`.

---

## 1. Threat model

### Assets

| Asset | Why it matters |
|---|---|
| Enquiry contents (name, email, phone, organisation, message) | Personal data under the DPDP Act, 2023. Commercially sensitive to the client. |
| The client's reputation | The site speaks for a medical-device manufacturer. Defacement or a spoofed enquiry form would be damaging. |
| The destination mailbox | Once delivery is switched on, it becomes a target for spam and for header injection. |
| Availability of the site | It is the client's sales front door. |

### Entry points

| Entry point | Exposure |
|---|---|
| `GET` on the five prerendered pages, `/404`, `/robots.txt`, `/sitemap-index.xml` | Fully public, static files. No server logic. |
| `POST /api/contact/` | The only route that accepts input. |
| Build pipeline (npm, GitHub Actions, Vercel) | Supply-chain surface. |

### Abuse cases and mitigations

| Abuse case | Mitigation |
|---|---|
| Automated spam floods the enquiry mailbox | Honeypot field, three-second time trap, per-client rate limit, optional Turnstile. Detected spam receives a normal success response so the bot learns nothing. |
| Email header injection via the name or email field | CR and LF are stripped from every single-line field before validation; the subject is a fixed constant; the only header carrying user input is `Reply-To`, and it holds an address that has already passed validation. Covered by `tests/unit/enquiry.spec.ts`. |
| Stored or reflected XSS through the message field | Nothing the visitor submits is rendered back into the page. HTML email escapes all five significant characters. The CSP has no `unsafe-inline`, so an injected `<script>` would not execute even if one were introduced. |
| Cross-site request forgery against the enquiry endpoint | Astro's `checkOrigin` rejects form posts from another origin; JSON posts are additionally checked against `Origin` and `Sec-Fetch-Site`. No CORS headers are sent, so no other origin can read a response. |
| Clickjacking the enquiry form | `frame-ancestors 'none'` and `X-Frame-Options: DENY`. |
| SSRF through the contact route | The route never fetches a user-supplied URL. The one outbound call, Turnstile's siteverify, is a fixed constant. |
| Resource exhaustion by large request bodies | Bodies over 10 KB are rejected on the declared `Content-Length` and again on the bytes actually read. |
| Personal data leaking into logs | Logs carry only a request id, an outcome, a duration and a salted SHA-256 of the client address. A test asserts that no field value reaches the log line. |
| A compromised dependency reaching production | Minimal dependency list, committed lockfile, `npm ci` in CI, `npm audit` gate, Actions pinned to commit SHAs, no third-party runtime scripts and no CDN. |
| Open redirect from the no-JavaScript flow | The `303` carries a relative `Location`, so a forged `Host` header cannot redirect a visitor off-site. |

---

## 2. OWASP Top 10:2025

| # | Risk | Status | Controls and evidence |
|---|---|---|---|
| A01 | Broken Access Control (incl. SSRF) | **Pass** | Only `POST` is accepted at `/api/contact/`; every other method returns `405` with `Allow: POST` (`tests/api/contact.spec.ts`). Same-origin only: `security.checkOrigin: true` in `astro.config.mjs` covers form content types, and `sameOrigin()` in `src/pages/api/contact.ts` covers JSON. No CORS headers are emitted. No admin route, no authenticated area, no user-supplied URL is ever fetched. |
| A02 | Security Misconfiguration | **Pass** | `vercel.json` sets HSTS, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP and CORP; asserted in `tests/security/headers.spec.ts`. Astro emits a hash-based CSP with no `unsafe-inline` or `unsafe-eval`; a live test confirms an injected inline style is blocked. Source maps are disabled (`vite.build.sourcemap: false`) and their absence is asserted. Custom 404. Error responses are generic. `.env` is git-ignored. |
| A03 | Software Supply Chain Failures | **Pass, with one note** | 6 runtime dependencies, all first-party Astro packages plus Tailwind. `package-lock.json` is committed and CI uses `npm ci`. `npm run audit` runs `npm audit --omit=dev --audit-level=high` and reports 0 vulnerabilities. A transitive `path-to-regexp` advisory (GHSA-9wv6-86v2-598j) reached the build through `@astrojs/vercel`; it is pinned to the patched `^6.3.0` through `overrides`. No external CDN, no analytics, no chat widget. **Note:** `@lhci/cli` pulls in `extract-zip` and `tmp` advisories with no patched release upstream. They are dev-only, never shipped, and run only in CI, so the audit gate is scoped with `--omit=dev`; `npm run audit:dev` reports them for tracking. |
| A04 | Cryptographic Failures | **Pass** | HTTPS only, with HSTS at two years and `includeSubDomains`. `preload` is deliberately not set until the client agrees to submit the domain. Secrets are declared `access: "secret"` in `astro:env` so they never reach the client bundle. No personal data is written to logs; client addresses are stored only as a salted SHA-256 truncated to 16 hex characters. |
| A05 | Injection | **Pass** | Zod validation with allowlists and length limits on every field (`src/lib/enquiry/schema.ts`). Control characters are stripped; CR and LF are removed from all single-line fields. Select values are checked against a fixed list built from `content.json`. No user data is passed to `set:html`. Email bodies are plain text or fully escaped HTML. |
| A06 | Insecure Design | **Pass** | The form collects only the eight fields needed to answer an enquiry — no address, job title, company size or file upload. Spam controls are layered (honeypot, time trap, rate limit, optional Turnstile) and fail safe. Bodies are size-capped. Threat model above. |
| A07 | Authentication Failures | **N/A** | The MVP has no authentication, no sessions and no cookies. If an admin area or CMS is added later it must use a managed identity provider with MFA, and this row must be re-reviewed. |
| A08 | Software or Data Integrity Failures | **Pass** | Builds come only from the committed lockfile. CI must pass before merge; `main` should be protected once the repository is pushed (see README). No `eval`, no `new Function`, no dynamic import of remote code. `JsonLd.astro` escapes `<` so structured data cannot break out of its script block. |
| A09 | Security Logging and Alerting Failures | **Pass, with an operational to-do** | Every request produces one structured JSON line with the outcome (`sent`, `spam`, `invalid`, `rate_limited`, `error`), a request id and a duration (`src/lib/enquiry/log.ts`). **To do at launch:** configure a Vercel log drain and alert on spikes in `rate_limited`, `spam` and `error`. |
| A10 | Mishandling of Exceptional Conditions | **Pass** | The whole handler is wrapped in `try/catch` and fails closed: a Turnstile error or a validation error can never lead to delivery. Outbound calls carry `AbortSignal.timeout` (5 s for Turnstile, 8 s for delivery). Malformed JSON, the wrong content type and oversized bodies return 4xx. The browser handles 400, 429, 5xx and network failure distinctly, keeping the visitor's input (`tests/e2e/contact-form.spec.ts`). Stack traces are never returned. |

---

## 3. Evidence

| Check | Command | Result |
|---|---|---|
| Dependency audit (runtime) | `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Dependency audit (including dev) | `npm run audit:dev` | 3 advisories, all inside `@lhci/cli`, no patched release; dev-only |
| Registry signatures | `npm audit signatures` | Not runnable in the build sandbox — the sigstore TUF endpoint returns 403 through the egress proxy. Runs normally in GitHub Actions. |
| Committed secrets | `git grep -nE "(api[_-]?key\|secret\|token\|password)\s*[:=]\s*['\"][^'\"]{8,}"` | No matches outside `.env.example`; also asserted in `tests/security/headers.spec.ts` |
| Security headers | `npm run test:e2e -- tests/security` | 12/12 pass |
| API behaviour | `npm run test:e2e -- tests/api` | 16/16 pass |
| Input handling | `npm run test:e2e -- tests/unit` | 24/24 pass |
| Post-deploy header check | `bash scripts/check-headers.sh <preview-url>` | Run after the Vercel deploy |

---

## 4. Residual risks and follow-ups

1. **Rate limiting is per instance.** The MVP store is in memory, so on Vercel each serverless instance keeps its own counts and a determined attacker spread across instances gets a higher effective limit. Before launch, move this to a Vercel WAF rate-limit rule or a shared store such as Upstash Redis. `src/lib/enquiry/rate-limit.ts` is written as a pure function over an injectable store precisely so the store can be swapped without touching the route.
2. **Delivery is stubbed.** `CONTACT_DELIVERY=log` means no enquiry is actually sent anywhere. Before launch, choose a delivery mode, verify the sending domain, and re-test with a real submission.
3. **Turnstile is off.** If spam appears after launch, set `PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`, and extend the CSP with `script-src` and `frame-src` entries for `https://challenges.cloudflare.com` (see §3 of the build prompt).
4. **HSTS preload is not set.** Adding `preload` is close to irreversible; it needs the client's agreement.
5. **`IP_HASH_SALT` is empty by default.** Set a long random value in Vercel before launch, or the hash falls back to a fixed placeholder salt and becomes reversible for a small address space.
6. **Branch protection is not yet enabled**, because the repository has not been pushed to a remote with settings access. Enable it, plus Dependabot, when the repository is created.
