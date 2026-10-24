import { describe, expect, it, vi } from "vitest";
import { createD1 } from "./helpers/d1.js";
import { ENV, RECEIPT, apiError, cookieFrom, fakeHeic, fakeJpeg, fakePng, installNetwork, limitRequest, message, receiptRequest } from "./helpers/ai.js";
import { onRequestPost as readReceipts } from "../functions/api/apps/receipt-reader.js";
import { onRequestGet as getLimit } from "../functions/api/apps/limit.js";
import { limitConfig, takeTry } from "../server/limit.js";

const good = () => message(JSON.stringify({ receipts: [RECEIPT] }));
const refusal = () => message("", { stop: "refusal" });

async function setup(extra = {}) {
  const DB = await createD1();
  return { DB, env: { ...ENV, DB, ...extra } };
}

/** The visitor's own counts (IP and cookie), leaving out the per-IP rows. */
const tries = (DB) => DB.rows("app_tries").filter((r) => !r.tool.startsWith("#ip")).map((r) => r.count);

const counts = (DB) => ({
  tries: tries(DB),
  calls: DB.rows("app_calls").map((r) => r.count),
});

describe("GET /api/apps/limit", () => {
  it("gives a new visitor 2 tries and a cookie", async () => {
    const { env } = await setup();
    const response = await getLimit({ request: limitRequest(), env });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ triesLeft: 2, triesPerDay: 2, capReached: false, ready: true });
    const cookie = response.headers.get("Set-Cookie");
    expect(cookie).toMatch(/^jura_vid=[A-Za-z0-9-]{16,64}; Path=\/api\/apps; Max-Age=\d+; HttpOnly; Secure; SameSite=Lax$/);
  });

  it("says when the AI tools are not configured", async () => {
    const response = await getLimit({ request: limitRequest(), env: {} });
    expect(await response.json()).toMatchObject({ ready: false, triesLeft: 0 });
  });

  it("refuses a slug that is not an AI tool", async () => {
    const { env } = await setup();
    expect((await getLimit({ request: limitRequest({ tool: "quote-builder" }), env })).status).toBe(400);
    expect((await getLimit({ request: limitRequest({ tool: "nope" }), env })).status).toBe(400);
  });
});

describe("the try limit", () => {
  it("refuses the third try in a day without calling the API", async () => {
    const { DB, env } = await setup();
    const net = installNetwork({ anthropic: [good(), good()] });
    const cookie = cookieFrom(await getLimit({ request: limitRequest(), env }));

    const first = await readReceipts({ request: receiptRequest({ cookie }), env });
    expect(first.status).toBe(200);
    expect((await first.json()).triesLeft).toBe(1);
    const second = await readReceipts({ request: receiptRequest({ cookie }), env });
    expect((await second.json()).triesLeft).toBe(0);

    const third = await readReceipts({ request: receiptRequest({ cookie }), env });
    expect(third.status).toBe(429);
    expect(await third.json()).toEqual({ error: "limit", triesLeft: 0 });
    expect(net.anthropic).toHaveLength(2);
    expect(counts(DB)).toEqual({ tries: [2], calls: [2] });

    const left = await getLimit({ request: limitRequest({ cookie }), env });
    expect(await left.json()).toMatchObject({ triesLeft: 0, capReached: false });
  });

  it("resets on the next SGT day", async () => {
    const { env } = await setup();
    installNetwork({ anthropic: [good(), good(), good()] });
    const before = Date.parse("2026-10-24T15:59:00Z"); // 23:59 in Singapore
    const after = Date.parse("2026-10-24T16:01:00Z"); // 00:01 the next day
    for (let i = 0; i < 2; i += 1) {
      expect((await readReceipts({ request: receiptRequest(), env, now: before })).status).toBe(200);
    }
    expect((await readReceipts({ request: receiptRequest(), env, now: before })).status).toBe(429);
    expect((await readReceipts({ request: receiptRequest(), env, now: after })).status).toBe(200);
  });

  it("holds against a burst of clicks: exactly 2 of 5 at once get through", async () => {
    const { DB, env } = await setup();
    const net = installNetwork({ anthropic: [good(), good(), good(), good(), good()] });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => readReceipts({ request: receiptRequest(), env }).then((r) => r.status))
    );
    expect(results.filter((s) => s === 200)).toHaveLength(2);
    expect(results.filter((s) => s === 429)).toHaveLength(3);
    expect(net.anthropic).toHaveLength(2);
    expect(counts(DB).tries).toEqual([2]);
  });

  it("puts cookie-less requests from one IP in one bucket", async () => {
    const { env } = await setup();
    installNetwork({ anthropic: [good(), good()] });
    expect((await readReceipts({ request: receiptRequest(), env })).status).toBe(200);
    expect((await readReceipts({ request: receiptRequest(), env })).status).toBe(200);
    expect((await readReceipts({ request: receiptRequest(), env })).status).toBe(429);
    // Another visitor on another IP is unaffected.
    installNetwork({ anthropic: [good()] });
    expect((await readReceipts({ request: receiptRequest({ ip: "198.51.100.7" }), env })).status).toBe(200);
  });

  it("is shared across AI tools by default, and per tool when configured", async () => {
    expect(limitConfig({})).toEqual({ triesPerDay: 2, triesPerIp: 6, siteCap: 200, scope: "all" });
    expect(
      limitConfig({ AI_TRIES_PER_DAY: "5", AI_TRIES_PER_IP: "10", AI_SITE_CAP: "50", AI_LIMIT_SCOPE: "per-tool" })
    ).toEqual({
      triesPerDay: 5,
      triesPerIp: 10,
      siteCap: 50,
      scope: "per-tool",
    });

    const { DB, env } = await setup({ AI_LIMIT_SCOPE: "per-tool" });
    installNetwork({ anthropic: [good()] });
    await readReceipts({ request: receiptRequest(), env });
    expect(DB.rows("app_tries").map((r) => r.tool).sort()).toEqual(["#ip:receipt-reader", "receipt-reader"]);

    const shared = await setup();
    installNetwork({ anthropic: [good()] });
    await readReceipts({ request: receiptRequest(), env: shared.env });
    expect(shared.DB.rows("app_tries").map((r) => r.tool).sort()).toEqual(["#ip", "*"]);
  });
});

