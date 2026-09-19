import js from "@eslint/js";

/**
 * ESLint covers the plain JavaScript and TypeScript in scripts/ and src/scripts/.
 *
 * `.astro` files are excluded: linting the TypeScript in their frontmatter needs
 * typescript-eslint, which is outside the agreed dependency list. `astro check`
 * already type-checks every .astro file and runs as the first step of
 * `npm run build`, so nothing goes unchecked.
 */
export default [
  {
    ignores: [
      "dist/**",
      ".astro/**",
      ".vercel/**",
      "test-results/**",
      "playwright-report/**",
      ".lighthouseci*/**",
      "**/*.astro",
      "**/*.ts",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        TextDecoder: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
