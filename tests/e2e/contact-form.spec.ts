import { test, expect, type Page } from "@playwright/test";

const VALID = {
  name: "Anita Rao",
  organisation: "City General Hospital",
  email: "anita.rao@hospital.in",
  phone: "+91 98765 43210",
  message: "We need 500 reinforced surgical gowns in size L, and a quote for drape kits.",
};

async function fillValid(page: Page) {
  await page.fill("#name", VALID.name);
  await page.fill("#organisation", VALID.organisation);
  await page.fill("#email", VALID.email);
  await page.fill("#phone", VALID.phone);
  await page.fill("#message", VALID.message);
  await page.check("#consent");
}

/** Replies to the real endpoint with a canned response. */
async function mockApi(page: Page, status: number, body: unknown) {
  await page.route("**/api/contact/", (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

test.describe("client-side validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contact/");
  });

  test("an empty submit focuses the error summary and marks every required field", async ({ page }) => {
    await page.click("#enquiry-submit");

    const summary = page.locator("#error-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary.locator("li")).toHaveCount(4);

    for (const field of ["name", "email", "message", "consent"]) {
      await expect(page.locator(`#${field}`)).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator(`#${field}-error`)).toBeVisible();
    }

    // Optional fields must not be flagged.
    await expect(page.locator("#organisation")).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#phone")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("an error summary link moves focus to its field", async ({ page }) => {
    await page.click("#enquiry-submit");
    await page.locator("#error-summary a").first().click();
    await expect(page.locator("#name")).toBeFocused();
  });

  test("an invalid email is rejected with the documented message", async ({ page }) => {
    await fillValid(page);
    await page.fill("#email", "anita.rao(at)hospital");
    await page.click("#enquiry-submit");
    await expect(page.locator("#email-error")).toHaveText(
      "Enter an email address in the correct format, like name@hospital.in",
    );
  });

  test("a short message is rejected", async ({ page }) => {
    await fillValid(page);
    await page.fill("#message", "Too short");
    await page.click("#enquiry-submit");
    await expect(page.locator("#message-error")).toHaveText("Enter a message of at least 20 characters");
  });

  test("an invalid phone number is rejected", async ({ page }) => {
    await fillValid(page);
    await page.fill("#phone", "12345");
    await page.click("#enquiry-submit");
    await expect(page.locator("#phone-error")).toHaveText("Enter a phone number with 7 to 15 digits");
  });

  test("consent is required", async ({ page }) => {
    await fillValid(page);
    await page.uncheck("#consent");
    await page.click("#enquiry-submit");
    await expect(page.locator("#consent-error")).toHaveText("Tick the box to agree to the Privacy Policy");
  });

  test("maxlength is enforced on name and message", async ({ page }) => {
    await expect(page.locator("#name")).toHaveAttribute("maxlength", "80");
    await expect(page.locator("#message")).toHaveAttribute("maxlength", "2000");

    await page.fill("#message", "x".repeat(2500));
    const length = await page.locator("#message").inputValue();
    expect(length.length).toBe(2000);
  });

  test("an error clears as soon as the field becomes valid", async ({ page }) => {
    await page.click("#enquiry-submit");
    await expect(page.locator("#name-error")).toBeVisible();
    await page.fill("#name", VALID.name);
    await expect(page.locator("#name-error")).toBeHidden();
  });

  test("the privacy policy link works", async ({ page }) => {
    await page.locator('label[for="consent"] a').click();
    await expect(page).toHaveURL(/\/privacy-policy\/$/);
    await expect(page.locator("h1")).toHaveText("Privacy Policy");
  });

  test("the honeypot is hidden from sight, tab order and assistive tech", async ({ page }) => {
    const honeypot = page.locator("#company_website");
    await expect(honeypot).toHaveAttribute("tabindex", "-1");
    await expect(honeypot).toHaveAttribute("autocomplete", "off");
    await expect(page.locator(".hp-wrap")).toHaveAttribute("aria-hidden", "true");
    await expect(honeypot).toHaveValue("");
  });

  test("the form can be completed with the keyboard alone", async ({ page }) => {
    await page.locator("#name").focus();
    await page.keyboard.type(VALID.name);
    await page.keyboard.press("Tab");
    await page.keyboard.type(VALID.organisation);
    await page.keyboard.press("Tab");
    await page.keyboard.type(VALID.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(VALID.phone);

    await page.locator("#message").focus();
    await page.keyboard.type(VALID.message);
    await page.locator("#consent").focus();
    await page.keyboard.press("Space");

    await expect(page.locator("#consent")).toBeChecked();
    await expect(page.locator("#name")).toHaveValue(VALID.name);
  });
});

