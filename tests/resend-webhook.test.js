import { describe, expect, it } from "vitest";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createD1 } from "./helpers/d1.js";
import { onRequestGet, onRequestPost } from "../functions/api/resend-webhook.js";
import { verifySvix } from "../server/resend-webhook.js";
import { onRequestGet as unsubscribe } from "../functions/unsubscribe.js";

const KEY = randomBytes(24);
const SECRET = `whsec_${KEY.toString("base64")}`;
const NOW = Date.parse("2026-10-24T03:00:00Z");

/** Signs like Svix does, independently of the code under test. */
function sign(body, { id = "msg_2abc", timestamp = Math.floor(NOW / 1000), key = KEY } = {}) {
  const sig = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": String(timestamp), "svix-signature": `v1,${sig}` };
}

// Shaped like Resend's documented examples.
const bounced = (to = ["Bounce.Me@Example.com"]) =>
  JSON.stringify({
    type: "email.bounced",
    created_at: "2026-10-24T02:59:58.000Z",
    data: {
      created_at: "2026-10-24T02:59:57.000Z",
      email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
      from: "Ting Yu <hello@jurasolutions.sg>",
      to,
      subject: "A free quote builder for Example",
      bounce: { message: "Mailbox does not exist", subType: "General", type: "Permanent" },
    },
  });

const complained = (to = ["angry@example.com"]) =>
  JSON.stringify({
    type: "email.complained",
    created_at: "2026-10-24T02:59:58.000Z",
    data: { email_id: "e-123", from: "Ting Yu <hello@jurasolutions.sg>", to, subject: "Hi" },
  });