describe("the per-IP ceiling", () => {
  it("stops fresh cookies from one IP at 6 calls a day", async () => {
    const { DB, env } = await setup();
    const net = installNetwork({ anthropic: Array.from({ length: 12 }, good) });
    const statuses = [];
    for (let v = 0; v < 4; v += 1) {
      const cookie = `jura_vid=${crypto.randomUUID()}`;
      for (let i = 0; i < 3; i += 1) statuses.push((await readReceipts({ request: receiptRequest({ cookie }), env })).status);
    }
    expect(statuses.filter((s) => s === 200)).toHaveLength(6);
    expect(net.anthropic).toHaveLength(6);
    expect(counts(DB).calls).toEqual([6]);

    const fresh = `jura_vid=${crypto.randomUUID()}`;
    const refused = await readReceipts({ request: receiptRequest({ cookie: fresh }), env });
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "limit", triesLeft: 0 });
    const left = await getLimit({ request: limitRequest({ cookie: fresh }), env });
    expect(await left.json()).toMatchObject({ triesLeft: 0, capReached: false });

    // Another IP is unaffected.
    installNetwork({ anthropic: [good()] });
    expect((await readReceipts({ request: receiptRequest({ ip: "198.51.100.7" }), env })).status).toBe(200);
  });

  it("stores the IP only as a salted hash", async () => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: [good()] });
    await readReceipts({ request: receiptRequest({ ip: "203.0.113.77" }), env });
    const stored = JSON.stringify(DB.rows("app_tries"));
    expect(stored).not.toContain("203.0.113.77");
    expect(DB.rows("app_tries").map((r) => r.tool).sort()).toEqual(["#ip", "*"]);
  });

  it("is configurable with AI_TRIES_PER_IP and gives its try back on a refund", async () => {
    const { DB, env } = await setup({ AI_TRIES_PER_IP: "1" });
    installNetwork({ anthropic: ["network", good()] });
    const first = await readReceipts({ request: receiptRequest({ cookie: `jura_vid=${crypto.randomUUID()}` }), env });
    expect(first.status).toBe(503);
    const second = await readReceipts({ request: receiptRequest({ cookie: `jura_vid=${crypto.randomUUID()}` }), env });
    expect(second.status).toBe(200);
    const third = await readReceipts({ request: receiptRequest({ cookie: `jura_vid=${crypto.randomUUID()}` }), env });
    expect(third.status).toBe(429);
    expect(DB.rows("app_tries").find((r) => r.tool === "#ip").count).toBe(1);
  });
});

