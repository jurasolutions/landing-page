/**
 * POST /api/resend-webhook (scout PRD §5.5).
 *
 * Resend signs webhooks with Svix. Checked against Resend's and Svix's docs
 * on 2026-10-24:
 * - headers `svix-id`, `svix-timestamp` (Unix seconds), `svix-signature`
 * - signed content `${svix-id}.${svix-timestamp}.${raw body}`, HMAC-SHA256
 * - the key is the base64 part of RESEND_WEBHOOK_SECRET after `whsec_`
 * - `svix-signature` is a space-separated list of `v1,<base64>` entries;
 *   any one matching is enough. Compared in constant time (Web Crypto verify).
 * - timestamps more than 5 minutes from now are refused (replay protection)
 *
 * Events, per Resend's docs: `email.bounced` (the recipient's server
 * permanently rejected the email) and `email.complained` (marked as spam).
 * Both carry `data.to` (a list of addresses) and `data.email_id`. Each
 * recipient is added to the suppression list. Other event types get a 200 and
 * are ignored. Every delivery is a new row in the append-only suppression
 * log, so a retry after a partial failure records the event twice; the growth
 * sync acts on repeats harmlessly (server/suppression.js).
 *
 * GET is a health check: { endpoint, ok, canVerify, canStore }.
 */
import { base64ToBytes, hmacKey, hmacVerify } from "./crypto.js";
import { json, readText } from "./http.js";
import { suppressEmail } from "./suppression.js";

export const TOLERANCE_SECONDS = 5 * 60;
const MAX_BODY = 256 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REASONS = { "email.bounced": "bounce", "email.complained": "complaint" };

function secretBytes(secret) {
  const encoded = String(secret ?? "").startsWith("whsec_") ? secret.slice(6) : String(secret ?? "");
  try {
    const bytes = base64ToBytes(encoded);
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

/** True when the request really came from Resend and is fresh. */
export async function verifySvix({ id, timestamp, signature, body, secret, now = Date.now() }) {
  if (!id || !timestamp || !signature || typeof body !== "string") return false;
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  const keyBytes = secretBytes(secret);
  if (!keyBytes) return false;
  const key = await hmacKey(keyBytes);
  const content = `${id}.${timestamp}.${body}`;

  for (const entry of signature.split(" ")) {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) continue;
    let bytes;
    try {
      bytes = base64ToBytes(value);
    } catch {
      continue;
    }
    if (bytes.length === 32 && (await hmacVerify(key, bytes, content))) return true;
  }
  return false;
}

export async function handleResendWebhook({ request, env, now }) {
  if (!env.RESEND_WEBHOOK_SECRET) return json({ error: "not_configured" }, 503);
  if (!env.DB) return json({ error: "not_configured" }, 503);

  const read = await readText(request, MAX_BODY);
  if (read.tooLarge) return json({ error: "too_large" }, 413);

  const verified = await verifySvix({
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body: read.text,
    secret: env.RESEND_WEBHOOK_SECRET,
    now,
  });
  if (!verified) return json({ error: "bad_signature" }, 401);

  let event;
  try {
    event = JSON.parse(read.text);
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const reason = REASONS[event?.type];
  if (!reason) return json({ ok: true, ignored: String(event?.type ?? "unknown").slice(0, 60) });

  const to = Array.isArray(event.data?.to) ? event.data.to : [event.data?.to];
  const addresses = to.filter((value) => typeof value === "string" && EMAIL.test(value.trim()));
  const emailId = typeof event.data?.email_id === "string" ? event.data.email_id.slice(0, 100) : null;

  try {
    for (const email of addresses) {
      await suppressEmail(env.DB, { email, reason, resendEmailId: emailId, now: now ? new Date(now) : new Date() });
    }
  } catch {
    console.error(JSON.stringify({ at: "resend-webhook", ok: false, type: event.type }));
    // A 5xx makes Svix retry later, which is what we want if D1 hiccups.
    return json({ error: "store_failed" }, 503);
  }

  console.log(JSON.stringify({ at: "resend-webhook", ok: true, type: event.type, suppressed: addresses.length }));
  return json({ ok: true, suppressed: addresses.length });
}

export function handleResendWebhookHealth({ env }) {
  return json({
    endpoint: "resend-webhook",
    ok: true,
    canVerify: Boolean(env.RESEND_WEBHOOK_SECRET),
    canStore: Boolean(env.DB),
  });
}

