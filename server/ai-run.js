/**
 * Steps 3 to 6 of every AI tool's Function, once its own input checks have
 * passed (app factory PRD §5.4, APP-002 §5.3):
 *   3. take a try from the visitor and reserve the call's worst-case cost
 *      from the site's daily budget (atomic)
 *   4. call Claude, then settle the reservation to the real cost
 *   5. validate the output, with one repair attempt that is free to the
 *      visitor but reserves its own cost from the budget (skipped when the
 *      budget would not cover it)
 *   5b. a tool's optional `finish` step: a second, non-Claude cost (the
 *      product photo studio's pictures) reserved with the try at step 3 and
 *      settled here; it can answer with its own status or fail the try
 *   6. respond
 * An API or network failure, output that cannot be repaired, or anything
 * unexpected after step 3 gives the visitor's try back, once per visitor per
 * SGT day (server/limit.js refundTry). A refusal, or an API 400 about what
 * was sent, does not: it comes from what the visitor sent. Money spent is
 * never given back to the budget; only an unbilled API error releases its
 * reservation.
 *
 * Responses (`error` is a code and `reason` says why; the page owns the words):
 *   200 the tool's own body, plus triesLeft (a finish step may answer with
 *       another status, such as the product photo studio's 422 no_product)
 *   429 { error: "limit" | "cap", triesLeft }      billing closes the day: cap
 *   502 { error: "unreadable", reason: "refused", triesLeft }    the model
 *       declined what was sent; the try is used
 *   502 { error: "unreadable", reason: "rejected", triesLeft }   the API could
 *       not process what was sent (a 400); the try is used
 *   503 { error: "busy", triesLeft }              Anthropic's rate limit; the
 *       try comes back, and the visitor's tries are not used up
 *   503 { error: "unavailable", reason: "bad_output", triesLeft }   the output
 *       was still wrong after the repair; the try comes back
 *   503 { error: "unavailable", triesLeft? }      anything else on our side
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
 *               (not used when `finish` is given)
 * logDefaults   fields every log line carries, such as { receipts: 0 }
 * finish        optional, for a tool with a second cost after Claude:
 *   reserve     nano-dollars: that step's worst case. It is reserved with the
 *               try, in the same statement, so a try never pays for Claude
 *               and then finds no money left for the rest. Reserving it
 *               counts no call towards AI_SITE_CAP; a step that sends Claude
 *               another request counts that request itself (`countCall`,
 *               below).
 *   costField   the log field for what the step spent (default
 *               "image_nano_usd", the product photo studio's pictures)
 *   run         async (result, { countCall }) => FinishOutcome, once the
 *               output validates. A step that sends Claude another request
 *               (the receipt reader's second look) calls `countCall()` first:
 *               it counts that request towards AI_SITE_CAP, with no further
 *               reservation (the step's own covers it), and resolves false
 *               when the request must not be sent.
 *     { ok: true, spent, body, log, status? }   status defaults to 200
 *     { ok: false, spent, reason, kind: "cap" | "unavailable" }
 *               `spent` is what the step really cost; the reservation is
 *               settled to it. ok: false gives the try back and answers 429
 *               (cap) or 503 (unavailable). If `run` throws, its reservation
 *               stays spent, since some of it may have been.
 */
export async function runAiTry({ incoming, env, now, started, tool, reserve, request, repair, read, respond, logDefaults = {}, finish = null }) {
  // Everything runs inside one guard: anything unexpected (a D1 binding with
  // no tables, say) gives back a try that was taken and answers 503.
  // `held` is the finish step's reservation while it is still unused: every
  // exit before that step runs releases it here, in one place.
  const state = { ctx: null, taken: null, refund: null, held: 0 };
  const job = { incoming, env, now, started, tool, reserve, request, repair, read, respond, logDefaults, finish };
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
  } finally {
    await releaseHeld(state);
  }
}

/**
 * Releases the finish step's reservation if it is still held, once. Runs on
 * every exit before that step, and before anything that sets the day's spend
 * outright (closeForToday), so a later release cannot take the spend back
 * below the budget and reopen the tools.
 */
