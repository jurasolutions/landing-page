import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createD1 } from "./helpers/d1.js";
import { suppressEmail, suppressHash } from "../server/suppression.js";

// The query the growth engine's outreach sync runs against this table
// (repos/growth, jura_growth/suppression.py, sync_from_d1). The table is its
// D1 contract: docs/scout.md in repos/growth.
const GROWTH_SYNC = `SELECT id, email_hash, email, reason, source, resend_email_id, created_at FROM suppression
  WHERE id >= ? ORDER BY id`;

const HASH = "a".repeat(64);
const insert = (DB, hash = HASH) =>
  DB.prepare(
    `INSERT INTO suppression (email_hash, email, reason, source, resend_email_id, created_at)
     VALUES (?1, NULL, 'unsubscribe', 'unsubscribe-link', NULL, '2026-10-27T00:00:00.000Z')`
  )
    .bind(hash)
    .run();

describe("the suppression table is an append-only log", () => {
  it("gives every event its own increasing id, even for the same address", async () => {
    const DB = await createD1();
    await insert(DB);
    await insert(DB);
    await insert(DB, "b".repeat(64));
    const { results } = await DB.prepare(GROWTH_SYNC).bind(0).all();
    expect(results.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(results.map((row) => row.email_hash)).toEqual([HASH, HASH, "b".repeat(64)]);
  });

  it("never reuses an id, so the growth sync's cursor can't skip an event", async () => {
    const DB = await createD1();
    await insert(DB);
    await insert(DB);
    // AUTOINCREMENT keeps the high-water mark in sqlite_sequence.
    expect(await DB.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'suppression'").first("seq")).toBe(2);
  });

  it("refuses to update a row", async () => {
    const DB = await createD1();
    await insert(DB);
    await expect(DB.prepare("UPDATE suppression SET reason = 'complaint'").run()).rejects.toThrow(/append-only/);
    expect(DB.rows("suppression")[0].reason).toBe("unsubscribe");
  });

  it("refuses to delete a row", async () => {
    const DB = await createD1();
    await insert(DB);
    await expect(DB.prepare("DELETE FROM suppression").run()).rejects.toThrow(/append-only/);
    expect(DB.rows("suppression")).toHaveLength(1);
  });

  it("refuses an upsert that would rewrite a row", async () => {
    const DB = await createD1();
    await insert(DB);
    const replace = DB.prepare(
      `INSERT OR REPLACE INTO suppression (id, email_hash, email, reason, source, resend_email_id, created_at)
       VALUES (1, ?1, NULL, 'manual', 'unsubscribe-link', NULL, '2026-10-27T00:00:00.000Z')`
    ).bind(HASH);
    await expect(replace.run()).rejects.toThrow(/append-only/);
    expect(DB.rows("suppression")[0].reason).toBe("unsubscribe");
  });

  it("indexes email_hash without making it unique", async () => {
    const DB = await createD1();
    const index = await DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'suppression' AND name = 'suppression_email_hash'"
    ).first("sql");
    expect(index).toMatch(/CREATE INDEX suppression_email_hash ON suppression \(email_hash\)/);
    expect(index).not.toMatch(/UNIQUE/);
  });

  it("still checks the reason", async () => {
    const DB = await createD1();
    const bad = DB.prepare(
      `INSERT INTO suppression (email_hash, email, reason, source, resend_email_id, created_at)
       VALUES (?1, NULL, 'bored', 'unsubscribe-link', NULL, '2026-10-27T00:00:00.000Z')`
    ).bind(HASH);
    await expect(bad.run()).rejects.toThrow(/CHECK/);
  });
});

describe("the migration from the old one-row-per-address table", () => {
  it("copies the existing rows across, oldest first, with new ids", async () => {
    const DB = await createD1({ migrate: false });
    const dir = path.resolve(import.meta.dirname, "../migrations");
    const run = (file) => DB.exec(fs.readFileSync(path.join(dir, file), "utf8"));
    await run("0001_toolbox.sql");
    await run("0002_spend.sql");
    await DB.prepare(
      `INSERT INTO suppression (email_hash, email, reason, source, resend_email_id, created_at) VALUES
       ('${"b".repeat(64)}', 'b@example.com', 'complaint', 'resend-webhook', 'e-2', '2026-10-25T00:00:00.000Z'),
       ('${"a".repeat(64)}', NULL, 'unsubscribe', 'unsubscribe-post', NULL, '2026-10-24T00:00:00.000Z')`
    ).run();

    await run("0003_suppression_append_only.sql");

    const { results } = await DB.prepare(GROWTH_SYNC).bind(0).all();
    expect(results).toEqual([
      { id: 1, email_hash: "a".repeat(64), email: null, reason: "unsubscribe", source: "unsubscribe-post", resend_email_id: null, created_at: "2026-10-24T00:00:00.000Z" },
      { id: 2, email_hash: "b".repeat(64), email: "b@example.com", reason: "complaint", source: "resend-webhook", resend_email_id: "e-2", created_at: "2026-10-25T00:00:00.000Z" },
    ]);
    await expect(DB.prepare("DELETE FROM suppression").run()).rejects.toThrow(/append-only/);
  });
});

describe("recording suppressions", () => {
  const NOW = new Date("2026-10-27T01:00:00.000Z");

  it("adds a row for every unsubscribe, even a repeat", async () => {
    const DB = await createD1();
    await suppressHash(DB, { hash: HASH, source: "unsubscribe-link", now: NOW });
    await suppressHash(DB, { hash: HASH, source: "unsubscribe-post", now: NOW });
    expect(DB.rows("suppression")).toEqual([
      { id: 1, email_hash: HASH, email: null, reason: "unsubscribe", source: "unsubscribe-link", resend_email_id: null, created_at: NOW.toISOString() },
      { id: 2, email_hash: HASH, email: null, reason: "unsubscribe", source: "unsubscribe-post", resend_email_id: null, created_at: NOW.toISOString() },
    ]);
  });

  it("adds a row for every bounce or complaint, normalising the address", async () => {
    const DB = await createD1();
    await suppressEmail(DB, { email: " Ada@Example.COM ", reason: "bounce", resendEmailId: "e-1", now: NOW });
    await suppressEmail(DB, { email: "ada@example.com", reason: "complaint", resendEmailId: "e-2", now: NOW });
    const rows = DB.rows("suppression");
    expect(rows.map(({ id, email, reason, source, resend_email_id }) => ({ id, email, reason, source, resend_email_id }))).toEqual([
      { id: 1, email: "ada@example.com", reason: "bounce", source: "resend-webhook", resend_email_id: "e-1" },
      { id: 2, email: "ada@example.com", reason: "complaint", source: "resend-webhook", resend_email_id: "e-2" },
    ]);
    const hash = createHash("sha256").update("ada@example.com").digest("hex");
    expect(rows.map((row) => row.email_hash)).toEqual([hash, hash]);
  });
});
