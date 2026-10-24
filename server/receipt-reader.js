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
 *   5. validate the output, with one repair attempt that is free to the
 *      visitor but takes its own call from the site cap (skipped at the cap)
 *   6. respond
 * An API or network failure, output that cannot be repaired, or anything
 * unexpected after step 3 gives the visitor's try back. A refusal does not:
 * it comes from what was uploaded. No call counted against the site cap is
 * ever given back.
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
import { closeForToday, refundTry, takeCall, takeTry } from "./limit.js";
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

  // Steps 3 to 6 run inside one guard: anything unexpected (a D1 binding
  // with no tables, say) gives back a try that was taken and answers 503.
  const state = { ctx: null, taken: null, refunded: false };
  try {
    return await readWithTry({ incoming, env, now, images: uploads.images, started, state });
  } catch (error) {
    const { ctx, taken } = state;
    const owed = taken?.ok && !state.refunded;
    if (owed) {
      try {
        await refundTry(ctx.db, ctx);
      } catch {
        // Nothing more to do: the count resets at midnight SGT.
      }
    }
    console.error(JSON.stringify({ at: "ai-tool", tool: TOOL, ok: false, reason: "error", error: String(error?.name ?? "error") }));
    const triesLeft = taken?.ok ? { triesLeft: taken.triesLeft + 1 } : {};
    return reply(ctx, { error: "unavailable", ...triesLeft }, 503);
  }
}

async function readWithTry({ incoming, env, now, images, started, state }) {
  // 3. The try, and the first call from the site cap.
  const ctx = await visitorContext(incoming, env, TOOL, now);
  state.ctx = ctx;
  const taken = await takeTry(ctx.db, ctx);
  state.taken = taken;
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
  const log = (fields) => logCall({ day: ctx.day, tool: TOOL, receipts: 0, ...fields, ...tokens, latency_ms: Date.now() - started });

  // A failure on our side, or output we could not use: the try comes back.
  const fail = async (reason, status, error) => {
    await refundTry(ctx.db, ctx);
    state.refunded = true;
    log({ ok: false, reason });
    return reply(ctx, { error, triesLeft: taken.triesLeft + 1 }, status);
  };
  // The model declined what was uploaded: the try was used.
  const refused = () => {
    log({ ok: false, reason: "refusal" });
    return reply(ctx, { error: "unreadable", triesLeft: taken.triesLeft }, 502);
  };
  const apiFailure = async (error) => {
    const kind = classifyApiError(error);
    if (kind === "billing") {
      const response = await fail("billing", 429, "cap");
      await closeForToday(ctx.db, ctx);
      return response;
    }
    if (kind === "rate") return fail("rate", 429, "cap");
    return fail(`api_${error?.status ?? "network"}`, 503, "unavailable");
  };

  // 4. Claude. takeTry has already counted this call against the cap.
  const client = anthropicClient(env);
  let message;
  try {
    message = await client.messages.create(request(images));
    add(message);
  } catch (error) {
    return apiFailure(error);
  }
  if (message.stop_reason === "refusal") return refused();

  // 5. Validate, with one repair attempt that costs the visitor nothing but
  // still counts against the site cap.
  let result = readModelOutput(responseText(message));
  let repaired = false;
  if (!result.ok) {
    repaired = true;
    if (!(await takeCall(ctx.db, ctx))) return fail("cap_before_repair", 503, "unavailable");
    let second;
    try {
      second = await client.messages.create(repairRequest(result.problems, responseText(message)));
      add(second);
    } catch (error) {
      return apiFailure(error);
    }
    if (second.stop_reason === "refusal") return refused();
    result = readModelOutput(responseText(second));
  }
  if (!result.ok) return fail("invalid_output", 502, "unreadable");

  // 6. Respond.
  log({ ok: true, receipts: result.receipts.length, repaired });
  return reply(ctx, { receipts: result.receipts, triesLeft: taken.triesLeft });
}
