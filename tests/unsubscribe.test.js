import { describe, expect, it } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { createD1 } from "./helpers/d1.js";
import { unsubscribeToken, verifyUnsubscribeToken } from "../server/unsubscribe.js";
import { onRequestGet, onRequestPost } from "../functions/unsubscribe.js";

const SECRET = "test-unsubscribe-secret-not-real";

/** The contract, written out independently with Node's own crypto. */
function referenceToken(email, secret) {
  const hash = createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
  const sig = createHmac("sha256", Buffer.from(secret, "utf8")).update(hash, "utf8").digest("base64url");
  return `${hash}.${sig}`;
}

const at = (token) => `https://jurasolutions.sg/unsubscribe?t=${encodeURIComponent(token)}`;

describe("the unsubscribe token", () => {
  it("matches the contract the growth CLI implements", async () => {
    const token = await unsubscribeToken("  Ada.Tan@Example.COM ", SECRET);
    expect(token).toBe(referenceToken("ada.tan@example.com", SECRET));
    expect(token).toMatch(/^[0-9a-f]{64}\.[A-Za-z0-9_-]{43}$/);
  });

  it("has a fixed test vector for checking other implementations", async () => {
    // secret "test-unsubscribe-secret-not-real", email "  Ada.Tan@Example.COM "
    expect(await unsubscribeToken("  Ada.Tan@Example.COM ", SECRET)).toBe(
      "276a4cb89c2b449b7444fa94ad0b36ab8b07c8172f1605dd809ba1fd7e1bb4c1.lm_oAchTzYpC45_b6R-ExhHfUM-kMyDxnIHIisNbKpo"
    );
  });

  it("verifies a genuine token and returns the hash", async () => {
    const token = referenceToken("ada@example.com", SECRET);
    expect(await verifyUnsubscribeToken(token, SECRET)).toBe(token.split(".")[0]);
  });

  it.each([
    ["the wrong secret", (t) => t, "another-secret"],
    ["a changed hash", (t) => `${"0".repeat(64)}.${t.split(".")[1]}`, SECRET],
    ["a changed signature", (t) => `${t.split(".")[0]}.${"A".repeat(43)}`, SECRET],
    ["an uppercase hash", (t) => `${t.split(".")[0].toUpperCase()}.${t.split(".")[1]}`, SECRET],
    ["padding on the signature", (t) => `${t}=`, SECRET],
    ["no dot", (t) => t.replace(".", ""), SECRET],
    ["nothing", () => "", SECRET],
  ])("refuses %s", async (_, change, secret) => {
    expect(await verifyUnsubscribeToken(change(referenceToken("ada@example.com", SECRET)), secret)).toBe(null);
  });
});

describe("GET /unsubscribe", () => {
  it("suppresses the hash and shows the confirmation", async () => {
    const DB = await createD1();
    const token = referenceToken("ada@example.com", SECRET);
    const response = await onRequestGet({ request: new Request(at(token)), env: { DB, UNSUBSCRIBE_SECRET: SECRET } });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("https://jurasolutions.sg/unsubscribed");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const rows = DB.rows("suppression");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 1,
      email_hash: token.split(".")[0],
      email: null,
      reason: "unsubscribe",
      source: "unsubscribe-link",
      resend_email_id: null,
    });
    expect(Date.parse(rows[0].created_at)).not.toBeNaN();
  });

  it("adds a row each time the link is opened, and keeps the earlier ones", async () => {
    const DB = await createD1();
    const env = { DB, UNSUBSCRIBE_SECRET: SECRET };
    const token = referenceToken("ada@example.com", SECRET);
    await onRequestGet({ request: new Request(at(token)), env });
    const first = DB.rows("suppression")[0];
    const again = await onRequestGet({ request: new Request(at(token)), env });
    expect(again.headers.get("Location")).toBe("https://jurasolutions.sg/unsubscribed");
    const rows = DB.rows("suppression");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(first);
    expect(rows[1]).toMatchObject({ id: 2, email_hash: token.split(".")[0], reason: "unsubscribe", source: "unsubscribe-link" });
  });

  it("shows the 'that link didn't work' state for a bad token and writes nothing", async () => {
    const DB = await createD1();
    const response = await onRequestGet({
      request: new Request(at(`${"a".repeat(64)}.${"b".repeat(43)}`)),
      env: { DB, UNSUBSCRIBE_SECRET: SECRET },
    });
    expect(response.headers.get("Location")).toBe("https://jurasolutions.sg/unsubscribed?status=invalid");
    expect(DB.rows("suppression")).toEqual([]);
  });

  it("never shows success when it is not configured", async () => {
    const response = await onRequestGet({ request: new Request(at(referenceToken("a@b.co", SECRET))), env: {} });
    expect(response.headers.get("Location")).toBe("https://jurasolutions.sg/unsubscribed?status=error");
  });
});

describe("POST /unsubscribe (RFC 8058 one-click)", () => {
  const post = (token) =>
    new Request(at(token), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });

  it("suppresses with source unsubscribe-post and answers 200 with no body", async () => {
    const DB = await createD1();
    const response = await onRequestPost({ request: post(referenceToken("ada@example.com", SECRET)), env: { DB, UNSUBSCRIBE_SECRET: SECRET } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(DB.rows("suppression")[0]).toMatchObject({ source: "unsubscribe-post", reason: "unsubscribe", email: null });
  });

  it("answers 400 to a bad token and writes nothing", async () => {
    const DB = await createD1();
    const response = await onRequestPost({ request: post("nonsense"), env: { DB, UNSUBSCRIBE_SECRET: SECRET } });
    expect(response.status).toBe(400);
    expect(DB.rows("suppression")).toEqual([]);
  });

  it("records both events when one-click and the link arrive for one address", async () => {
    const DB = await createD1();
    const env = { DB, UNSUBSCRIBE_SECRET: SECRET };
    const token = referenceToken("ada@example.com", SECRET);
    await onRequestPost({ request: post(token), env });
    await onRequestGet({ request: new Request(at(token)), env });
    const rows = DB.rows("suppression");
    expect(rows.map(({ id, source }) => ({ id, source }))).toEqual([
      { id: 1, source: "unsubscribe-post" },
      { id: 2, source: "unsubscribe-link" },
    ]);
    expect(new Set(rows.map((row) => row.email_hash))).toEqual(new Set([token.split(".")[0]]));
  });
});
