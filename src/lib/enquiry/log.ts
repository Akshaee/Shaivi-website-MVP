import { createHash, randomUUID } from "node:crypto";

export type Outcome = "sent" | "spam" | "invalid" | "rate_limited" | "error";

export interface LogEntry {
  timestamp: string;
  requestId: string;
  outcome: Outcome;
  durationMs: number;
  /** Salted SHA-256 of the client IP. Never the IP itself. */
  clientHash: string;
  enquiryType?: string;
  product?: string;
  /** Field names that failed validation — never their values. */
  invalidFields?: string[];
  delivery?: string;
  detail?: string;
}

export function newRequestId(): string {
  return randomUUID();
}

/** Salted, one-way hash so logs can spot abuse without storing personal data. */
export function hashClient(address: string | undefined, salt: string | undefined): string {
  if (!address) return "unknown";
  return createHash("sha256")
    .update(`${salt ?? "no-salt"}:${address}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Writes one structured JSON line. Only the fields above are ever emitted: no
 * name, email, phone, organisation or message body reaches the log.
 */
export function logEnquiry(entry: LogEntry): void {
  const line = JSON.stringify({ source: "enquiry", ...entry });
  if (entry.outcome === "error") console.error(line);
  else console.info(line);
}

/** Builds a log entry from parts, dropping anything undefined. */
export function buildEntry(parts: Omit<LogEntry, "timestamp">): LogEntry {
  const entry: LogEntry = { timestamp: new Date().toISOString(), ...parts };
  for (const key of Object.keys(entry) as (keyof LogEntry)[]) {
    if (entry[key] === undefined) delete entry[key];
  }
  return entry;
}
