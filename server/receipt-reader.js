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
 *   3. take a try from the visitor and reserve the call's worst-case cost
 *      from the site's daily budget (atomic)
 *   4. call Claude, then settle the reservation to the real cost
 *   5. validate the output, with one repair attempt that is free to the
 *      visitor but reserves its own cost from the budget (skipped when the
 *      budget would not cover it)
 *   6. respond
 * An API or network failure, output that cannot be repaired, or anything
 * unexpected after step 3 gives the visitor's try back, once per visitor per
 * SGT day (server/limit.js refundTry). A refusal, or an API 400 about what
 * was sent, does not: it comes from what was uploaded. Money spent is never
 * given back to the budget; only an unbilled API error releases its
 * reservation.
 * Nothing uploaded is stored anywhere: the images live in this request's
 * memory and go to Anthropic's API, and the result goes back to the browser.
 *
 * Responses (`error` is a code; the page owns the words):
 *   200 { receipts, triesLeft }
 *   400 { error: "bad_request" | "count" }       413 { error: "too_large" }
 *   403 { error: "bot_check" }                    415 { error: "heic" | "type" }
 *   429 { error: "limit" | "cap", triesLeft }      502 { error: "unreadable" }
 *   503 { error: "unavailable" }                  404 { error: "not_found" }
 * 404 means the tool is still `draft` in the registry and AI_ALLOW_DRAFTS=1
 * is not set (server/drafts.js); it is answered before anything else.
 */
import { json } from "./http.js";
import { MAX_BODY_BYTES, checkUploads } from "./images.js";
import { closeForToday, refundTry, settleQuietly, takeCall, takeTry } from "./limit.js";
import { verifyTurnstile } from "./turnstile.js";
import { clientIp } from "./visitor.js";
import { bytesToBase64 } from "./crypto.js";
import { aiReady, isServedAiTool, logCall, reply, visitorContext } from "./ai-tool.js";
import {
  MAX_OUTPUT_TOKENS,
  MODEL,
  anthropicClient,
  classifyApiError,
  costNano,
  reservationNano,
  responseText,
  unbilled,
  usageOf,
} from "./anthropic.js";
import {
  RECEIPT_SCHEMA,
  RECEIPT_SYSTEM_PROMPT,
  readModelOutput,
  receiptInstruction,
  repairInstruction,
} from "./receipts.js";

export const TOOL = "receipt-reader";
const MAX_TOKENS = MAX_OUTPUT_TOKENS;

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

export async function handleReceiptRead({ request: incoming, env, registry, now }) {
  const started = Date.now();
  if (!isServedAiTool(TOOL, env, registry)) return json({ error: "not_found" }, 404);
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
  const state = { ctx: null, taken: null, refund: null };
  try {
    return await readWithTry({ incoming, env, now, images: uploads.images, started, state });
  } catch (error) {
    const { ctx, taken } = state;
    let refunded = false;
    if (taken?.ok) {
      try {
        refunded = await refundOnce(state);
      } catch {
        // Nothing more to do: the count resets at midnight SGT.
      }
    }
    logCall({
      day: ctx?.day,
      tool: TOOL,
      ok: false,
      reason: "error",
      error: String(error?.name ?? "error"),
      receipts: 0,
      latency_ms: Date.now() - started,
    });
    const triesLeft = taken?.ok ? { triesLeft: taken.triesLeft + (refunded ? 1 : 0) } : {};
    return reply(ctx, { error: "unavailable", ...triesLeft }, 503);
  }
}

/**
 * Gives the visitor's try back, at most once per request: `fail` and the
 * guard above share it, so a refund that throws part-way is never run a
 * second time (which could give back more than was taken). Resolves to
 * whether the try came back.
 */
function refundOnce(state) {
  state.refund ??= refundTry(state.ctx.db, state.ctx);
  return state.refund;
}

async function readWithTry({ incoming, env, now, images, started, state }) {
  // 3. The try, and the first call's reservation from the daily budget.
  const ctx = await visitorContext(incoming, env, TOOL, now);
  state.ctx = ctx;
  const reserve = reservationNano({ images: images.length });
  const taken = await takeTry(ctx.db, { ...ctx, reserve });
  state.taken = taken;
  if (!taken.ok) {
    logCall({ day: ctx.day, tool: TOOL, ok: false, reason: taken.reason, receipts: 0, latency_ms: Date.now() - started });
    return reply(ctx, { error: taken.reason, triesLeft: 0 }, 429);
  }

  const tokens = { input_tokens: 0, output_tokens: 0, cost_nano_usd: 0 };
  // Each answer is priced from its token counts, and its reservation settled
  // to that real cost.
  const add = async (message, reserved) => {
    const usage = usageOf(message);
    const cost = costNano(usage);
    tokens.input_tokens += usage.input_tokens;
    tokens.output_tokens += usage.output_tokens;
    tokens.cost_nano_usd += cost;
    await settleQuietly(ctx.db, ctx, cost - reserved);
  };
  // An error answer from the API is not billed; a dropped connection may be.
  const released = async (error, reserved) => {
    if (unbilled(error)) await settleQuietly(ctx.db, ctx, -reserved);
  };
  const log = (fields) => logCall({ day: ctx.day, tool: TOOL, receipts: 0, ...fields, ...tokens, latency_ms: Date.now() - started });

  // A failure on our side, or output we could not use: the try comes back.
  const fail = async (reason, status, error) => {
    const refunded = await refundOnce(state);
    log({ ok: false, reason });
    return reply(ctx, { error, triesLeft: taken.triesLeft + (refunded ? 1 : 0) }, status);
  };
  // The model declined what was uploaded, or the API could not process it:
  // the try was used.
  const refused = (reason = "refusal") => {
    log({ ok: false, reason });
    return reply(ctx, { error: "unreadable", triesLeft: taken.triesLeft }, 502);
  };
  const apiFailure = async (error) => {
    const kind = classifyApiError(error);
    if (kind === "input") return refused("api_400");
    if (kind === "billing") {
      const response = await fail("billing", 429, "cap");
      await closeForToday(ctx.db, ctx);
      return response;
    }
    if (kind === "rate") return fail("rate", 429, "cap");
    return fail(`api_${error?.status ?? "network"}`, 503, "unavailable");
  };

  // 4. Claude. takeTry has already reserved this call's cost.
  const client = anthropicClient(env);
  let message;
  try {
    message = await client.messages.create(request(images));
  } catch (error) {
    await released(error, reserve);
    return apiFailure(error);
  }
  await add(message, reserve);
  if (message.stop_reason === "refusal") return refused();

  // 5. Validate, with one repair attempt that costs the visitor nothing but
  // reserves its own cost from the budget.
  let result = readModelOutput(responseText(message));
  let repaired = false;
  if (!result.ok) {
    repaired = true;
    const repairReserve = reservationNano({ inputTokens: usageOf(message).output_tokens });
    if (!(await takeCall(ctx.db, ctx, repairReserve))) return fail("cap_before_repair", 503, "unavailable");
    let second;
    try {
      second = await client.messages.create(repairRequest(result.problems, responseText(message)));
    } catch (error) {
      await released(error, repairReserve);
      return apiFailure(error);
    }
    await add(second, repairReserve);
    if (second.stop_reason === "refusal") return refused();
    result = readModelOutput(responseText(second));
  }
  if (!result.ok) return fail("invalid_output", 502, "unreadable");

  // 6. Respond.
  log({ ok: true, receipts: result.receipts.length, repaired });
  return reply(ctx, { receipts: result.receipts, triesLeft: taken.triesLeft });
}
