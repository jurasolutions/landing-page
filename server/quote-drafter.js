/**
 * POST /api/apps/quote-builder: APP-001a, draft a quote with AI.
 *
 * application/json { token, prompt }: the Turnstile token and the visitor's
 * request, a loosely written description of the job with its prices.
 *
 * The order is fixed (app factory PRD §5.4):
 *   1. verify Turnstile
 *   2. check the request's size
 *   3–6. the try, Claude, validation with one repair, the response
 *        (server/ai-run.js, shared by every AI tool)
 * Nothing sent is stored or logged: the request lives in this request's
 * memory and goes to Anthropic's API, and the draft goes back to the browser.
 *
 * Responses (`error` is a code; the page owns the words):
 *   200 { draft, triesLeft }
 *   400 { error: "bad_request" }                  413 { error: "too_large" }
 *   403 { error: "bot_check" }                    429 { error: "limit" | "cap", triesLeft }
 *   502 { error: "unreadable", reason: "refused" | "rejected", triesLeft }
 *   503 { error: "busy" | "unavailable", reason?: "bad_output", triesLeft? }
 *   (server/ai-run.js has what each one means)
 *   404 { error: "not_found" }  the tool is a draft and AI_ALLOW_DRAFTS=1 is not set
 */
import { json } from "./http.js";
import { verifyTurnstile } from "./turnstile.js";
import { clientIp } from "./visitor.js";
import { aiReady, isServedAiTool } from "./ai-tool.js";
import { runAiTry } from "./ai-run.js";
import { MAX_OUTPUT_TOKENS, MODEL, reservationNano } from "./anthropic.js";
import {
  MAX_REQUEST_CHARS,
  QUOTE_SCHEMA,
  QUOTE_SYSTEM_PROMPT,
  draftRepairInstruction,
  quoteInstruction,
  readDraftOutput,
} from "./quotes.js";

export const TOOL = "quote-builder";
/** The JSON body: the request at four bytes a character, the token, and room. */
const MAX_BODY_BYTES = MAX_REQUEST_CHARS * 4 + 4096;

const settings = {
  model: MODEL,
  max_tokens: MAX_OUTPUT_TOKENS,
  system: QUOTE_SYSTEM_PROMPT,
  output_config: { effort: "low", format: { type: "json_schema", schema: QUOTE_SCHEMA } },
};

const request = (prompt) => ({ ...settings, messages: [{ role: "user", content: quoteInstruction(prompt) }] });
const repairRequest = (problems, text) => ({ ...settings, messages: [{ role: "user", content: draftRepairInstruction(problems, text) }] });

export async function handleQuoteDraft({ request: incoming, env, registry, now }) {
  const started = Date.now();
  if (!isServedAiTool(TOOL, env, registry)) return json({ error: "not_found" }, 404);
  if (!aiReady(env, TOOL)) return json({ error: "unavailable" }, 503);

  const declared = Number(incoming.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);

  let body;
  try {
    const raw = await incoming.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "bad_request" }, 400);

  // 1. Turnstile.
  const human = await verifyTurnstile({
    secret: env.TURNSTILE_SECRET,
    token: body.token,
    ip: clientIp(incoming),
    url: env.TURNSTILE_VERIFY_URL || undefined,
  });
  if (!human.ok) return json({ error: "bot_check" }, 403);

  // 2. The request itself, before the counter or the API.
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ error: "bad_request" }, 400);
  if (prompt.length > MAX_REQUEST_CHARS) return json({ error: "too_large" }, 413);

  // 3 to 6.
  return runAiTry({
    incoming,
    env,
    now,
    started,
    tool: TOOL,
    // Generous: a character is rarely more than one token.
    reserve: reservationNano({ inputTokens: prompt.length }),
    request: request(prompt),
    repair: repairRequest,
    read: readDraftOutput,
    respond: (result) => ({ body: { draft: result.draft }, log: { items: result.draft.items.length } }),
    logDefaults: { items: 0 },
  });
}
