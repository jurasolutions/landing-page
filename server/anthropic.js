/**
 * The Claude call for AI tools, through the official SDK (@anthropic-ai/sdk
 * v1, which speaks API version 2026-10-21).
 *
 * Request shape, per the claude-api skill:
 * - model claude-haiku-5-5. No temperature: API version 2026-10-21 rejects
 *   sampling parameters outright, and Haiku 5.5 only ever accepted the
 *   defaults. The PRD's "temperature 0" is met instead by structured outputs
 *   (output_config.format), which pins the response to the schema.
 * - output_config.effort "low": Haiku 5.5 thinks by default and thinking
 *   counts towards max_tokens, so extraction runs at the lowest effort.
 * - No tools. The API key is passed explicitly so the SDK never looks for
 *   another credential, and the SDK's own logging is off so nothing about a
 *   request can reach the logs from inside it.
 *
 * ANTHROPIC_BASE_URL exists only so a local `wrangler pages dev` run can
 * point at a stand-in. Leave it unset on Cloudflare Pages.
 */
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-haiku-5-5";

export function anthropicClient(env) {
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.ANTHROPIC_BASE_URL || undefined,
    // No retries inside the SDK: every request sent must be one the site
    // cap has already counted (server/limit.js takeCall).
    maxRetries: 0,
    timeout: 60_000,
    logLevel: "off",
  });
}

/**
 * What kind of failure an API error is:
 *   "billing"     spend limit or credit problem: close the AI tools for the day
 *   "rate"        rate limited: show the used-up message (fail closed)
 *   "unavailable" anything else (overloaded, 5xx, network, timeout, bad key)
 */
export function classifyApiError(error) {
  if (error instanceof Anthropic.APIConnectionError) return "unavailable";
  if (error instanceof Anthropic.RateLimitError) return "rate";
  if (error instanceof Anthropic.APIError) {
    const type = error.error?.error?.type;
    if (error.status === 402 || type === "billing_error") return "billing";
    if (type === "rate_limit_error") return "rate";
    // A workspace spend limit or an empty credit balance has, in the past,
    // come back as a 400 with no type of its own. There is no typed signal
    // for it, so the message is the only way to fail closed on it.
    if (error.status === 400 && /credit balance|usage limit|spend limit/i.test(error.error?.error?.message ?? "")) {
      return "billing";
    }
    return "unavailable";
  }
  return "unavailable";
}

/** Joins the text blocks of a response, ignoring thinking blocks. */
export function responseText(message) {
  return (message.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export function usageOf(message) {
  return {
    input_tokens: message?.usage?.input_tokens ?? 0,
    output_tokens: message?.usage?.output_tokens ?? 0,
  };
}
