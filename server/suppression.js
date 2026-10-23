/**
 * The suppression list: addresses that must never be emailed again. The
 * growth CLI reads this table before every send run.
 *
 *   reason: unsubscribe | bounce | complaint | manual
 *   source: unsubscribe-link | unsubscribe-post | resend-webhook
 *
 * A row is never removed or weakened here. When the same address comes in
 * again, a stronger reason replaces a weaker one (complaint over everything;
 * bounce over unsubscribe and manual), so a complaint is always visible to the
 * CLI's auto-pause even if the person had unsubscribed first. `created_at`
 * stays the time the address was first suppressed.
 */
import { sha256Hex } from "./crypto.js";

export const normaliseEmail = (email) => String(email ?? "").trim().toLowerCase();

/** Lowercase hex SHA-256 of the trimmed, lower-cased address. */
export const emailHash = (email) => sha256Hex(normaliseEmail(email));

/** An unsubscribe knows only the hash. Re-unsubscribing changes nothing. */
export async function suppressHash(db, { hash, source, now = new Date() }) {
  await db
    .prepare(
      `INSERT INTO suppression (email_hash, email, reason, source, resend_email_id, created_at)
       VALUES (?1, NULL, 'unsubscribe', ?2, NULL, ?3)
       ON CONFLICT (email_hash) DO NOTHING`
    )
    .bind(hash, source, now.toISOString())
    .run();
}

const STRONGER = `(excluded.reason = 'complaint' AND suppression.reason <> 'complaint')
  OR (excluded.reason = 'bounce' AND suppression.reason IN ('unsubscribe', 'manual'))`;

/** A bounce or complaint from Resend knows the address itself. */
export async function suppressEmail(db, { email, reason, resendEmailId, now = new Date() }) {
  const address = normaliseEmail(email);
  await db
    .prepare(
      `INSERT INTO suppression (email_hash, email, reason, source, resend_email_id, created_at)
       VALUES (?1, ?2, ?3, 'resend-webhook', ?4, ?5)
       ON CONFLICT (email_hash) DO UPDATE SET
         email = COALESCE(suppression.email, excluded.email),
         reason = CASE WHEN ${STRONGER} THEN excluded.reason ELSE suppression.reason END,
         source = CASE WHEN ${STRONGER} THEN excluded.source ELSE suppression.source END,
         resend_email_id = CASE WHEN ${STRONGER} THEN excluded.resend_email_id
                                ELSE COALESCE(suppression.resend_email_id, excluded.resend_email_id) END`
    )
    .bind(await emailHash(address), address, reason, resendEmailId ?? null, now.toISOString())
    .run();
}
