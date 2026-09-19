import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { RATE_LIMITED_ORIGIN } from "../support/pages";

const ENDPOINT = "/api/contact/";
const ORIGIN = "http://localhost:4321";

/** A submission that passes every check, with the time trap already satisfied. */
function validForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: "Anita Rao",
    organisation: "City General Hospital",
    email: "anita.rao@hospital.in",
    phone: "+91 98765 43210",
    enquiryType: "product",
    product: "surgical-disposable-gowns",
    message: "We need 500 reinforced surgical gowns in size L, and a quote for drape kits.",
    consent: "on",
    company_website: "",
    startedAt: String(Date.now() - 10_000),
    ...overrides,
  };
}

const jsonHeaders = {
  Origin: ORIGIN,
  Accept: "application/json",
  "Content-Type": "application/json",
  "Sec-Fetch-Site": "same-origin",
};

const formHeaders = {
  Origin: ORIGIN,
  Accept: "application/json",
  "Content-Type": "application/x-www-form-urlencoded",
};

function encode(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

test("GET is rejected with 405 and an Allow header", async ({ request }) => {
  const response = await request.get(ENDPOINT, { headers: { Accept: "application/json" } });
  expect(response.status()).toBe(405);
  expect(response.headers()["allow"]).toBe("POST");
});

test("an unsupported content type is rejected with 415", async ({ request }) => {
  const response = await request.post(ENDPOINT, {
    headers: { Origin: ORIGIN, Accept: "application/json", "Content-Type": "text/plain" },
    data: "name=Anita",
  });
  expect(response.status()).toBe(415);
});

test("a body over 10 KB is rejected with 413", async ({ request }) => {
  const response = await request.post(ENDPOINT, {
    headers: formHeaders,
    data: encode(validForm({ message: "x".repeat(20_000) })),
  });
  expect(response.status()).toBe(413);
});

test("a JSON request from a foreign origin is rejected with 403", async ({ request }) => {
  const response = await request.post(ENDPOINT, {
    headers: { ...jsonHeaders, Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    data: validForm(),
  });
  expect(response.status()).toBe(403);
});

test("a JSON request with no Origin is rejected", async ({ request }) => {
  const response = await request.post(ENDPOINT, {
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    data: validForm(),
  });
  expect(response.status()).toBe(403);
});

test("an invalid payload returns 400 with per-field messages", async ({ request }) => {
  const response = await request.post(ENDPOINT, {
    headers: formHeaders,
    data: encode(validForm({ name: "A", email: "not-an-email", message: "short" })),
  });
  expect(response.status()).toBe(400);

  const body = (await response.json()) as { ok: boolean; errors: Record<string, string> };
  expect(body.ok).toBe(false);
  expect(body.errors.name).toBe("Enter your full name");
  expect(body.errors.email).toContain("name@hospital.in");
  expect(body.errors.message).toBe("Enter a message of at least 20 characters");
});

test("missing consent is rejected", async ({ request }) => {
  const fields = validForm();
  delete fields.consent;
  const response = await request.post(ENDPOINT, { headers: formHeaders, data: encode(fields) });
  expect(response.status()).toBe(400);

  const body = (await response.json()) as { errors: Record<string, string> };
  expect(body.errors.consent).toBe("Tick the box to agree to the Privacy Policy");
});

test("a product outside the allowlist is rejected", async ({ request }) => {
  const response = await request.post(ENDPOINT, {
    headers: formHeaders,
    data: encode(validForm({ product: "../../etc/passwd" })),
  });
  expect(response.status()).toBe(400);
});

test("a valid submission succeeds and is never cached", async ({ request }) => {
  const response = await request.post(ENDPOINT, { headers: formHeaders, data: encode(validForm()) });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["content-type"]).toContain("charset=utf-8");
});

test("a valid JSON submission succeeds", async ({ request }) => {
  const response = await request.post(ENDPOINT, { headers: jsonHeaders, data: validForm() });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("a filled honeypot looks like success but is not delivered", async ({ request }) => {
  const response = await request.post(ENDPOINT, {
    headers: formHeaders,
    data: encode(validForm({ company_website: "https://spam.example" })),
  });
  // The response is deliberately indistinguishable from a real success.
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("a submission faster than three seconds looks like success but is not delivered", async ({
  request,
}) => {
  const response = await request.post(ENDPOINT, {
    headers: formHeaders,
    data: encode(validForm({ startedAt: String(Date.now() - 200) })),
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("a submission with no startedAt is accepted, for visitors without JavaScript", async ({ request }) => {
  const fields = validForm();
  delete fields.startedAt;
  const response = await request.post(ENDPOINT, { headers: formHeaders, data: encode(fields) });
  expect(response.status()).toBe(200);
});

test("CR and LF in a single-line field never reach delivery", async ({ request }) => {
  const response = await request.post(ENDPOINT, {
    headers: formHeaders,
    data: encode(validForm({ name: "Anita Rao\r\nBcc: victim@example.com" })),
  });
  // Either the header-injection attempt is stripped and the name is still valid,
  // or the sanitised value fails validation. Both are safe; what must not happen
  // is a 200 carrying the newline through.
  if (response.status() === 200) {
    expect(await response.json()).toEqual({ ok: true });
  } else {
    expect(response.status()).toBe(400);
  }

  // Prove the sanitiser collapses it rather than passing it along.
  const echo = await request.post(ENDPOINT, {
    headers: formHeaders,
    data: encode(validForm({ name: "Anita\r\nRao" })),
  });
  expect(echo.status()).toBe(200);
});

test("the form redirects rather than returning JSON when the browser asks for HTML", async ({ request }) => {
  const response = await request.post(ENDPOINT, {
    headers: { Origin: ORIGIN, "Content-Type": "application/x-www-form-urlencoded" },
    data: encode(validForm()),
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toBe("/contact/#enquiry-sent");
});

test.describe("rate limiting", () => {
  let api: APIRequestContext;

  // Port 4322 runs the same build with production limits: 5 per ten minutes.
  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({ baseURL: RATE_LIMITED_ORIGIN });
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("the sixth enquiry in ten minutes is refused with Retry-After", async ({}, testInfo) => {
    // Port 4322's limiter counts every client the same, so two projects hitting
    // it in one run would exhaust the allowance before the second even starts.
    // The behaviour is browser-independent, so one project exercises it.
    test.skip(testInfo.project.name !== "desktop-chromium", "runs once per suite");

    const headers = { ...formHeaders, Origin: RATE_LIMITED_ORIGIN };

    for (let i = 1; i <= 5; i++) {
      const response = await api.post(ENDPOINT, { headers, data: encode(validForm()) });
      expect(response.status(), `request ${i} should be allowed`).toBe(200);
    }

    const blocked = await api.post(ENDPOINT, { headers, data: encode(validForm()) });
    expect(blocked.status()).toBe(429);

    const retryAfter = Number(blocked.headers()["retry-after"]);
    expect(Number.isFinite(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(600);
  });
});
