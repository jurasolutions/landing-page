/**
 * QA-01 defect 1: the receipt reader tells the visitor "This try wasn't
 * counted" after a failure that did count the try.
 *
 * Since refunds were bounded (ticket 05), three failures keep the try used:
 * a refusal, an API 400 about what was uploaded, and a second refundable
 * failure on the same SGT day. The Function's answer says so in `triesLeft`,
 * but the page picks its message from the status alone
 * (src/apps/receipt-reader/index.jsx, `read`): 502 shows copy.errors.unreadable
 * and 503 shows copy.errors.unavailable, and both end "This try wasn't
 * counted."
 *
 * Each case runs the real Function, then checks the words the page would show
 * for that answer against what actually happened to the visitor's tries.
 */
import { describe, expect, it } from "vitest";
import { createD1 } from "./helpers/d1.js";
import { ENV, RECEIPT, apiError, installNetwork, message, receiptRequest } from "./helpers/ai.js";
import { onRequestPost as readReceipts } from "../functions/api/apps/receipt-reader.js";
import copy from "../src/apps/receipt-reader/copy.js";
import { failureMessage } from "../src/apps/receipt-reader/read-state.js";

const TRIES_PER_DAY = 2;
const NOT_COUNTED = /wasn't counted/i;

/** The message index.jsx shows for a failed read (src/apps/receipt-reader/index.jsx, `read`). */
const shownMessage = (status, body, triesBefore) => failureMessage({ status, body, triesBefore }, copy);

async function setup() {
  const DB = await createD1();
  return { env: { ...ENV, DB } };
}

async function answer(env, cookie) {
  const response = await readReceipts({ request: receiptRequest({ cookie }), env });
  return { status: response.status, body: await response.json() };
}

/** Fails unless the page says the try wasn't counted exactly when it was given back. */
function expectHonest({ status, body }, triesBefore) {
  const counted = body.triesLeft < triesBefore;
  const words = shownMessage(status, body, triesBefore);
  const why = `status ${status}, triesLeft ${triesBefore} -> ${body.triesLeft}`;
  if (counted) expect(words, why).not.toMatch(NOT_COUNTED);
  else expect(words, why).toMatch(NOT_COUNTED);
}

describe("what the receipt reader tells the visitor after a failed try", () => {
  it("does not say the try wasn't counted after a refusal, which keeps the try used", async () => {
    const { env } = await setup();
    installNetwork({ anthropic: [message("", { stop: "refusal" })] });
    const result = await answer(env, `jura_vid=${crypto.randomUUID()}`);
    expect(result).toEqual({ status: 502, body: { error: "unreadable", triesLeft: 1 } });
    expectHonest(result, TRIES_PER_DAY);
  });

  it("does not say the try wasn't counted after an API 400, which keeps the try used", async () => {
    const { env } = await setup();
    installNetwork({ anthropic: [apiError(400, "invalid_request_error", "Could not process image")] });
    const result = await answer(env, `jura_vid=${crypto.randomUUID()}`);
    expect(result.body.triesLeft).toBe(1);
    expectHonest(result, TRIES_PER_DAY);
  });

  it("does not say the try wasn't counted after a second failure the same day, which keeps the try used", async () => {
    const { env } = await setup();
    const cookie = `jura_vid=${crypto.randomUUID()}`;
    installNetwork({ anthropic: ["network", "network"] });
    const first = await answer(env, cookie);
    expect(first.body.triesLeft).toBe(2);
    expectHonest(first, TRIES_PER_DAY);
    const second = await answer(env, cookie);
    expect(second).toEqual({ status: 503, body: { error: "unavailable", triesLeft: 1 } });
    expectHonest(second, first.body.triesLeft);
  });

  it("says the try wasn't counted when it was given back", async () => {
    const { env } = await setup();
    installNetwork({ anthropic: ["network"] });
    const result = await answer(env, `jura_vid=${crypto.randomUUID()}`);
    expect(result).toEqual({ status: 503, body: { error: "unavailable", triesLeft: 2 } });
    expectHonest(result, TRIES_PER_DAY);
  });

  it("keeps the good path unchanged", async () => {
    const { env } = await setup();
    installNetwork({ anthropic: [message(JSON.stringify({ receipts: [RECEIPT] }))] });
    const result = await answer(env, `jura_vid=${crypto.randomUUID()}`);
    expect(result.status).toBe(200);
  });
});
