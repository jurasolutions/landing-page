import { describe, expect, it } from "vitest";
import { createD1 } from "./helpers/d1.js";
import { ENV, RECEIPT, cookieFrom, installNetwork, limitRequest, message, receiptRequest } from "./helpers/ai.js";
import { onRequestPost as postPromo } from "../functions/api/apps/promo.js";
import { onRequestPost as readReceipts } from "../functions/api/apps/receipt-reader.js";
import { onRequestGet as getLimit } from "../functions/api/apps/limit.js";
import { DEFAULT_PROMO_HASH, normaliseCode } from "../server/promo.js";
import { sha256Hex } from "../server/crypto.js";

// A code made up for these tests. The real one is never in the repository.
const CODE = "TESTCODE23456789";
const IP = "203.0.113.50";
const good = () => message(JSON.stringify({ receipts: [RECEIPT] }));

async function setup(extra = {}) {
  const DB = await createD1();
  const env = { ...ENV, DB, AI_PROMO_CODE_SHA256: await sha256Hex(CODE), ...extra };
  return { DB, env };
}

const promoRequest = (body, { ip = IP, raw } = {}) =>
  new Request("https://jurasolutions.sg/api/apps/promo", {
    method: "POST",
    body: raw ?? JSON.stringify(body),
    headers: { "CF-Connecting-IP": ip, "Content-Type": "application/json" },
  });

const enter = (env, code, options) => postPromo({ request: promoRequest({ code }, options), env });

describe("POST /api/apps/promo", () => {
  it("accepts the right code and sets a cookie that lasts 90 days", async () => {
    const { env } = await setup();
    const response = await enter(env, CODE);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("Set-Cookie")).toMatch(
      /^jura_promo=[0-9a-f]{64}; Path=\/api\/apps; Max-Age=7776000; HttpOnly; Secure; SameSite=Lax$/
    );
  });

  it("reads the code however it was typed: lower case, spaces, dashes", async () => {
    expect(normaliseCode(" test-code 2345 6789 ")).toBe(CODE);
    const { env } = await setup();
    expect((await enter(env, "test-code-2345-6789")).status).toBe(200);
    expect((await enter(env, "  TESTCODE23456789  ")).status).toBe(200);
  });

  it("refuses a wrong code and sets nothing", async () => {
    const { env } = await setup();
    const response = await enter(env, "TESTCODE23456788");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "wrong_code" });
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("refuses a code that is empty, not text, or not JSON", async () => {
    const { env } = await setup();
    expect((await enter(env, "")).status).toBe(401);
    expect((await enter(env, 12345)).status).toBe(400);
    expect((await postPromo({ request: promoRequest(null, { raw: "{nope" }), env })).status).toBe(400);
    expect((await postPromo({ request: promoRequest({ code: "x".repeat(500) }), env })).status).toBe(413);
  });

  it("stops a connection after 10 wrong guesses in a day, even if the next one is right", async () => {
    const { env } = await setup();
    for (let i = 0; i < 10; i++) expect((await enter(env, `WRONGCODE${i}`)).status).toBe(401);
    const blocked = await enter(env, CODE);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "too_many" });
    expect(blocked.headers.get("Set-Cookie")).toBeNull();
    // Another connection is not held up by it.
    expect((await enter(env, CODE, { ip: "203.0.113.51" })).status).toBe(200);
  });

  it("says so when it is not set up, rather than failing quietly", async () => {
    const { env } = await setup();
    const { DB, ...noDb } = env;
    expect((await enter(noDb, CODE)).status).toBe(503);
    expect((await enter({ ...env, VISITOR_SALT: undefined }, CODE)).status).toBe(503);
  });

  it("has a built-in code hash, and an override that must be a SHA-256 hash to count", async () => {
    expect(DEFAULT_PROMO_HASH).toMatch(/^[0-9a-f]{64}$/);
    // A malformed override is ignored, so a typo in the secret cannot open the door to the empty code.
    const { env } = await setup({ AI_PROMO_CODE_SHA256: "not-a-hash" });
    expect((await enter(env, CODE)).status).toBe(401);
    expect((await enter(env, "")).status).toBe(401);
  });
});

describe("what a code holder gets", () => {
  const cookieFor = async (env) => cookieFrom(await enter(env, CODE));

  it("shows unlimited on the limit endpoint, and only to them", async () => {
    const { env } = await setup();
    const cookie = await cookieFor(env);
    const holder = await (await getLimit({ request: limitRequest({ ip: IP, cookie }), env })).json();
    expect(holder).toEqual({ triesLeft: 2, triesPerDay: 2, capReached: false, ready: true, unlimited: true });
    const stranger = await (await getLimit({ request: limitRequest({ ip: IP }), env })).json();
    expect(stranger).toEqual({ triesLeft: 2, triesPerDay: 2, capReached: false, ready: true });
  });

  it("tries without a count, past the daily limit", async () => {
    const { DB, env } = await setup();
    const cookie = await cookieFor(env);
    const net = installNetwork({ anthropic: [good(), good(), good(), good()] });
    for (let i = 0; i < 4; i++) {
      const response = await readReceipts({ request: receiptRequest({ ip: IP, cookie }), env });
      expect(response.status).toBe(200);
    }
    expect(net.anthropic).toHaveLength(4);
    expect(DB.rows("app_tries").filter((r) => !r.tool.startsWith("#"))).toEqual([]);
  });

  it("still keeps to the site's budget", async () => {
    const { env } = await setup({ AI_SITE_CAP: "1" });
    const cookie = await cookieFor(env);
    installNetwork({ anthropic: [good(), good()] });
    const ask = () => readReceipts({ request: receiptRequest({ ip: IP, cookie }), env });
    expect((await ask()).status).toBe(200);
    const second = await ask();
    expect(second.status).toBe(429);
    expect(await second.json()).toEqual({ error: "cap", triesLeft: 0 });
  });

  it("works from another connection, because the cookie is the key, not the address", async () => {
    const { env } = await setup();
    const cookie = await cookieFor(env);
    const left = await (await getLimit({ request: limitRequest({ ip: "198.51.100.99", cookie }), env })).json();
    expect(left.unlimited).toBe(true);
  });

  it("does not work with a made-up cookie, one from another salt, or after the code changes", async () => {
    const { env } = await setup();
    const real = (await cookieFor(env)).split("=")[1];
    const asks = async (cookie, withEnv = env) =>
      (await (await getLimit({ request: limitRequest({ ip: IP, cookie }), env: withEnv })).json()).unlimited;

    expect(await asks(`jura_promo=${real}`)).toBe(true);
    expect(await asks(`jura_promo=${"a".repeat(64)}`)).toBeUndefined();
    expect(await asks(`jura_promo=${real.slice(0, 63)}`)).toBeUndefined();
    expect(await asks("jura_promo=")).toBeUndefined();
    expect(await asks(`jura_promo=${real}`, { ...env, VISITOR_SALT: "another-salt" })).toBeUndefined();
    // The code was rotated: every browser holding the old one stops being unlimited.
    expect(await asks(`jura_promo=${real}`, { ...env, AI_PROMO_CODE_SHA256: await sha256Hex("NEWCODE234567890") })).toBeUndefined();
  });

  it("works alongside the visitor cookie", async () => {
    const { env } = await setup();
    const promo = await cookieFor(env);
    const left = await (
      await getLimit({ request: limitRequest({ ip: IP, cookie: `jura_vid=abcdefgh-1234-5678-abcd; ${promo}` }), env })
    ).json();
    expect(left.unlimited).toBe(true);
  });
});
