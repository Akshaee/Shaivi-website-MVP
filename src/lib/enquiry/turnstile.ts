/**
 * Cloudflare Turnstile verification.
 *
 * The endpoint is a fixed constant — no user-supplied URL is ever fetched, so
 * this cannot be turned into an SSRF primitive. Verification fails closed: any
 * error, timeout or non-success response rejects the submission.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

export interface TurnstileResult {
  ok: boolean;
  detail: string;
}

export async function verifyTurnstile(
  token: string | undefined,
  secret: string,
  remoteIp?: string | undefined,
): Promise<TurnstileResult> {
  if (!token) return { ok: false, detail: "missing token" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, detail: `siteverify http ${response.status}` };

    const data = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success === true) return { ok: true, detail: "verified" };
    return { ok: false, detail: (data["error-codes"] ?? ["rejected"]).join(",") };
  } catch (error) {
    return { ok: false, detail: `siteverify failed: ${error instanceof Error ? error.name : "unknown"}` };
  }
}
