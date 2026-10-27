import { describe, expect, it } from "vitest";
import { createD1 } from "./helpers/d1.js";
import { ENV, RECEIPT, apiError, cookieFrom, installNetwork, limitRequest, message, receiptRequest } from "./helpers/ai.js";
import { onRequestPost as readReceipts } from "../functions/api/apps/receipt-reader.js";
import { onRequestGet as getLimit } from "../functions/api/apps/limit.js";
import { limitConfig } from "../server/limit.js";
import { PRICE_NANO_USD, costNano, reservationNano } from "../server/anthropic.js";

const good = (usage) => message(JSON.stringify({ receipts: [RECEIPT] }), usage);

/** The production defaults: ENV without the tests' 2-and-6 overrides. */
const { AI_TRIES_PER_DAY, AI_TRIES_PER_IP, ...DEFAULTS } = ENV;

async function setup(extra = {}) {
  const DB = await createD1();
  return { DB, env: { ...DEFAULTS, DB, ...extra } };
}

const spent = (DB) => DB.rows("app_spend").map((r) => r.nano_usd);

/** What one Claude request carrying one receipt reserves before it is sent. */
const ONE = reservationNano({ images: 1 });
/**
 * What a try at one receipt reserves: the first request, and the second
 * look's worst case, held with the try in case the first reading finds no
 * receipt (server/receipt-reader.js). The unused part is released.
 */
const TRY = 2 * ONE;
/** What the helper's default answer (1,500 in, 400 out) really costs. */
const ACTUAL = 1500 * PRICE_NANO_USD.input + 400 * PRICE_NANO_USD.output;

/** A budget in US dollars, from nano-dollars. */
const usd = (nano) => String(nano / 1e9);

describe("the defaults", () => {
  it("are 5 tries a visitor, 15 an IP, US$5 a day and no call cap", () => {
    expect(limitConfig({})).toMatchObject({
      triesPerDay: 5,
      triesPerIp: 15,
      budgetNano: 5_000_000_000,
      siteCap: null,
    });
  });

  it("give a visitor 5 tries a day, and refuse the sixth without calling the API", async () => {
    const { env } = await setup();
    const net = installNetwork({ anthropic: Array.from({ length: 5 }, () => good()) });
    const cookie = cookieFrom(await getLimit({ request: limitRequest(), env }));
    for (let i = 0; i < 5; i += 1) {
      expect((await readReceipts({ request: receiptRequest({ cookie }), env })).status).toBe(200);
    }
    const sixth = await readReceipts({ request: receiptRequest({ cookie }), env });
    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toEqual({ error: "limit", triesLeft: 0 });
    expect(net.anthropic).toHaveLength(5);
  });

  it("read a budget in dollars and cents, and treat a bad value as the default", () => {
    expect(limitConfig({ AI_DAILY_BUDGET_USD: "2.50" }).budgetNano).toBe(2_500_000_000);
    expect(limitConfig({ AI_DAILY_BUDGET_USD: "0" }).budgetNano).toBe(0);
    expect(limitConfig({ AI_DAILY_BUDGET_USD: "five" }).budgetNano).toBe(5_000_000_000);
    expect(limitConfig({ AI_DAILY_BUDGET_USD: "-1" }).budgetNano).toBe(5_000_000_000);
    expect(limitConfig({ AI_SITE_CAP: "300" }).siteCap).toBe(300);
  });
});

describe("cost", () => {
  it("is priced from the API's token counts, thinking included in the output", () => {
    expect(costNano({ input_tokens: 1_000_000, output_tokens: 0 })).toBe(100_000_000); // US$0.10
    expect(costNano({ input_tokens: 0, output_tokens: 1_000_000 })).toBe(500_000_000); // US$0.50
    expect(costNano({ input_tokens: 1500, output_tokens: 400 })).toBe(ACTUAL);
  });

  it("reserves more than a typical read actually costs", () => {
    expect(ONE).toBeGreaterThan(ACTUAL);
    expect(reservationNano({ images: 3 })).toBeGreaterThan(ONE);
  });
});