test.describe("submission", () => {
  test("a successful send replaces the form and focuses the confirmation", async ({ page }) => {
    await page.goto("/contact/");
    await mockApi(page, 200, { ok: true });
    await fillValid(page);
    await page.click("#enquiry-submit");

    const success = page.locator("#enquiry-success");
    await expect(success).toBeVisible();
    await expect(page.locator("#enquiry-success-heading")).toBeFocused();
    await expect(page.locator("#enquiry-form")).toBeHidden();
    // No reply-time promise is made.
    await expect(success).not.toContainText(/within \d+ (hours?|days?|business)/i);
  });

  test("server field errors are shown inline", async ({ page }) => {
    await page.goto("/contact/");
    await mockApi(page, 400, { ok: false, errors: { email: "Enter a valid work email address" } });
    await fillValid(page);
    await page.click("#enquiry-submit");

    await expect(page.locator("#email-error")).toHaveText("Enter a valid work email address");
    await expect(page.locator("#error-summary")).toBeVisible();
    await expect(page.locator("#name")).toHaveValue(VALID.name);
  });

  test("a rate-limited response explains the wait", async ({ page }) => {
    await page.goto("/contact/");
    await mockApi(page, 429, { ok: false });
    await fillValid(page);
    await page.click("#enquiry-submit");

    await expect(page.locator("#form-status")).toContainText("several enquiries in a short time");
    await expect(page.locator("#message")).toHaveValue(VALID.message);
  });

  test("a server error keeps the input and offers another route", async ({ page }) => {
    await page.goto("/contact/");
    await mockApi(page, 500, { ok: false });
    await fillValid(page);
    await page.click("#enquiry-submit");

    await expect(page.locator("#form-status")).toContainText("couldn’t send your enquiry");
    await expect(page.locator("#message")).toHaveValue(VALID.message);
  });

  test("a network failure is handled", async ({ page }) => {
    await page.goto("/contact/");
    await page.route("**/api/contact/", (route) => route.abort("failed"));
    await fillValid(page);
    await page.click("#enquiry-submit");

    await expect(page.locator("#form-status")).toContainText("couldn’t send your enquiry");
    await expect(page.locator("#email")).toHaveValue(VALID.email);
  });

  test("double-clicking sends exactly one request", async ({ page }) => {
    await page.goto("/contact/");

    let requests = 0;
    await page.route("**/api/contact/", async (route) => {
      requests++;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    });

    await fillValid(page);
    const submit = page.locator("#enquiry-submit");
    await submit.click();
    await submit.click({ force: true }).catch(() => undefined);

    await expect(page.locator("#enquiry-success")).toBeVisible();
    expect(requests).toBe(1);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the form posts to the real endpoint and lands on the success anchor", async ({ page }) => {
    // Wait for the lazy images below the form to settle, so the controls stop
    // moving under the pointer while the fields are filled.
    await page.goto("/contact/", { waitUntil: "networkidle" });

    const form = page.locator("#enquiry-form");
    await expect(form).toHaveAttribute("action", "/api/contact/");
    await expect(form).toHaveAttribute("method", "post");
    // Native validation stays on when the enhancement script has not run.
    await expect(form).not.toHaveAttribute("novalidate", "");

    await fillValid(page);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/contact/")),
      page.click("#enquiry-submit"),
    ]);
    expect(response.status(), await response.text().catch(() => "")).toBe(303);
    expect(response.headers()["location"]).toBe("/contact/#enquiry-sent");

    // The API answers 303 to /contact/#enquiry-sent and CSS :target reveals the panel.
    await expect(page.locator("#enquiry-sent")).toBeVisible();
    await expect(page.locator("#enquiry-sent h2")).toContainText("your enquiry has been sent");
    expect(page.url()).toContain("#enquiry-sent");
  });

  test("the status panels stay hidden until targeted", async ({ page }) => {
    await page.goto("/contact/");
    await expect(page.locator("#enquiry-sent")).toBeHidden();
    await expect(page.locator("#enquiry-error")).toBeHidden();
  });
});
