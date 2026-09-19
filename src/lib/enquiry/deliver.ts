import type { Enquiry } from "./schema";
import { ENQUIRY_TYPE_LABELS } from "./schema";

export interface DeliveryContext {
  mode: "log" | "resend" | "smtp" | "webhook";
  to?: string | undefined;
  apiKey?: string | undefined;
  requestId: string;
}

export interface DeliveryResult {
  ok: boolean;
  /** Safe for logs. Never returned to the browser. */
  detail: string;
}

/** Fixed subject: user input never reaches a mail header. */
export const SUBJECT = "New website enquiry – SHAIVI";

const OUTBOUND_TIMEOUT_MS = 8000;

/** Escapes the five HTML-significant characters. Used only by HTML delivery modes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Plain-text body. Every value is already single-line-cleaned by the schema, so
 * no field can introduce a header break here.
 */
export function formatPlainText(enquiry: Enquiry): string {
  const lines = [
    `Name: ${enquiry.name}`,
    `Organisation: ${enquiry.organisation || "—"}`,
    `Email: ${enquiry.email}`,
    `Phone: ${enquiry.phone || "—"}`,
    `Enquiry about: ${ENQUIRY_TYPE_LABELS[enquiry.enquiryType]}`,
    `Product: ${enquiry.product || "—"}`,
    "",
    "Message:",
    enquiry.message,
  ];
  return lines.join("\n");
}

export function formatHtml(enquiry: Enquiry): string {
  const rows: [string, string][] = [
    ["Name", enquiry.name],
    ["Organisation", enquiry.organisation || "—"],
    ["Email", enquiry.email],
    ["Phone", enquiry.phone || "—"],
    ["Enquiry about", ENQUIRY_TYPE_LABELS[enquiry.enquiryType]],
    ["Product", enquiry.product || "—"],
  ];
  const table = rows
    .map(
      ([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const message = escapeHtml(enquiry.message).replace(/\n/g, "<br>");
  return `<table>${table}</table><p><strong>Message</strong></p><p>${message}</p>`;
}

/**
 * A single delivery interface selected by CONTACT_DELIVERY.
 * Provider errors are logged, never surfaced to the browser.
 */
export async function deliverEnquiry(enquiry: Enquiry, context: DeliveryContext): Promise<DeliveryResult> {
  switch (context.mode) {
    case "log":
      return deliverToLog(enquiry, context);
    case "resend":
      return deliverViaResend(enquiry, context);
    case "smtp":
      return deliverViaSmtp();
    case "webhook":
      return deliverViaWebhook();
    default:
      return { ok: false, detail: "unknown delivery mode" };
  }
}

/**
 * Pitch mode. Logs a redacted summary only — never the message body, the full
 * email address or the phone number.
 */
function deliverToLog(enquiry: Enquiry, context: DeliveryContext): DeliveryResult {
  const [local = "", domain = ""] = enquiry.email.split("@");
  const summary = {
    source: "enquiry-delivery",
    mode: "log",
    requestId: context.requestId,
    subject: SUBJECT,
    emailDomain: domain,
    emailLocalLength: local.length,
    hasPhone: enquiry.phone.length > 0,
    hasOrganisation: enquiry.organisation.length > 0,
    enquiryType: enquiry.enquiryType,
    product: enquiry.product || null,
    messageLength: enquiry.message.length,
  };
  console.info(JSON.stringify(summary));
  return { ok: true, detail: "logged" };
}

/**
 * TODO(client): confirm the destination mailbox and verified sending domain,
 * then set CONTACT_DELIVERY=resend, RESEND_API_KEY and CONTACT_TO_EMAIL.
 * Reply-To carries the enquirer's address, which the schema has already
 * validated and stripped of CR/LF.
 */
async function deliverViaResend(enquiry: Enquiry, context: DeliveryContext): Promise<DeliveryResult> {
  if (!context.apiKey || !context.to) {
    return { ok: false, detail: "resend not configured" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // TODO(client): replace with a verified sender on the client's domain.
        from: "SHAIVI website <enquiries@dhrithisurgicalsolutions.com>",
        to: [context.to],
        reply_to: enquiry.email,
        subject: SUBJECT,
        text: formatPlainText(enquiry),
        html: formatHtml(enquiry),
      }),
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, detail: `resend http ${response.status}` };
    return { ok: true, detail: "resend accepted" };
  } catch (error) {
    return { ok: false, detail: `resend failed: ${errorName(error)}` };
  }
}

/**
 * TODO(client): supply SMTP host, port and credentials. Implementing this needs
 * an SMTP dependency (for example nodemailer), which §3 does not yet allow — ask
 * before adding it. Use plain text, the fixed SUBJECT, and a validated Reply-To.
 */
function deliverViaSmtp(): DeliveryResult {
  return { ok: false, detail: "smtp delivery not implemented" };
}

/**
 * TODO(client): supply the CRM or automation webhook URL as a fixed server-side
 * constant. The URL must never come from user input — that would be SSRF.
 */
function deliverViaWebhook(): DeliveryResult {
  return { ok: false, detail: "webhook delivery not implemented" };
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}
