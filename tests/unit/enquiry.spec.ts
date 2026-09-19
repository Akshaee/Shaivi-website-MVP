import { test, expect } from "@playwright/test";
import { parseEnquiry, cleanSingleLine, cleanMultiLine, MESSAGES } from "../../src/lib/enquiry/schema";
import { checkRateLimit, createStore, pruneStore } from "../../src/lib/enquiry/rate-limit";
import { formatPlainText, formatHtml, escapeHtml, SUBJECT } from "../../src/lib/enquiry/deliver";
import { hashClient, buildEntry } from "../../src/lib/enquiry/log";

// These exercise pure functions, so no server is needed.
test.describe.configure({ mode: "parallel" });

const base = {
  name: "Anita Rao",
  organisation: "City General Hospital",
  email: "Anita.Rao@Hospital.IN",
  phone: "+91 98765 43210",
  enquiryType: "product",
  product: "surgical-disposable-gowns",
  message: "We need 500 reinforced surgical gowns in size L, and a quote for drape kits.",
  consent: "on",
};

test.describe("sanitisers", () => {
  test("single-line fields lose CR, LF and other control characters", () => {
    expect(cleanSingleLine("Anita\r\nBcc: victim@example.com")).toBe("Anita Bcc: victim@example.com");
    expect(cleanSingleLine("a\u0000b\u001Fc")).toBe("a b c");
    expect(cleanSingleLine("  spaced   out  ")).toBe("spaced out");
  });

  test("multi-line fields keep paragraph breaks but nothing else", () => {
    expect(cleanMultiLine("line one\r\nline two")).toBe("line one\nline two");
    expect(cleanMultiLine("para\n\n\n\nnext")).toBe("para\n\nnext");
    expect(cleanMultiLine("tab\there")).toBe("tab here");
  });
});

test.describe("schema", () => {
  test("accepts a well-formed enquiry and normalises the email", () => {
    const result = parseEnquiry(base);
    expect(result.ok).toBe(true);
    expect(result.data?.email).toBe("anita.rao@hospital.in");
    expect(result.data?.consent).toBe(true);
  });

  test("strips a header-injection attempt from the name", () => {
    const result = parseEnquiry({ ...base, name: "Anita\r\nBcc: victim@example.com" });
    // The colon is not in the allowed name characters, so this is rejected outright.
    expect(result.ok).toBe(false);

    const folded = parseEnquiry({ ...base, name: "Anita\r\nRao" });
    expect(folded.ok).toBe(true);
    expect(folded.data?.name).toBe("Anita Rao");
    expect(folded.data?.name).not.toMatch(/[\r\n]/);
  });

  test("rejects a name that is too short, too long or full of symbols", () => {
    expect(parseEnquiry({ ...base, name: "A" }).errors?.name).toBe(MESSAGES.name);
    expect(parseEnquiry({ ...base, name: "x".repeat(81) }).errors?.name).toBe(MESSAGES.name);
    expect(parseEnquiry({ ...base, name: "<script>alert(1)</script>" }).errors?.name).toBe(MESSAGES.name);
  });

  test("accepts names with accents and apostrophes", () => {
    expect(parseEnquiry({ ...base, name: "José D'Souza-Rao" }).ok).toBe(true);
  });

  test("validates the email shape", () => {
    for (const email of ["no-at-sign", "missing@tld", "@hospital.in", "a b@hospital.in"]) {
      expect(parseEnquiry({ ...base, email }).errors?.email, email).toBe(MESSAGES.email);
    }
  });

  test("accepts an empty phone but rejects a malformed one", () => {
    expect(parseEnquiry({ ...base, phone: "" }).ok).toBe(true);
    expect(parseEnquiry({ ...base, phone: "12345" }).errors?.phone).toBe(MESSAGES.phone);
    expect(parseEnquiry({ ...base, phone: "+91 98765 43210 9999" }).errors?.phone).toBe(MESSAGES.phone);
    expect(parseEnquiry({ ...base, phone: "call me" }).errors?.phone).toBe(MESSAGES.phone);
  });

  test("enforces message length", () => {
    expect(parseEnquiry({ ...base, message: "too short" }).errors?.message).toBe(MESSAGES.message);
    expect(parseEnquiry({ ...base, message: "y".repeat(2001) }).errors?.message).toBe(MESSAGES.message);
  });

  test("allowlists the select values", () => {
    expect(parseEnquiry({ ...base, enquiryType: "hacked" }).ok).toBe(false);
    expect(parseEnquiry({ ...base, product: "not-a-product" }).errors?.product).toBe(MESSAGES.product);
    expect(parseEnquiry({ ...base, product: "" }).ok).toBe(true);
  });

  test("requires consent", () => {
    const { consent: _consent, ...withoutConsent } = base;
    expect(parseEnquiry(withoutConsent).errors?.consent).toBe(MESSAGES.consent);
    expect(parseEnquiry({ ...base, consent: "off" }).errors?.consent).toBe(MESSAGES.consent);
  });

  test("defaults the enquiry type to a product enquiry", () => {
    const { enquiryType: _type, ...withoutType } = base;
    expect(parseEnquiry(withoutType).data?.enquiryType).toBe("product");
  });
});

