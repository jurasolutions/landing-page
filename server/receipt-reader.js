/**
 * POST /api/apps/receipt-reader: APP-002.
 *
 * multipart/form-data with `token` (Turnstile) and up to 3 `files` (JPG, PNG
 * or WEBP; the browser has already resized them and rendered any PDF's
 * first page to JPG).
 *
 * The order is fixed (app factory PRD §5.4, APP-002 §5.3):
 *   1. verify Turnstile
 *   2. check the files' number, size and real type
 *   3. take a try from the visitor and a call from the site cap (atomic)
 *   4. call Claude
 *   5. validate the output, with one free repair attempt
 *   6. respond
 * Anything that goes wrong on our side after step 3 gives the try back.
 * Nothing uploaded is stored anywhere: the images live in this request's
 * memory and go to Anthropic's API, and the result goes back to the browser.
 *
 * Responses (`error` is a code; the page owns the words):
 *   200 { receipts, triesLeft }
 *   400 { error: "bad_request" | "count" }       413 { error: "too_large" }
 *   403 { error: "bot_check" }                    415 { error: "heic" | "type" }
 *   429 { error: "limit" | "cap", triesLeft }      502 { error: "unreadable" }
 *   503 { error: "unavailable" }
 */
import { json } from "./http.js";
import { MAX_BODY_BYTES, checkUploads } from "./images.js";
import { closeForToday, refundTry, takeTry } from "./limit.js";
import { verifyTurnstile } from "./turnstile.js";
import { clientIp } from "./visitor.js";
import { bytesToBase64 } from "./crypto.js";
import { aiReady, logCall, reply, visitorContext } from "./ai-tool.js";
import { MODEL, anthropicClient, classifyApiError, responseText, usageOf } from "./anthropic.js";
import {
  RECEIPT_SCHEMA,
  RECEIPT_SYSTEM_PROMPT,
  readModelOutput,
  receiptInstruction,
  repairInstruction,
} from "./receipts.js";

export const TOOL = "receipt-reader";
const MAX_TOKENS = 4096;

function request(images) {
  return {
    model: MODEL,
    // The PRD set 2000; Haiku 5.5's thinking counts towards max_tokens, and
    // three receipts with their line items can need more than 2000 on their
    // own. At Haiku prices the difference is a fraction of a cent.
    max_tokens: MAX_TOKENS,
    system: RECEIPT_SYSTEM_PROMPT,
    output_config: { effort: "low", format: { type: "json_schema", schema: RECEIPT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          ...images.map((image) => ({
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: bytesToBase64(image.bytes) },
          })),
          { type: "text", text: receiptInstruction(images.length) },
        ],
      },
    ],
  };
}

function repairRequest(problems, text) {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: RECEIPT_SYSTEM_PROMPT,
    output_config: { effort: "low", format: { type: "json_schema", schema: RECEIPT_SCHEMA } },
    messages: [{ role: "user", content: repairInstruction(problems, text) }],
  };
}

export async function handleReceiptRead({ request: incoming, env, now }) {
  const started = Date.now();
  if (!aiReady(env)) return json({ error: "unavailable" }, 503);

  const declared = Number(incoming.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);

  let form;
  try {
    form = await incoming.formData();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  // 1. Turnstile.
  const human = await verifyTurnstile({
    secret: env.TURNSTILE_SECRET,
    token: form.get("token"),
    ip: clientIp(incoming),
    url: env.TURNSTILE_VERIFY_URL || undefined,
  });
  if (!human.ok) return json({ error: "bot_check" }, 403);

  // 2. Size and type, before the counter or the API.
  const uploads = await checkUploads(form.getAll("files"));
  if (!uploads.ok) return json({ error: uploads.error }, uploads.status);

  // 3. The try.
  const ctx = await visitorContext(incoming, env, TOOL, now);
  const taken = await takeTry(ctx.db, ctx);
  if (!taken.ok) {
    logCall({ day: ctx.day, tool: TOOL, ok: false, reason: taken.reason, receipts: 0, latency_ms: Date.now() - started });
    return reply(ctx, { error: taken.reason, triesLeft: 0 }, 429);
  }

  const tokens = { input_tokens: 0, output_tokens: 0 };
  const add = (message) => {
    const usage = usageOf(message);
    tokens.input_tokens += usage.input_tokens;
    tokens.output_tokens += usage.output_tokens;
  };
  const fail = async (reason, status, error) => {
    await refundTry(ctx.db, ctx);
    logCall({ day: ctx.day, tool: TOOL, ok: false, reason, receipts: 0, ...tokens, latency_ms: Date.now() - started });
    return reply(ctx, { error, triesLeft: taken.triesLeft + 1 }, status);
  };

  // 4. Claude.
  const client = anthropicClient(env);
  let message;
  try {
    message = await client.messages.create(request(uploads.images));
    add(message);
  } catch (error) {
    const kind = classifyApiError(error);
    if (kind === "billing") {
      // Refund first, then close the day: the close must be the last write.
      const response = await fail("billing", 429, "cap");
      await closeForToday(ctx.db, ctx);
      return response;
    }
    if (kind === "rate") return fail("rate", 429, "cap");
    return fail(`api_${error?.status ?? "network"}`, 503, "unavailable");
  }

  if (message.stop_reason === "refusal") return fail("refusal", 502, "unreadable");

  // 5. Validate, with one repair attempt that costs the visitor nothing.
  let text = responseText(message);
  let result = readModelOutput(text);
  let repaired = false;
  if (!result.ok) {
    repaired = true;
    try {
      const second = await client.messages.create(repairRequest(result.problems, text));
      add(second);
      text = responseText(second);
      result = second.stop_reason === "refusal" ? { ok: false } : readModelOutput(text);
    } catch {
      result = { ok: false };
    }
  }
  if (!result.ok) return fail("invalid_output", 502, "unreadable");

  // 6. Respond.
  logCall({
    day: ctx.day,
    tool: TOOL,
    ok: true,
    receipts: result.receipts.length,
    repaired,
    ...tokens,
    latency_ms: Date.now() - started,
  });
  return reply(ctx, { receipts: result.receipts, triesLeft: taken.triesLeft });
}
