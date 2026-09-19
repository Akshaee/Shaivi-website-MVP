import { z } from "astro/zod";
import content from "../../data/content.json" with { type: "json" };

export const ENQUIRY_TYPES = ["product", "custom", "bulk", "other"] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

export const PRODUCT_IDS: string[] = content.about.categories.map((c) => c.id);

export const ENQUIRY_TYPE_LABELS: Record<EnquiryType, string> = {
  product: "Product enquiry",
  custom: "Customised drapes, kits or gowns",
  bulk: "Bulk or distributor enquiry",
  other: "Other",
};

/** Field-level messages, shared by the browser and the API so both read the same. */
export const MESSAGES = {
  name: "Enter your full name",
  email: "Enter an email address in the correct format, like name@hospital.in",
  phone: "Enter a phone number with 7 to 15 digits",
  message: "Enter a message of at least 20 characters",
  consent: "Tick the box to agree to the Privacy Policy",
  enquiryType: "Choose what your enquiry is about",
  organisation: "Enter 120 characters or fewer",
  product: "Choose a product from the list",
} as const;

// Control characters, as ranges, kept out of a literal so the source stays printable.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Collapses whitespace and strips control characters. CR and LF are removed from
 * every single-line field, which is what blocks email header injection.
 */
export function cleanSingleLine(value: string): string {
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
}

/** Multi-line fields keep their paragraph breaks but lose other control characters. */
export function cleanMultiLine(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_EXCEPT_NEWLINE, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Deliberately simple: the server is not the place to re-implement RFC 5322, and
// the same shape is checked in the browser so both agree.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const digitsIn = (value: string) => (value.match(/\d/g) ?? []).length;

const singleLine = (max: number) =>
  z
    .string()
    .max(max * 4)
    .transform(cleanSingleLine);

export const enquirySchema = z.object({
  name: singleLine(80).pipe(
    z
      .string()
      .min(2, MESSAGES.name)
      .max(80, MESSAGES.name)
      .regex(/^[\p{L}\p{M} .'-]+$/u, MESSAGES.name),
  ),
  organisation: singleLine(120).pipe(z.string().max(120, MESSAGES.organisation)).optional().default(""),
  email: singleLine(254)
    .pipe(z.string().min(3, MESSAGES.email).max(254, MESSAGES.email).regex(EMAIL_PATTERN, MESSAGES.email))
    .transform((value) => value.toLowerCase()),
  phone: singleLine(40)
    .pipe(
      z
        .string()
        .refine((value) => value === "" || /^\+?[\d\s-]{7,20}$/.test(value), MESSAGES.phone)
        .refine((value) => value === "" || (digitsIn(value) >= 7 && digitsIn(value) <= 15), MESSAGES.phone),
    )
    .optional()
    .default(""),
  enquiryType: z.enum(ENQUIRY_TYPES, { message: MESSAGES.enquiryType }).optional().default("product"),
  product: z
    .string()
    .max(200)
    .transform(cleanSingleLine)
    .refine((value) => value === "" || PRODUCT_IDS.includes(value), MESSAGES.product)
    .optional()
    .default(""),
  message: z
    .string()
    .max(8000)
    .transform(cleanMultiLine)
    .pipe(z.string().min(20, MESSAGES.message).max(2000, MESSAGES.message)),
  consent: z
    .union([z.literal("on"), z.literal("true"), z.literal(true)], { message: MESSAGES.consent })
    .transform(() => true),
});

export type Enquiry = z.infer<typeof enquirySchema>;

/** Raw anti-spam fields, validated separately from the enquiry itself. */
export const spamFieldsSchema = z.object({
  company_website: z.string().max(200).optional().default(""),
  startedAt: z.string().max(32).optional().default(""),
});

export interface ParseResult {
  ok: boolean;
  data?: Enquiry;
  errors?: Record<string, string>;
}

export function parseEnquiry(input: Record<string, unknown>): ParseResult {
  const result = enquirySchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!(field in errors)) errors[field] = issue.message;
  }
  return { ok: false, errors };
}
