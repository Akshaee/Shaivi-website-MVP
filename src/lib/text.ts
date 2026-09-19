/**
 * Helpers for reusing brochure copy verbatim. Every excerpt is a literal slice of
 * a string in content.json — nothing is reworded here.
 */

/**
 * A phone number with non-breaking spaces, so it never wraps across lines.
 * content.json keeps the plain-space form; this is a display concern only.
 */
export function nonBreakingPhone(display: string): string {
  return display.replace(/ /g, "\u00a0");
}

/** The first sentence of `text`, including its full stop. */
export function firstSentence(text: string): string {
  const match = /^[\s\S]*?[.!?](?=\s|$)/.exec(text.trim());
  return match ? match[0] : text.trim();
}
