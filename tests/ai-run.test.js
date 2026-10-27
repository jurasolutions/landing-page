/**
 * runAiTry's finish step, through its own interface, for the paths no tool
 * can reach from its Function: the product photo studio's step never throws
 * on its own, but a future step might.
 */
import { describe, expect, it } from "vitest";
import { createD1 } from "./helpers/d1.js";
import { ENV, apiError, installNetwork, message, receiptRequest } from "./helpers/ai.js";
import { runAiTry } from "../server/ai-run.js";
import { MODEL } from "../server/anthropic.js";

const RESERVE = 1_000_000;
const FINISH_RESERVE = 7_000_000;
/** message(): 1,500 input and 400 output tokens. */
const CLAUDE_COST = 1500 * 100 + 400 * 500;

async function run(finish, anthropic = [message('{"ok":true}')]) {
  const DB = await createD1();
  installNetwork({ anthropic });
  const response = await runAiTry({
    incoming: receiptRequest(),
    env: { ...ENV, DB },
    started: Date.now(),
    tool: "receipt-reader",
    reserve: RESERVE,
    request: { model: MODEL, max_tokens: 100, messages: [{ role: "user", content: "x" }] },
    repair: () => ({ model: MODEL, max_tokens: 100, messages: [{ role: "user", content: "x" }] }),
    read: (text) => (text.includes("ok") ? { ok: true } : { ok: false, problems: ["bad"] }),
    finish,
  });
  const spend = DB.rows("app_spend")[0]?.nano_usd ?? 0;
  const tries = DB.rows("app_tries").find((r) => r.tool === "*")?.count;
  return { response, body: await response.json(), spend, tries };
}

describe("runAiTry's finish step", () => {
  it("keeps the whole reservation when the step throws, since some of it may have been spent, and gives the try back", async () => {
    const { response, body, spend, tries } = await run({
      reserve: FINISH_RESERVE,
      run: async () => {
        throw new Error("boom");
      },
    });
    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "unavailable", triesLeft: 2 });
    expect(tries).toBe(0);
    expect(spend).toBe(CLAUDE_COST + FINISH_RESERVE);
  });

  it("settles to what the step spent, and answers with its status", async () => {
    const { response, body, spend } = await run({
      reserve: FINISH_RESERVE,
      run: async () => ({ ok: true, spent: 2_500_000, status: 201, body: { made: 1 }, log: {} }),
    });
    expect(response.status).toBe(201);
    expect(body).toEqual({ made: 1, triesLeft: 1 });
    expect(spend).toBe(CLAUDE_COST + 2_500_000);
  });

  it("releases the reservation once on an early exit, and never runs the step", async () => {
    let ran = false;
    const { response, spend } = await run(
      { reserve: FINISH_RESERVE, run: async () => (ran = true) },
      [message("nope"), message("still nope")]
    );
    expect(response.status).toBe(503);
    expect(ran).toBe(false);
    expect(spend).toBe(2 * CLAUDE_COST);
  });

  it("leaves the day closed after a billing error: the reservation goes back before the close", async () => {
    const { response, spend } = await run({ reserve: FINISH_RESERVE, run: async () => ({ ok: true, spent: 0, body: {} }) }, [
      apiError(402, "billing_error"),
    ]);
    expect(response.status).toBe(429);
    expect(spend).toBe(5_000_000_000);
  });
});