async function releaseHeld(state) {
  const held = state.held;
  state.held = 0;
  if (held > 0) await settleQuietly(state.ctx.db, state.ctx, -held);
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

async function withTry({ incoming, env, now, started, tool, reserve, request, repair, read, respond, logDefaults, finish }, state) {
  // 3. The try, and the first call's reservation from the daily budget, with
  // the finish step's worst case when there is one.
  const ctx = await visitorContext(incoming, env, tool, now);
  state.ctx = ctx;
  const finishReserve = finish?.reserve ?? 0;
  const taken = await takeTry(ctx.db, { ...ctx, reserve: reserve + finishReserve });
  state.taken = taken;
  if (!taken.ok) {
    logCall({ day: ctx.day, tool, ok: false, reason: taken.reason, ...logDefaults, latency_ms: Date.now() - started });
    return reply(ctx, { error: taken.reason, triesLeft: 0 }, 429);
  }
  state.held = finishReserve;

  const tokens = { input_tokens: 0, output_tokens: 0, cost_nano_usd: 0 };
  // Only a tool with a finish step logs its cost, so the others' log lines
  // keep their exact shape.
  const costField = finish?.costField ?? "image_nano_usd";
  const extra = finish ? { [costField]: 0 } : {};
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
  const log = (fields) =>
    logCall({ day: ctx.day, tool, ...logDefaults, ...fields, ...tokens, ...extra, latency_ms: Date.now() - started });

  // A failure on our side, or output we could not use: the try comes back.
  // `why` is the reason the page is told, when it has one.
  const fail = async (reason, status, error, why) => {
    const refunded = await refundOnce(state);
    log({ ok: false, reason });
    return reply(ctx, { error, ...(why ? { reason: why } : {}), triesLeft: taken.triesLeft + (refunded ? 1 : 0) }, status);
  };
  // The model declined what was sent ("refused"), or the API could not
  // process it ("rejected"): the try was used.
  const refused = (reason, why) => {
    log({ ok: false, reason });
    return reply(ctx, { error: "unreadable", reason: why, triesLeft: taken.triesLeft }, 502);
  };
  const apiFailure = async (error) => {
    const kind = classifyApiError(error);
    if (kind === "input") return refused("api_400", "rejected");
    if (kind === "billing") {
      const response = await fail("billing", 429, "cap");
      // Released first: the close must be the last word on today's spend.
      await releaseHeld(state);
      await closeForToday(ctx.db, ctx);
      return response;
    }
    // Anthropic is busy for a moment; the visitor's tries are not used up.
    if (kind === "rate") return fail("rate", 503, "busy");
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
  if (message.stop_reason === "refusal") return refused("refusal", "refused");

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
    if (second.stop_reason === "refusal") return refused("refusal", "refused");
    result = read(responseText(second));
  }
  if (!result.ok) return fail("invalid_output", 503, "unavailable", "bad_output");

  // 5b. The finish step. Its reservation is handed over first: from here a
  // throw keeps it spent (fail closed, like a dropped Claude connection).
  if (finish) {
    const held = state.held;
    state.held = 0;
    const outcome = await finish.run(result, { countCall: () => takeCall(ctx.db, ctx, 0) });
    extra[costField] = outcome.spent;
    await settleQuietly(ctx.db, ctx, outcome.spent - held);
    if (!outcome.ok) {
      const cap = outcome.kind === "cap";
      return fail(outcome.reason, cap ? 429 : 503, cap ? "cap" : "unavailable");
    }
    const status = outcome.status ?? 200;
    log({ ok: status < 400, ...outcome.log, repaired });
    return reply(ctx, { ...outcome.body, triesLeft: taken.triesLeft }, status);
  }

  // 6. Respond.
  const { body, log: fields } = respond(result);
  log({ ok: true, ...fields, repaired });
  return reply(ctx, { ...body, triesLeft: taken.triesLeft });
}
