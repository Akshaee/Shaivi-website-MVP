import type { APIRoute } from "astro";
import {
  CONTACT_DELIVERY,
  CONTACT_TO_EMAIL,
  RESEND_API_KEY,
  TURNSTILE_SECRET_KEY,
  IP_HASH_SALT,
  RATE_LIMIT_PER_10_MIN,
  RATE_LIMIT_PER_DAY,
} from "astro:env/server";
import { parseEnquiry, spamFieldsSchema } from "../../lib/enquiry/schema";
import { deliverEnquiry } from "../../lib/enquiry/deliver";
import { checkRateLimit, defaultStore, pruneStore } from "../../lib/enquiry/rate-limit";
import { buildEntry, hashClient, logEnquiry, newRequestId, type Outcome } from "../../lib/enquiry/log";
import { verifyTurnstile } from "../../lib/enquiry/turnstile";

export const prerender = false;

const MAX_BODY_BYTES = 10 * 1024;
const MIN_FILL_MS = 3000;

const FORM_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data"];
const JSON_TYPE = "application/json";

const SUCCESS_PATH = "/contact/#enquiry-sent";
const ERROR_PATH = "/contact/#enquiry-error";

const baseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

export const GET: APIRoute = () => methodNotAllowed();
export const PUT: APIRoute = () => methodNotAllowed();
export const PATCH: APIRoute = () => methodNotAllowed();
export const DELETE: APIRoute = () => methodNotAllowed();
export const HEAD: APIRoute = () => methodNotAllowed();

function methodNotAllowed(): Response {
  return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
    status: 405,
    headers: { ...baseHeaders, Allow: "POST" },
  });
}

