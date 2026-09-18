/**
 * Helpers for reusing brochure copy verbatim. Every excerpt is a literal slice of
 * a string in content.json — nothing is reworded here.
 */

/** The first sentence of `text`, including its full stop. */
export function firstSentence(text: string): string {
  const match = /^[\s\S]*?[.!?](?=\s|$)/.exec(text.trim());
  return match ? match[0] : text.trim();
}