describe("the site-wide cap", () => {
  it("holds at a test cap of 3", async () => {
    const { DB, env } = await setup({ AI_SITE_CAP: "3" });
    const net = installNetwork({ anthropic: [good(), good(), good()] });
    for (const ip of ["192.0.2.1", "192.0.2.2", "192.0.2.3"]) {
      expect((await readReceipts({ request: receiptRequest({ ip }), env })).status).toBe(200);
    }
    const fourth = await readReceipts({ request: receiptRequest({ ip: "192.0.2.4" }), env });
    expect(fourth.status).toBe(429);
    expect(await fourth.json()).toEqual({ error: "cap", triesLeft: 0 });
    expect(net.anthropic).toHaveLength(3);
    expect(counts(DB).calls).toEqual([3]);
    // The refused visitor keeps their own tries (and their IP's) for when the cap resets.
    expect(DB.rows("app_tries").filter((r) => r.count > 0)).toHaveLength(6);
    expect(tries(DB).filter((n) => n > 0)).toHaveLength(3);

    const someoneNew = await getLimit({ request: limitRequest({ ip: "192.0.2.9" }), env });
    expect(await someoneNew.json()).toMatchObject({ triesLeft: 2, capReached: true });
  });

  it("holds at a test cap of 3 when the model refuses: five refusals make at most 3 API calls", async () => {
    const { DB, env } = await setup({ AI_SITE_CAP: "3" });
    const net = installNetwork({ anthropic: Array.from({ length: 5 }, refusal) });
    for (const ip of ["192.0.2.1", "192.0.2.2", "192.0.2.3", "192.0.2.4", "192.0.2.5"]) {
      await readReceipts({ request: receiptRequest({ ip }), env });
    }
    expect(net.anthropic.length).toBeLessThanOrEqual(3);
    expect(counts(DB).calls).toEqual([3]);
  });

  it("counts a refusal as a used try: it comes from what was uploaded", async () => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: [refusal()] });
    const response = await readReceipts({ request: receiptRequest(), env });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "unreadable", triesLeft: 1 });
    expect(tries(DB)).toEqual([1]);
  });

  it("counts the repair call against the cap", async () => {
    const { DB, env } = await setup({ AI_SITE_CAP: "3" });
    const net = installNetwork({ anthropic: [message("not json"), good(), good()] });
    expect((await readReceipts({ request: receiptRequest({ ip: "192.0.2.1" }), env })).status).toBe(200);
    expect(counts(DB).calls).toEqual([2]);
    expect((await readReceipts({ request: receiptRequest({ ip: "192.0.2.2" }), env })).status).toBe(200);
    expect(counts(DB).calls).toEqual([3]);
    const third = await readReceipts({ request: receiptRequest({ ip: "192.0.2.3" }), env });
    expect(third.status).toBe(429);
    expect(net.anthropic).toHaveLength(3);
  });

  it("skips the repair when the cap is reached, gives the try back and answers unavailable", async () => {
    const { DB, env } = await setup({ AI_SITE_CAP: "1" });
    const net = installNetwork({ anthropic: [message("not json")] });
    const response = await readReceipts({ request: receiptRequest(), env });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable", triesLeft: 2 });
    expect(net.anthropic).toHaveLength(1);
    expect(counts(DB).calls).toEqual([1]);
    expect(tries(DB)).toEqual([0]);
  });

  it("never retries a failed call behind the counter's back", async () => {
    const { env } = await setup();
    const net = installNetwork({ anthropic: ["network", good()] });
    await readReceipts({ request: receiptRequest(), env });
    expect(net.anthropic).toHaveLength(1);
  });

  it("closes for the day when the API reports a billing problem, and refunds the try", async () => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: [apiError(402, "billing_error", "Spend limit reached")] });
    const response = await readReceipts({ request: receiptRequest(), env });
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("cap");
    expect(counts(DB)).toEqual({ tries: [0], calls: [200] });

    const net = installNetwork({ anthropic: [] });
    const next = await readReceipts({ request: receiptRequest({ ip: "198.51.100.2" }), env });
    expect(next.status).toBe(429);
    expect(net.anthropic).toHaveLength(0);
  });

  it("shows the used-up message on a rate limit without closing the day", async () => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: [apiError(429, "rate_limit_error")] });
    const response = await readReceipts({ request: receiptRequest(), env });
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("cap");
    expect(counts(DB)).toEqual({ tries: [0], calls: [1] });
  });
});