describe("the daily budget", () => {
  it("records what each read really cost", async () => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: [good(), good({ input: 6000, output: 900 })] });
    await readReceipts({ request: receiptRequest(), env });
    expect(spent(DB)).toEqual([ACTUAL]);
    await readReceipts({ request: receiptRequest(), env });
    expect(spent(DB)).toEqual([ACTUAL + costNano({ input_tokens: 6000, output_tokens: 900 })]);
  });

  it("stops everyone once a request would take the day past the budget, without calling the API", async () => {
    // Room for one try's reservation, then one more once the first has settled.
    const { DB, env } = await setup({ AI_DAILY_BUDGET_USD: usd(ACTUAL + TRY) });
    const net = installNetwork({ anthropic: [good(), good()] });
    expect((await readReceipts({ request: receiptRequest({ ip: "192.0.2.1" }), env })).status).toBe(200);
    expect((await readReceipts({ request: receiptRequest({ ip: "192.0.2.2" }), env })).status).toBe(200);

    const third = await readReceipts({ request: receiptRequest({ ip: "192.0.2.3" }), env });
    expect(third.status).toBe(429);
    expect((await third.json()).error).toBe("cap");
    expect(net.anthropic).toHaveLength(2);
    expect(spent(DB)).toEqual([2 * ACTUAL]);
  });

  it("refuses a try the budget cannot cover with its second look, before calling the API", async () => {
    const { DB, env } = await setup({ AI_DAILY_BUDGET_USD: usd(TRY - 1) });
    const net = installNetwork({ anthropic: [] });
    const response = await readReceipts({ request: receiptRequest(), env });
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("cap");
    expect(net.anthropic).toHaveLength(0);
    expect(spent(DB)).toEqual([]);
  });

  it("gives the refused visitor their try back for when the budget resets", async () => {
    const { DB, env } = await setup({ AI_DAILY_BUDGET_USD: usd(ONE - 1) });
    const net = installNetwork({ anthropic: [] });
    const response = await readReceipts({ request: receiptRequest(), env });
    expect(response.status).toBe(429);
    expect(net.anthropic).toHaveLength(0);
    expect(DB.rows("app_tries").every((r) => r.count === 0)).toBe(true);
  });

  it("is reported on /api/apps/limit once it is spent", async () => {
    const { DB, env } = await setup({ AI_DAILY_BUDGET_USD: usd(ACTUAL + TRY) });
    installNetwork({ anthropic: [good()] });
    await readReceipts({ request: receiptRequest(), env });
    let limit = await (await getLimit({ request: limitRequest({ ip: "192.0.2.9" }), env })).json();
    expect(limit.capReached).toBe(false);

    await DB.prepare("UPDATE app_spend SET nano_usd = ?1").bind(ACTUAL + TRY).run();
    limit = await (await getLimit({ request: limitRequest({ ip: "192.0.2.9" }), env })).json();
    expect(limit).toMatchObject({ capReached: true, triesLeft: 5 });
  });

  it("counts the repair request too", async () => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: [message("not json", { input: 1500, output: 400 }), good({ input: 2000, output: 300 })] });
    expect((await readReceipts({ request: receiptRequest(), env })).status).toBe(200);
    expect(spent(DB)).toEqual([ACTUAL + costNano({ input_tokens: 2000, output_tokens: 300 })]);
  });

  it("skips the repair when it would go past the budget", async () => {
    // The first answer is long, so the repair (which quotes it back) reserves
    // more than is left while the second look's reservation is still held.
    const first = costNano({ input_tokens: 1500, output_tokens: 4000 });
    const repair = reservationNano({ inputTokens: 4000 });
    const { DB, env } = await setup({ AI_DAILY_BUDGET_USD: usd(first + ONE + repair - 1) });
    const net = installNetwork({ anthropic: [message("not json", { input: 1500, output: 4000 })] });
    const response = await readReceipts({ request: receiptRequest(), env });
    expect(response.status).toBe(503);
    expect(net.anthropic).toHaveLength(1);
    expect(spent(DB)).toEqual([first]);
  });

  it("charges a refusal at its real cost: the call was made", async () => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: [message("", { stop: "refusal", input: 1500, output: 400 })] });
    await readReceipts({ request: receiptRequest(), env });
    expect(spent(DB)).toEqual([ACTUAL]);
  });

  it("releases the reservation when the API answers with an error, which is not billed", async () => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: [apiError(500, "api_error")] });
    await readReceipts({ request: receiptRequest(), env });
    expect(spent(DB)).toEqual([0]);
  });

  it("keeps the reservation when the connection drops, since the call may have been billed", async () => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: ["network"] });
    await readReceipts({ request: receiptRequest(), env });
    expect(spent(DB)).toEqual([ONE]);
  });

  it("closes for the day when the API reports a billing problem", async () => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: [apiError(402, "billing_error", "Spend limit reached")] });
    expect((await readReceipts({ request: receiptRequest(), env })).status).toBe(429);
    expect(spent(DB)).toEqual([5_000_000_000]);

    const net = installNetwork({ anthropic: [] });
    const next = await readReceipts({ request: receiptRequest({ ip: "198.51.100.2" }), env });
    expect(next.status).toBe(429);
    expect(net.anthropic).toHaveLength(0);
  });

  it("starts again on the next SGT day", async () => {
    const { env } = await setup({ AI_DAILY_BUDGET_USD: usd(ACTUAL + TRY) });
    const net = installNetwork({ anthropic: [good(), good(), good()] });
    const day1 = Date.parse("2026-10-25T03:00:00Z");
    const day2 = Date.parse("2026-10-25T17:00:00Z"); // 01:00 on 26 October in Singapore
    await readReceipts({ request: receiptRequest({ ip: "192.0.2.1" }), env, now: day1 });
    await readReceipts({ request: receiptRequest({ ip: "192.0.2.2" }), env, now: day1 });
    expect((await readReceipts({ request: receiptRequest({ ip: "192.0.2.3" }), env, now: day1 })).status).toBe(429);
    expect((await readReceipts({ request: receiptRequest({ ip: "192.0.2.3" }), env, now: day2 })).status).toBe(200);
    expect(net.anthropic).toHaveLength(3);
  });
});
