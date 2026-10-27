/**
 * The suppression list: addresses that must never be emailed again. The
 * growth CLI syncs this table before every send run.
 *
 *   reason: unsubscribe | bounce | complaint | manual
 *   source: unsubscribe-link | unsubscribe-post | resend-webhook
 *
 * The table is an append-only log, one row per event
 * (migrations/0003_suppression_append_only.sql). Every unsubscribe, bounce
 * and complaint is a plain insert, even for an address already in the table,
 * and rows are never updated or deleted. The growth sync reads the rows after
 * the last id it processed and acts on each one, so a complaint that follows
 * an unsubscribe still pauses outreach. Any row for a hash means the address
 * is suppressed; when it has several, the strongest reason wins (complaint,
 * then bounce, then unsubscribe and manual).
 */
import { sha256Hex } from "./crypto.js";

export const normaliseEmail = (email) => String(email ?? "").trim().toLowerCase();

/** Lowercase hex SHA-256 of the trimmed, lower-cased address. */
export const emailHash = (email) => sha256Hex(normaliseEmail(email));

const INSERT = `INSERT INTO suppression (email_hash, email, reason, source, resend_email_id, created_at)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6)`;

/** An unsubscribe knows only the hash. */
export async function suppressHash(db, { hash, source, now = new Date() }) {
  await db.prepare(INSERT).bind(hash, null, "unsubscribe", source, null, now.toISOString()).run();
}

/** A bounce or complaint from Resend knows the address itself. */
export async function suppressEmail(db, { email, reason, resendEmailId, now = new Date() }) {
  const address = normaliseEmail(email);
  await db
    .prepare(INSERT)
    .bind(await emailHash(address), address, reason, "resend-webhook", resendEmailId ?? null, now.toISOString())
    .run();
}
