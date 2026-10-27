// Regression test for .scratch/receipt-misses/issues/03-defect-not-counted-on-first-visit.md.
// Found by QA in the receipt-misses run.
import { describe, expect, it } from "vitest";
import { createD1 } from "./helpers/d1.js";
import { ENV, RECEIPT, cookieFrom, installNetwork, limitRequest, message, receiptRequest } from "./helpers/ai.js";
import { onRequestPost as readReceipts } from "../functions/api/apps/receipt-reader.js";
import { onRequestGet as getLimit } from "../functions/api/apps/limit.js";
import { failureMessage } from "../src/apps/receipt-reader/read-state.js";
import copy from "../src/apps/receipt-reader/copy.js";

const refusal = () => message("", { stop: "refusal" });

describe("a first visit on a network whose cookie-less bucket was used today", () => {
  it("does not promise 'This try wasn't counted' after a refusal that kept the try", async () => {
    const DB = await createD1();
    const env = { ...ENV, DB };

    // Earlier today, someone on the same IP without the cookie used a try
    // (a browser that refused the cookie, or this visitor before it was set).
    installNetwork({ anthropic: [message(JSON.stringify({ receipts: [RECEIPT] }))] });
    expect((await readReceipts({ request: receiptRequest(), env })).status).toBe(200);

    // A first visit: the page asks for its tries with no cookie and is given one.
    const limitResponse = await getLimit({ request: limitRequest(), env });
    const { triesLeft: triesBefore } = await limitResponse.json();
    const cookie = cookieFrom(limitResponse);

    // The read is refused: the try is used (ai-run.js: 502 refused keeps it).
    installNetwork({ anthropic: [refusal()] });
    const response = await readReceipts({ request: receiptRequest({ cookie }), env });
    const body = await response.json();
    expect(response.status).toBe(502);

    // What the page then says must not claim the try came back.
    const words = failureMessage({ status: 502, body, triesBefore }, copy);
    expect(words).not.toContain(copy.errors.notCounted);
  });
});
