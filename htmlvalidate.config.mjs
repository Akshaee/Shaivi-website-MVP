/**
 * html-validate configuration.
 *
 * Only pure formatting rules are relaxed, plus one rule that misfires on this
 * markup. Each relaxation says why.
 */
export default {
  extends: ["html-validate:recommended"],
  rules: {
    // Formatting only: Astro emits self-closing void elements and unquoted
    // boolean attributes, which are valid HTML and not worth rewriting.
    "void-style": "off",
    "attribute-boolean-style": "off",
    "attr-quotes": "off",
    "no-trailing-whitespace": "off",

    // The rule flags any spaced text inside a tel: link, including plain labels
    // such as "Call us". Displayed numbers are rendered with non-breaking spaces
    // by nonBreakingPhone() in src/lib/text.ts, and a Playwright test asserts it.
    "tel-non-breaking": "off",

    // <svg focusable> is an IE-era attribute; the icons already set aria-hidden.
    "svg-focusable": "off",

    // Kept on deliberately — these back up the §3 and §11 requirements.
    "no-inline-style": "error",
    "wcag/h30": "error",
    "wcag/h32": "error",
    "wcag/h36": "error",
    "wcag/h37": "error",
    "wcag/h63": "error",
    "wcag/h67": "error",
    "wcag/h71": "error",
  },
};