const post = (body, headers) =>
  new Request("https://jurasolutions.sg/api/resend-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });

async function env() {
  return { DB: await createD1(), RESEND_WEBHOOK_SECRET: SECRET };
}

const sha = (email) => createHash("sha256").update(email).digest("hex");

describe("Svix signature checks", () => {
  it("accepts a correct signature", async () => {
    const body = bounced();
    const h = sign(body);
    expect(await verifySvix({ id: h["svix-id"], timestamp: h["svix-timestamp"], signature: h["svix-signature"], body, secret: SECRET, now: NOW })).toBe(true);
  });

  it("accepts any matching entry among several, and ignores other versions", async () => {
    const body = bounced();
    const h = sign(body);
    const signature = `v2,${"x".repeat(44)} v1,${Buffer.alloc(32).toString("base64")} ${h["svix-signature"]}`;
    expect(await verifySvix({ id: h["svix-id"], timestamp: h["svix-timestamp"], signature, body, secret: SECRET, now: NOW })).toBe(true);
  });

  it.each([
    ["a changed body", (b) => b.replace("Bounce.Me", "someone.else"), {}],
    ["another secret", (b) => b, { key: randomBytes(24) }],
    ["a timestamp 6 minutes old", (b) => b, { timestamp: Math.floor(NOW / 1000) - 360 }],
    ["a timestamp 6 minutes ahead", (b) => b, { timestamp: Math.floor(NOW / 1000) + 360 }],
  ])("refuses %s", async (_, change, options) => {
    const body = bounced();
    const h = sign(body, options);
    expect(
      await verifySvix({ id: h["svix-id"], timestamp: h["svix-timestamp"], signature: h["svix-signature"], body: change(body), secret: SECRET, now: NOW })
    ).toBe(false);
  });

  it("allows up to 5 minutes of clock difference", async () => {
    const body = bounced();
    const h = sign(body, { timestamp: Math.floor(NOW / 1000) - 299 });
    expect(await verifySvix({ id: h["svix-id"], timestamp: h["svix-timestamp"], signature: h["svix-signature"], body, secret: SECRET, now: NOW })).toBe(true);
  });

  it("refuses missing headers", async () => {
    expect(await verifySvix({ id: null, timestamp: "1", signature: "v1,x", body: "{}", secret: SECRET, now: NOW })).toBe(false);
  });
});

describe("POST /api/resend-webhook", () => {
  it("suppresses every recipient of a bounce", async () => {
    const e = await env();
    const body = bounced(["Bounce.Me@Example.com", "second@example.com"]);
    const response = await onRequestPost({ request: post(body, sign(body)), env: e, now: NOW });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, suppressed: 2 });
    const rows = e.DB.rows("suppression");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: 1,
      email_hash: sha("bounce.me@example.com"),
      email: "bounce.me@example.com",
      reason: "bounce",
      source: "resend-webhook",
      resend_email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
      created_at: "2026-10-24T03:00:00.000Z",
    });
  });

  it("records a complaint", async () => {
    const e = await env();
    const body = complained();
    await onRequestPost({ request: post(body, sign(body)), env: e, now: NOW });
    expect(e.DB.rows("suppression")[0]).toMatchObject({ email: "angry@example.com", reason: "complaint", resend_email_id: "e-123" });
  });

  it("returns 200 and stores nothing for other event types", async () => {
    const e = await env();
    const body = JSON.stringify({ type: "email.delivered", data: { to: ["fine@example.com"], email_id: "x" } });
    const response = await onRequestPost({ request: post(body, sign(body)), env: e, now: NOW });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: "email.delivered" });
    expect(e.DB.rows("suppression")).toEqual([]);
  });

  it("refuses a bad signature with 401 and stores nothing", async () => {
    const e = await env();
    const body = bounced();
    const response = await onRequestPost({ request: post(body, sign(body, { key: randomBytes(24) })), env: e, now: NOW });
    expect(response.status).toBe(401);
    expect(e.DB.rows("suppression")).toEqual([]);
  });

  it("answers 503 when not configured, so Resend retries later", async () => {
    const body = bounced();
    expect((await onRequestPost({ request: post(body, sign(body)), env: { DB: await createD1() }, now: NOW })).status).toBe(503);
    expect((await onRequestPost({ request: post(body, sign(body)), env: { RESEND_WEBHOOK_SECRET: SECRET }, now: NOW })).status).toBe(503);
  });

  it("adds a row each time Resend delivers an event, and keeps the earlier ones", async () => {
    const e = await env();
    const body = bounced();
    const headers = sign(body);
    await onRequestPost({ request: post(body, headers), env: e, now: NOW });
    await onRequestPost({ request: post(body, headers), env: e, now: NOW + 60_000 });
    const rows = e.DB.rows("suppression");
    expect(rows.map(({ id, reason, created_at }) => ({ id, reason, created_at }))).toEqual([
      { id: 1, reason: "bounce", created_at: "2026-10-24T03:00:00.000Z" },
      { id: 2, reason: "bounce", created_at: "2026-10-24T03:01:00.000Z" },
    ]);
  });

  it("keeps every event for an address, so a complaint after an unsubscribe is never lost", async () => {
    const e = await env();
    e.UNSUBSCRIBE_SECRET = "s";
    const hash = sha("angry@example.com");
    const sig = createHmac("sha256", Buffer.from("s")).update(hash).digest("base64url");
    await unsubscribe({ request: new Request(`https://jurasolutions.sg/unsubscribe?t=${hash}.${sig}`), env: e });
    const complaint = complained();
    await onRequestPost({ request: post(complaint, sign(complaint)), env: e, now: NOW });
    const bounce = bounced(["angry@example.com"]);
    await onRequestPost({ request: post(bounce, sign(bounce)), env: e, now: NOW });

    const rows = e.DB.rows("suppression");
    expect(rows.map(({ id, email_hash, email, reason, source, resend_email_id }) => ({ id, email_hash, email, reason, source, resend_email_id }))).toEqual([
      { id: 1, email_hash: hash, email: null, reason: "unsubscribe", source: "unsubscribe-link", resend_email_id: null },
      { id: 2, email_hash: hash, email: "angry@example.com", reason: "complaint", source: "resend-webhook", resend_email_id: "e-123" },
      { id: 3, email_hash: hash, email: "angry@example.com", reason: "bounce", source: "resend-webhook", resend_email_id: "56761188-7520-42d8-8898-ff6fc54ce618" },
    ]);
  });

  it("logs the event type and count only, never an address", async () => {
    const e = await env();
    const logs = [];
    const original = console.log;
    console.log = (...args) => logs.push(args.join(" "));
    try {
      const body = bounced(["private.person@example.com"]);
      await onRequestPost({ request: post(body, sign(body)), env: e, now: NOW });
    } finally {
      console.log = original;
    }
    expect(logs.join("\n")).not.toContain("private.person");
    expect(logs.join("\n")).toContain('"type":"email.bounced"');
  });
});

describe("GET /api/resend-webhook", () => {
  it("is a health check", async () => {
    const response = await onRequestGet({ env: { RESEND_WEBHOOK_SECRET: SECRET } });
    expect(await response.json()).toEqual({ endpoint: "resend-webhook", ok: true, canVerify: true, canStore: false });
  });
});
