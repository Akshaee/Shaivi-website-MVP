import js from "@eslint/js";
import astro from "eslint-plugin-astro";

export default [
  { ignores: ["dist/**", ".astro/**", ".vercel/**", "test-results/**", "playwright-report/**", ".lighthouseci/**"] },
  js.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { console: "readonly", process: "readonly", document: "readonly", window: "readonly", fetch: "readonly" },
    },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