export const POST: APIRoute = async (context) => {
  const started = Date.now();
  const requestId = newRequestId();
  const { request, clientAddress, site } = context;
  const clientHash = hashClient(clientAddress, IP_HASH_SALT);

  const wantsJson = (request.headers.get("accept") ?? "").includes(JSON_TYPE);

  const finish = (
    status: number,
    outcome: Outcome,
    payload: Record<string, unknown>,
    extra: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ): Response => {
    logEnquiry(
      buildEntry({
        requestId,
        outcome,
        durationMs: Date.now() - started,
        clientHash,
        ...extra,
      }),
    );

    if (wantsJson) {
      return new Response(JSON.stringify(payload), { status, headers: { ...baseHeaders, ...headers } });
    }

    // No-JavaScript path: redirect to a :target anchor on the contact page.
    // The Location stays relative so it resolves against whichever origin served
    // the request — the production domain, a Vercel preview or a local preview —
    // and so a forged Host header can never turn this into an open redirect.
    const ok = payload.ok === true;
    return new Response(null, {
      status: 303,
      headers: { Location: ok ? SUCCESS_PATH : ERROR_PATH, "Cache-Control": "no-store", ...headers },
    });
  };

  try {
    // 2 · Content type
    const contentType = (request.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    const isForm = FORM_TYPES.includes(contentType);
    const isJson = contentType === JSON_TYPE;
    if (!isForm && !isJson) {
      return finish(415, "invalid", { ok: false, error: "Unsupported content type" }, { detail: "content-type" });
    }

    // 3 · Declared size
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return finish(413, "invalid", { ok: false, error: "Request too large" }, { detail: "content-length" });
    }

    // 4 · Origin. Astro's checkOrigin covers form content types; JSON needs its own check.
    if (isJson && !sameOrigin(request, site)) {
      return finish(403, "invalid", { ok: false, error: "Forbidden" }, { detail: "origin" });
    }

    // 3 (continued) · Actual bytes read
    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) {
      return finish(413, "invalid", { ok: false, error: "Request too large" }, { detail: "body-size" });
    }

    const fields = isJson ? readJson(raw) : await readForm(raw, contentType, request);
    if (!fields) {
      return finish(400, "invalid", { ok: false, errors: { form: "Could not read the submission" } }, { detail: "parse" });
    }

    // 7 · Rate limit, before any further work
    const now = Date.now();
    pruneStore(defaultStore, now);
    const limit = checkRateLimit(
      defaultStore,
      clientHash,
      { perTenMinutes: RATE_LIMIT_PER_10_MIN, perDay: RATE_LIMIT_PER_DAY },
      now,
    );
    if (!limit.allowed) {
      return finish(
        429,
        "rate_limited",
        { ok: false, error: "Too many enquiries" },
        {},
        { "Retry-After": String(limit.retryAfter) },
      );
    }

    // 5 · Validation
    const parsed = parseEnquiry(fields);
    if (!parsed.ok || !parsed.data) {
      return finish(
        400,
        "invalid",
        { ok: false, errors: parsed.errors ?? {} },
        { invalidFields: Object.keys(parsed.errors ?? {}) },
      );
    }
    const enquiry = parsed.data;

    // 6 · Spam traps. A hit looks like success but never delivers.
    const spam = spamFieldsSchema.safeParse(fields);
    const honeypot = spam.success ? spam.data.company_website.trim() : "";
    const startedAt = spam.success ? Number(spam.data.startedAt) : Number.NaN;
    const tooFast = Number.isFinite(startedAt) && startedAt > 0 && now - startedAt < MIN_FILL_MS;
    if (honeypot !== "" || tooFast) {
      return finish(
        200,
        "spam",
        { ok: true },
        { detail: honeypot !== "" ? "honeypot" : "time-trap", enquiryType: enquiry.enquiryType },
      );
    }

    // 8 · Turnstile, fail closed when configured
    if (TURNSTILE_SECRET_KEY) {
      const token = typeof fields["cf-turnstile-response"] === "string" ? fields["cf-turnstile-response"] : undefined;
      const verdict = await verifyTurnstile(token, TURNSTILE_SECRET_KEY, clientAddress);
      if (!verdict.ok) {
        return finish(
          400,
          "invalid",
          { ok: false, errors: { form: "We could not verify that you are human. Please try again." } },
          { detail: `turnstile: ${verdict.detail}` },
        );
      }
    }

    // 9 · Delivery
    const delivery = await deliverEnquiry(enquiry, {
      mode: CONTACT_DELIVERY,
      to: CONTACT_TO_EMAIL,
      apiKey: RESEND_API_KEY,
      requestId,
    });

    if (!delivery.ok) {
      return finish(
        500,
        "error",
        { ok: false, error: "We couldn’t send your enquiry. Please try again, or call or email us." },
        { delivery: CONTACT_DELIVERY, detail: delivery.detail },
      );
    }

    return finish(
      200,
      "sent",
      { ok: true },
      { delivery: CONTACT_DELIVERY, enquiryType: enquiry.enquiryType, product: enquiry.product || undefined },
    );
  } catch (error) {
    // 11 · Fail closed, never leak a stack trace.
    return finish(
      500,
      "error",
      { ok: false, error: "We couldn’t send your enquiry. Please try again, or call or email us." },
      { detail: error instanceof Error ? error.name : "unknown" },
    );
  }
};

/** Same-origin check for JSON requests, which Astro's checkOrigin does not cover. */
function sameOrigin(request: Request, site: URL | undefined): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  const expected = new Set<string>();
  if (site) expected.add(site.origin);
  try {
    expected.add(new URL(request.url).origin);
  } catch {
    /* request.url is always absolute in practice */
  }
  const host = request.headers.get("host");
  if (host) {
    expected.add(`https://${host}`);
    expected.add(`http://${host}`);
  }
  return expected.has(origin);
}

function readJson(raw: ArrayBuffer): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(raw));
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readForm(
  raw: ArrayBuffer,
  contentType: string,
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    if (contentType === "application/x-www-form-urlencoded") {
      const params = new URLSearchParams(new TextDecoder().decode(raw));
      return Object.fromEntries(params.entries());
    }
    // multipart: rebuild a Request so the platform parser handles the boundary.
    const rebuilt = new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") ?? "" },
      body: raw,
    });
    const form = await rebuilt.formData();
    const fields: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      // Files are never accepted — the form has no upload field.
      if (typeof value === "string") fields[key] = value;
    }
    return fields;
  } catch {
    return null;
  }
}
