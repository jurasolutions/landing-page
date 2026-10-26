/**
 * Steps 3 to 6 of every AI tool's Function, once its own input checks have
 * passed (app factory PRD §5.4, APP-002 §5.3):
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
 * was sent, does not: it comes from what the visitor sent. Money spent is
 * never given back to the budget; only an unbilled API error releases its
 * reservation.
 *
 * Responses (`error` is a code; the page owns the words):
 *   200 the tool's own body, plus triesLeft
 *   429 { error: "limit" | "cap", triesLeft }      502 { error: "unreadable" }
 *   503 { error: "unavailable" }
 */
import { closeForToday, refundTry, settleQuietly, takeCall, takeTry } from "./limit.js";
import { logCall, reply, visitorContext } from "./ai-tool.js";
import { anthropicClient, classifyApiError, costNano, reservationNano, responseText, unbilled, usageOf } from "./anthropic.js";

/**
 * tool          the registry slug
 * reserve       the first call's worst-case cost (anthropic.js reservationNano)
 * request       the first Messages API request
 * repair        (problems, text) => the repair request
 * read          (text) => { ok: true, ... } | { ok: false, problems }
 * respond       (result) => { body, log }: the 200 body and its log fields
 * logDefaults   fields every log line carries, such as { receipts: 0 }
 */
export async function runAiTry({ incoming, env, now, started, tool, reserve, request, repair, read, respond, logDefaults = {} }) {
  // Everything runs inside one guard: anything unexpected (a D1 binding with
  // no tables, say) gives back a try that was taken and answers 503.
  const state = { ctx: null, taken: null, refund: null };
  const job = { incoming, env, now, started, tool, reserve, request, repair, read, respond, logDefaults };
  try {
    return await withTry(job, state);
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
      tool,
      ok: false,
      reason: "error",
      error: String(error?.name ?? "error"),
      ...logDefaults,
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

async function withTry({ incoming, env, now, started, tool, reserve, request, repair, read, respond, logDefaults }, state) {
  // 3. The try, and the first call's reservation from the daily budget.
  const ctx = await visitorContext(incoming, env, tool, now);
  state.ctx = ctx;
  const taken = await takeTry(ctx.db, { ...ctx, reserve });
  state.taken = taken;
  if (!taken.ok) {
    logCall({ day: ctx.day, tool, ok: false, reason: taken.reason, ...logDefaults, latency_ms: Date.now() - started });
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
  const log = (fields) => logCall({ day: ctx.day, tool, ...logDefaults, ...fields, ...tokens, latency_ms: Date.now() - started });

  // A failure on our side, or output we could not use: the try comes back.
  const fail = async (reason, status, error) => {
    const refunded = await refundOnce(state);
    log({ ok: false, reason });
    return reply(ctx, { error, triesLeft: taken.triesLeft + (refunded ? 1 : 0) }, status);
  };
  // The model declined what was sent, or the API could not process it: the
  // try was used.
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
    message = await client.messages.create(request);
  } catch (error) {
    await released(error, reserve);
    return apiFailure(error);
  }
  await add(message, reserve);
  if (message.stop_reason === "refusal") return refused();

  // 5. Validate, with one repair attempt that costs the visitor nothing but
  // reserves its own cost from the budget.
  let result = read(responseText(message));
  let repaired = false;
  if (!result.ok) {
    repaired = true;
    const repairReserve = reservationNano({ inputTokens: usageOf(message).output_tokens });
    if (!(await takeCall(ctx.db, ctx, repairReserve))) return fail("cap_before_repair", 503, "unavailable");
    let second;
    try {
      second = await client.messages.create(repair(result.problems, responseText(message)));
    } catch (error) {
      await released(error, repairReserve);
      return apiFailure(error);
    }
    await add(second, repairReserve);
    if (second.stop_reason === "refusal") return refused();
    result = read(responseText(second));
  }
  if (!result.ok) return fail("invalid_output", 502, "unreadable");

  // 6. Respond.
  const { body, log: fields } = respond(result);
  log({ ok: true, ...fields, repaired });
  return reply(ctx, { ...body, triesLeft: taken.triesLeft });
}