describe("refunds", () => {
  it.each([
    ["overloaded", apiError(529, "overloaded_error")],
    ["server error", apiError(500, "api_error")],
    ["bad key", apiError(401, "authentication_error")],
    ["dropped connection", "network"],
  ])("give the try back when the API fails (%s)", async (_, answer) => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: [answer] });
    const response = await readReceipts({ request: receiptRequest(), env });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable", triesLeft: 2 });
    expect(counts(DB)).toEqual({ tries: [0], calls: [1] });
    expect(DB.rows("app_tries").find((r) => r.tool === "#ip").count).toBe(0);
  });

  it("give the try back when the output cannot be repaired", async () => {
    const { DB, env } = await setup();
    const net = installNetwork({ anthropic: [message("not json"), message("still not json")] });
    const response = await readReceipts({ request: receiptRequest(), env });
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("unreadable");
    expect(net.anthropic).toHaveLength(2);
    expect(counts(DB)).toEqual({ tries: [0], calls: [2] });
  });
});

describe("unexpected failures", () => {
  it("answer 503 unavailable when D1 is bound but the tables are missing", async () => {
    const DB = await createD1({ migrate: false });
    const net = installNetwork({ anthropic: [good()] });
    const response = await readReceipts({ request: receiptRequest(), env: { ...ENV, DB } });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("unavailable");
    expect(net.anthropic).toHaveLength(0);
  });

  it("give the try back when something throws after it was taken", async () => {
    const { DB, env } = await setup();
    installNetwork({ anthropic: [good()] });
    // The model answered, but responding fails: an unexpected throw.
    vi.spyOn(console, "log").mockImplementationOnce(() => {
      throw new Error("log sink down");
    });
    const response = await readReceipts({ request: receiptRequest(), env });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable", triesLeft: 2 });
    expect(tries(DB)).toEqual([0]);
    expect(counts(DB).calls).toEqual([1]);
  });
});

describe("checks before the counter", () => {
  it("refuses a 5 MB upload before the counter or the API", async () => {
    const { DB, env } = await setup();
    const net = installNetwork({ anthropic: [] });
    const response = await readReceipts({ request: receiptRequest({ files: [fakeJpeg(5 * 1024 * 1024)] }), env });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "too_large" });
    expect(net.anthropic).toHaveLength(0);
    expect(DB.rows("app_tries")).toEqual([]);
    expect(DB.rows("app_calls")).toEqual([]);
  });

  it("refuses a body that declares itself too big without reading it", async () => {
    const { env } = await setup();
    const net = installNetwork({ anthropic: [] });
    const response = await readReceipts({
      request: receiptRequest({ headers: { "Content-Length": String(20 * 1024 * 1024) } }),
      env,
    });
    expect(response.status).toBe(413);
    expect(net.turnstile).toHaveLength(0);
  });

  it("accepts exactly 4 MB", async () => {
    const { env } = await setup();
    installNetwork({ anthropic: [good()] });
    const response = await readReceipts({ request: receiptRequest({ files: [fakeJpeg(4 * 1024 * 1024)] }), env });
    expect(response.status).toBe(200);
  });

  it.each([
    ["HEIC", [fakeHeic()], 415, "heic"],
    ["a text file", [new TextEncoder().encode("hello, this is not an image at all")], 415, "type"],
    ["no files", [], 400, "count"],
    ["four files", [fakeJpeg(), fakeJpeg(), fakeJpeg(), fakeJpeg()], 400, "count"],
  ])("refuses %s", async (_, files, status, error) => {
    const { DB, env } = await setup();
    const net = installNetwork({ anthropic: [] });
    const response = await readReceipts({ request: receiptRequest({ files }), env });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
    expect(net.anthropic).toHaveLength(0);
    expect(DB.rows("app_tries")).toEqual([]);
  });

  it("accepts PNG and up to three files in one try", async () => {
    const { DB, env } = await setup();
    const net = installNetwork({ anthropic: [message(JSON.stringify({ receipts: [RECEIPT, RECEIPT, RECEIPT] }))] });
    const response = await readReceipts({ request: receiptRequest({ files: [fakeJpeg(), fakePng(), fakeJpeg()] }), env });
    expect(response.status).toBe(200);
    expect((await response.json()).receipts).toHaveLength(3);
    const images = net.anthropic[0].body.messages[0].content.filter((b) => b.type === "image");
    expect(images.map((b) => b.source.media_type)).toEqual(["image/jpeg", "image/png", "image/jpeg"]);
    expect(counts(DB).tries).toEqual([1]);
  });

  it("refuses a failed Turnstile check before the counter or the API", async () => {
    const { DB, env } = await setup();
    const net = installNetwork({ turnstile: false, anthropic: [] });
    const response = await readReceipts({ request: receiptRequest(), env });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "bot_check" });
    expect(net.turnstile).toHaveLength(1);
    expect(net.anthropic).toHaveLength(0);
    expect(DB.rows("app_tries")).toEqual([]);
  });

  it("refuses a request with no Turnstile token without calling Turnstile", async () => {
    const { env } = await setup();
    const net = installNetwork({ anthropic: [] });
    const response = await readReceipts({ request: receiptRequest({ token: null }), env });
    expect(response.status).toBe(403);
    expect(net.turnstile).toHaveLength(0);
  });

  it("answers 503 before anything else when not configured", async () => {
    const net = installNetwork({ anthropic: [] });
    for (const missing of ["DB", "ANTHROPIC_API_KEY", "TURNSTILE_SECRET", "VISITOR_SALT"]) {
      const { env } = await setup();
      delete env[missing];
      const response = await readReceipts({ request: receiptRequest(), env });
      expect(response.status, missing).toBe(503);
    }
    expect(net.turnstile).toHaveLength(0);
  });
});

