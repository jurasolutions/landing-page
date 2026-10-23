import { afterEach, beforeEach, vi } from "vitest";

/**
 * Any test that reaches the network without stubbing `fetch` first fails
 * loudly. This is what keeps the suite from ever calling Anthropic, Resend or
 * Turnstile for real.
 */
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
      const url = typeof input === "string" ? input : input.url;
      throw new Error(`Unexpected network request in a test: ${url}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
