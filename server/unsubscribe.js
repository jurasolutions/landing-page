/**
 * Unsubscribe links (scout PRD §5.5). The growth CLI makes the links and this
 * site checks them, so both sides follow the same contract:
 *
 *   email_hash = lowercase hex SHA-256 of email.trim().toLowerCase()
 *   sig        = base64url, no padding, of HMAC-SHA256(key = UNSUBSCRIBE_SECRET
 *                as UTF-8, message = email_hash as UTF-8)
 *   token      = `${email_hash}.${sig}`
 *   link       = https://jurasolutions.sg/unsubscribe?t=<token>
 *
 * The address never appears in the link, and the signature is checked with
 * Web Crypto's verify, which compares in constant time.
 *
 * GET  /unsubscribe?t=  the link in the email: suppress, then show
 *                        /unsubscribed (or /unsubscribed?status=invalid|error)
 * POST /unsubscribe?t=  RFC 8058 one-click (List-Unsubscribe-Post):
 *                        200 with no body, 400 for a bad token
 */
import { base64UrlDecode, base64UrlEncode, hmacKey, hmacSign, hmacVerify, utf8 } from "./crypto.js";
import { empty } from "./http.js";
import { emailHash, suppressHash } from "./suppression.js";

const TOKEN = /^([0-9a-f]{64})\.([A-Za-z0-9_-]{43})$/;

export async function unsubscribeToken(email, secret) {
  const hash = await emailHash(email);
  const sig = base64UrlEncode(await hmacSign(await hmacKey(utf8(secret)), hash));
  return `${hash}.${sig}`;
}

/** The email hash when the token is genuine, otherwise null. */
export async function verifyUnsubscribeToken(token, secret) {
  if (!secret || typeof token !== "string") return null;
  const match = TOKEN.exec(token);
  if (!match) return null;
  const signature = base64UrlDecode(match[2]);
  if (!signature || signature.length !== 32) return null;
  const valid = await hmacVerify(await hmacKey(utf8(secret)), signature, match[1]);
  return valid ? match[1] : null;
}

const HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

const redirect = (request, path) =>
  empty(303, { ...HEADERS, Location: new URL(path, request.url).toString() });

export async function handleUnsubscribeGet({ request, env, now }) {
  const token = new URL(request.url).searchParams.get("t");
  if (!env.UNSUBSCRIBE_SECRET || !env.DB) {
    console.error(JSON.stringify({ at: "unsubscribe", ok: false, reason: "not_configured" }));
    return redirect(request, "/unsubscribed?status=error");
  }
  const hash = await verifyUnsubscribeToken(token, env.UNSUBSCRIBE_SECRET);
  if (!hash) return redirect(request, "/unsubscribed?status=invalid");
  try {
    await suppressHash(env.DB, { hash, source: "unsubscribe-link", now });
  } catch {
    console.error(JSON.stringify({ at: "unsubscribe", ok: false, reason: "store_failed" }));
    return redirect(request, "/unsubscribed?status=error");
  }
  console.log(JSON.stringify({ at: "unsubscribe", ok: true, source: "unsubscribe-link" }));
  return redirect(request, "/unsubscribed");
}

export async function handleUnsubscribePost({ request, env, now }) {
  const token = new URL(request.url).searchParams.get("t");
  if (!env.UNSUBSCRIBE_SECRET || !env.DB) return empty(503, HEADERS);
  const hash = await verifyUnsubscribeToken(token, env.UNSUBSCRIBE_SECRET);
  if (!hash) return empty(400, HEADERS);
  try {
    await suppressHash(env.DB, { hash, source: "unsubscribe-post", now });
  } catch {
    return empty(503, HEADERS);
  }
  console.log(JSON.stringify({ at: "unsubscribe", ok: true, source: "unsubscribe-post" }));
  return empty(200, HEADERS);
}
