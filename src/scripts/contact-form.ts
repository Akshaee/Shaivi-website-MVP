/**
 * Progressive enhancement for the enquiry form.
 *
 * Without this script the form still works: it posts to /api/contact/ and the
 * API redirects to a :target anchor on /contact/. With it, validation happens
 * in the browser, submission goes through fetch, and errors are announced in
 * place without losing what the visitor typed.
 */

const form = document.querySelector<HTMLFormElement>("#enquiry-form");

if (form) {
  const submitButton = document.querySelector<HTMLButtonElement>("#enquiry-submit");
  const submitStatus = document.querySelector<HTMLParagraphElement>("#submit-status");
  const formStatus = document.querySelector<HTMLDivElement>("#form-status");
  const summary = document.querySelector<HTMLDivElement>("#error-summary");
  const summaryList = document.querySelector<HTMLUListElement>("#error-summary-list");
  const successPanel = document.querySelector<HTMLDivElement>("#enquiry-success");
  const successHeading = document.querySelector<HTMLHeadingElement>("#enquiry-success-heading");
  const startedAt = document.querySelector<HTMLInputElement>("#startedAt");

  // The server treats a submission under three seconds as spam. No-JS visitors
  // leave this empty and the check is skipped for them.
  if (startedAt) startedAt.value = String(Date.now());

  form.setAttribute("novalidate", "");

  type FieldName =
    "name" | "organisation" | "email" | "phone" | "enquiryType" | "product" | "message" | "consent";

  const controls = new Map<FieldName, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
  for (const name of [
    "name",
    "organisation",
    "email",
    "phone",
    "enquiryType",
    "product",
    "message",
    "consent",
  ] as const) {
    const el = form.elements.namedItem(name);
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      controls.set(name, el);
    }
  }

  const messageFor = (name: FieldName): string =>
    document.querySelector<HTMLElement>(`#${name}-error`)?.dataset.message ?? "Check this field";

  const labelFor = (name: FieldName): string => {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${name}"]`);
    return (label?.textContent ?? name).replace(/\(optional\)/i, "").trim();
  };

  let showErrorsOnInput = false;

  function validateField(name: FieldName): string | null {
    const control = controls.get(name);
    if (!control) return null;
    const value = "value" in control ? String(control.value).trim() : "";

    switch (name) {
      case "name":
        if (value.length < 2 || value.length > 80 || !/^[\p{L}\p{M} .'-]+$/u.test(value))
          return messageFor(name);
        return null;
      case "organisation":
        return value.length > 120 ? messageFor(name) : null;
      case "email":
        if (value.length === 0 || value.length > 254) return messageFor(name);
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? null : messageFor(name);
      case "phone": {
        if (value.length === 0) return null;
        const digits = (value.match(/\d/g) ?? []).length;
        if (!/^\+?[\d\s-]{7,20}$/.test(value) || digits < 7 || digits > 15) return messageFor(name);
        return null;
      }
      case "message":
        return value.length < 20 || value.length > 2000 ? messageFor(name) : null;
      case "consent":
        return control instanceof HTMLInputElement && control.checked ? null : messageFor(name);
      default:
        return null;
    }
  }

  function setFieldError(name: FieldName, message: string | null): void {
    const control = controls.get(name);
    const errorEl = document.querySelector<HTMLElement>(`#${name}-error`);
    if (!control || !errorEl) return;

    if (message) {
      errorEl.textContent = message;
      errorEl.classList.remove("hidden");
      control.setAttribute("aria-invalid", "true");
    } else {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
      control.removeAttribute("aria-invalid");
    }
  }

  function showSummary(errors: Map<FieldName, string>): void {
    if (!summary || !summaryList) return;
    summaryList.textContent = "";
    for (const [name, message] of errors) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${name}`;
      link.textContent = `${labelFor(name)}: ${message}`;
      link.className = "font-semibold text-danger";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        controls.get(name)?.focus();
      });
      li.append(link);
      summaryList.append(li);
    }
    summary.classList.remove("hidden");
    summary.focus();
  }

  function hideSummary(): void {
    summary?.classList.add("hidden");
    if (summaryList) summaryList.textContent = "";
  }

  function setFormStatus(message: string | null): void {
    if (!formStatus) return;
    if (message) {
      formStatus.textContent = message;
      formStatus.classList.remove("hidden");
    } else {
      formStatus.textContent = "";
      formStatus.classList.add("hidden");
    }
  }

  for (const [name, control] of controls) {
    control.addEventListener("blur", () => {
      const error = validateField(name);
      if (error || control.getAttribute("aria-invalid") === "true") setFieldError(name, error);
    });
    const revalidate = () => {
      if (showErrorsOnInput || control.getAttribute("aria-invalid") === "true") {
        setFieldError(name, validateField(name));
      }
    };
    control.addEventListener("input", revalidate);
    control.addEventListener("change", revalidate);
  }

  let sending = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;

    showErrorsOnInput = true;
    setFormStatus(null);

    const errors = new Map<FieldName, string>();
    for (const name of controls.keys()) {
      const error = validateField(name);
      setFieldError(name, error);
      if (error) errors.set(name, error);
    }

    if (errors.size > 0) {
      showSummary(errors);
      return;
    }
    hideSummary();

    sending = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
    }
    if (submitStatus) submitStatus.textContent = "Sending…";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        form.hidden = true;
        successPanel?.classList.remove("hidden");
        successHeading?.focus();
        return;
      }

      if (response.status === 400) {
        const data = (await response.json().catch(() => ({}))) as { errors?: Record<string, string> };
        const serverErrors = new Map<FieldName, string>();
        for (const [field, message] of Object.entries(data.errors ?? {})) {
          if (controls.has(field as FieldName)) {
            setFieldError(field as FieldName, message);
            serverErrors.set(field as FieldName, message);
          }
        }
        if (serverErrors.size > 0) showSummary(serverErrors);
        else setFormStatus("We couldn’t send your enquiry. Please check your details and try again.");
        return;
      }

      if (response.status === 429) {
        setFormStatus(
          "You’ve sent several enquiries in a short time. Please try again in a few minutes, or call us.",
        );
        return;
      }

      setFormStatus("We couldn’t send your enquiry. Please try again, or call or email us.");
    } catch {
      setFormStatus("We couldn’t send your enquiry. Please try again, or call or email us.");
    } finally {
      sending = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
      }
      if (submitStatus) submitStatus.textContent = "";
    }
  });
}