describe("takeTry on its own", () => {
  it("never stores a count above the limit", async () => {
    const { DB } = await createD1().then((DB) => ({ DB }));
    const config = { triesPerDay: 2, triesPerIp: 6, siteCap: 200, scope: "all" };
    const args = { day: "2026-10-24", visitorHash: "h", ipHash: "i", key: "*", config };
    expect(await takeTry(DB, args)).toEqual({ ok: true, triesLeft: 1 });
    expect(await takeTry(DB, args)).toEqual({ ok: true, triesLeft: 0 });
    expect(await takeTry(DB, args)).toEqual({ ok: false, reason: "limit" });
    expect(await takeTry(DB, args)).toEqual({ ok: false, reason: "limit" });
    expect(DB.rows("app_tries")).toEqual([
      { day: "2026-10-24", visitor_hash: "h", tool: "*", count: 2 },
      { day: "2026-10-24", visitor_hash: "i", tool: "#ip", count: 2 },
    ]);
    expect(DB.rows("app_calls")).toEqual([{ day: "2026-10-24", count: 2 }]);
  });

  it("never stores an IP count above the ceiling", async () => {
    const DB = await createD1();
    const config = { triesPerDay: 2, triesPerIp: 3, siteCap: 200, scope: "all" };
    const as = (visitorHash) => ({ day: "2026-10-24", visitorHash, ipHash: "i", key: "*", config });
    expect(await takeTry(DB, as("a"))).toEqual({ ok: true, triesLeft: 1 });
    expect(await takeTry(DB, as("a"))).toEqual({ ok: true, triesLeft: 0 });
    expect(await takeTry(DB, as("b"))).toEqual({ ok: true, triesLeft: 0 }); // the IP's last one
    expect(await takeTry(DB, as("b"))).toEqual({ ok: false, reason: "limit" });
    expect(DB.rows("app_tries").map((r) => [r.visitor_hash, r.count])).toEqual([
      ["a", 2],
      ["i", 3],
      ["b", 1],
    ]);
    expect(DB.rows("app_calls")).toEqual([{ day: "2026-10-24", count: 3 }]);
  });

  it("refuses everything when the limit is set to 0", async () => {
    const DB = await createD1();
    const config = { triesPerDay: 0, triesPerIp: 6, siteCap: 200, scope: "all" };
    const args = { day: "d", visitorHash: "h", ipHash: "i", key: "*", config };
    expect(await takeTry(DB, args)).toEqual({ ok: false, reason: "limit" });
    expect(await takeTry(DB, { ...args, config: { ...config, triesPerDay: 2, triesPerIp: 0 } })).toEqual({
      ok: false,
      reason: "limit",
    });
  });
});