test.describe("rate limiter", () => {
  const config = { perTenMinutes: 5, perDay: 20 };
  const minute = 60_000;

  test("allows requests up to the ten-minute limit and then refuses", () => {
    const store = createStore();
    const now = 1_000_000;

    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(store, "client", config, now + i).allowed, `request ${i + 1}`).toBe(true);
    }

    const blocked = checkRateLimit(store, "client", config, now + 5);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(600);
  });

  test("lets the window slide", () => {
    const store = createStore();
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) checkRateLimit(store, "client", config, now + i);

    expect(checkRateLimit(store, "client", config, now + 5).allowed).toBe(false);
    // Eleven minutes later the earlier requests have aged out.
    expect(checkRateLimit(store, "client", config, now + 11 * minute).allowed).toBe(true);
  });

  test("enforces the daily limit even when spread out", () => {
    const store = createStore();
    let now = 1_000_000;
    let allowed = 0;

    for (let i = 0; i < 30; i++) {
      if (checkRateLimit(store, "client", config, now).allowed) allowed++;
      now += 30 * minute; // far enough apart to clear the ten-minute window
    }
    expect(allowed).toBe(config.perDay);
  });

  test("keeps clients separate", () => {
    const store = createStore();
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) checkRateLimit(store, "a", config, now + i);

    expect(checkRateLimit(store, "a", config, now + 5).allowed).toBe(false);
    expect(checkRateLimit(store, "b", config, now + 5).allowed).toBe(true);
  });

  test("pruning drops buckets that have gone quiet", () => {
    const store = createStore();
    const now = 1_000_000;
    checkRateLimit(store, "a", config, now);
    expect(store.size).toBe(1);

    pruneStore(store, now + 60 * minute);
    expect(store.size).toBe(1);

    pruneStore(store, now + 25 * 60 * minute);
    expect(store.size).toBe(0);
  });
});

test.describe("log redaction", () => {
  test("the same client hashes consistently, and never to the raw address", () => {
    const a = hashClient("203.0.113.7", "salt");
    const b = hashClient("203.0.113.7", "salt");
    const c = hashClient("203.0.113.8", "salt");

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain("203.0.113");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  test("a different salt gives a different hash", () => {
    expect(hashClient("203.0.113.7", "salt-one")).not.toBe(hashClient("203.0.113.7", "salt-two"));
  });

  test("a log entry carries no personal data", () => {
    const entry = buildEntry({
      requestId: "abc",
      outcome: "sent",
      durationMs: 12,
      clientHash: hashClient("203.0.113.7", "salt"),
      enquiryType: "product",
      product: "surgical-disposable-gowns",
    });

    const serialised = JSON.stringify(entry);
    for (const secret of [base.email, base.phone, base.name, base.message, base.organisation]) {
      expect(serialised, `log must not contain ${secret}`).not.toContain(secret);
    }
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

test.describe("email formatting", () => {
  const enquiry = parseEnquiry(base).data!;

  test("the subject is fixed and carries no user input", () => {
    expect(SUBJECT).toBe("New website enquiry – SHAIVI");
  });

  test("HTML-significant characters are escaped", () => {
    expect(escapeHtml("<script>alert(\"x\") & 'y'</script>")).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });

  test("the HTML body escapes anything the visitor typed", () => {
    const hostile = parseEnquiry({
      ...base,
      organisation: "Acme <img src=x onerror=alert(1)>",
      message: "Please quote for <b>500</b> gowns & drapes, thanks very much.",
    }).data!;

    const html = formatHtml(hostile);

    // The payload survives as inert text; what matters is that no tag it wrote
    // is still a tag. Only the markup this function emits may contain "<".
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;b&gt;500&lt;/b&gt;");
    expect(html).toContain("&amp;");

    const tags = [...html.matchAll(/<\/?([a-z]+)/g)].map((match) => match[1]);
    expect([...new Set(tags)].sort()).toEqual(
      ["br", "p", "strong", "table", "td", "th", "tr"].filter((tag) => tags.includes(tag)).sort(),
    );
  });

  test("the plain-text body is single-line-safe in every header-bound field", () => {
    const text = formatPlainText(enquiry);
    const headerLines = text.split("\n").slice(0, 6);
    for (const line of headerLines) {
      expect(line).not.toMatch(/[\r]/);
    }
    expect(text).toContain("Name: Anita Rao");
    expect(text).toContain("Email: anita.rao@hospital.in");
  });
});
