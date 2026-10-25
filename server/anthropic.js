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
 *   "input"       400 invalid_request_error: the API could not process what
 *                 was uploaded, so the try stays used, as with a refusal
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
    // Any other 400 comes from what was sent: an image the API cannot
    // process, say. It is the visitor's input, like a refusal.
    if (error.status === 400 && type === "invalid_request_error") return "input";
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
    cache_creation_input_tokens: message?.usage?.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: message?.usage?.cache_read_input_tokens ?? 0,
  };
}

/**
 * Claude Haiku 5.5's list prices, in nano-dollars (billionths of a US dollar)
 * per token, so every cost is a whole number: US$0.10 per million input
 * tokens and US$0.50 per million output tokens, for prompts up to 100K tokens
 * (a receipt read is well under). Thinking is billed as output and is already
 * in `output_tokens`. Cache writes are 1.25 times input and cache reads 0.1
 * times; the tools don't cache, so those are normally zero. Checked against
 * the claude-api skill's model table (cached 2026-10-06) on 2026-10-25.
 * Change these if Anthropic's prices change.
 */
export const PRICE_NANO_USD = { input: 100, output: 500, cacheWrite: 125, cacheRead: 10 };

/** What a response cost, from its `usage`, in nano-dollars. */
export function costNano(usage) {
  return (
    (usage?.input_tokens ?? 0) * PRICE_NANO_USD.input +
    (usage?.output_tokens ?? 0) * PRICE_NANO_USD.output +
    (usage?.cache_creation_input_tokens ?? 0) * PRICE_NANO_USD.cacheWrite +
    (usage?.cache_read_input_tokens ?? 0) * PRICE_NANO_USD.cacheRead
  );
}

/** Input tokens for the system prompt, the schema and the instruction. */
const BASE_INPUT_TOKENS = 3000;
/**
 * Input tokens for one image. The browser sends at most 1600 px on the long
 * edge, about 3,400 tokens at the API's 750 pixels a token; this rounds up.
 */
const IMAGE_INPUT_TOKENS = 5000;
/** Output tokens a request may use: the tools' max_tokens. */
export const MAX_OUTPUT_TOKENS = 4096;

/**
 * What to reserve from the daily budget before sending a request: a ceiling
 * on what it can cost, settled to the real cost when it returns. `images` is
 * how many images it carries; `inputTokens` covers anything else in the
 * prompt (the earlier answer a repair request quotes back).
 */
export function reservationNano({ images = 0, inputTokens = 0 } = {}) {
  const input = BASE_INPUT_TOKENS + images * IMAGE_INPUT_TOKENS + inputTokens;
  return input * PRICE_NANO_USD.input + MAX_OUTPUT_TOKENS * PRICE_NANO_USD.output;
}

/**
 * Whether a failed request is known not to have been billed: the API
 * answered with an error status. A dropped connection or a timeout may have
 * been billed, so its reservation is kept.
 */
export function unbilled(error) {
  return error instanceof Anthropic.APIError && !(error instanceof Anthropic.APIConnectionError) && Number.isInteger(error.status);
}
