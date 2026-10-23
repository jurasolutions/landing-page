import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure pieces (money maths, the router's route table, the
 * registry, exports) and for the Pages Functions, which are called directly as
 * `onRequestPost({ request, env })` against an in-memory D1 built on sql.js
 * with the real migrations applied.
 *
 * Nothing here calls Anthropic, Resend or Turnstile. Every outbound `fetch` is
 * stubbed per test, and a stray real request fails the test.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "tests/**/*.test.js"],
    setupFiles: ["tests/setup.js"],
  },
});
