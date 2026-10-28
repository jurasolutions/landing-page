/**
 * The access code: a code Ting Yu hands to the right people and prospects so
 * they can try the AI tools without the daily limit (PRD: toolbox access code,
 * 2026-10-28).
 *
 * - The code is never in the repository, which is public. The source holds a
 *   SHA-256 hash of it. The code is random, 16 characters from a 32-character
 *   alphabet (80 bits), so the hash cannot be worked back to the code.
 * - Setting the Pages secret AI_PROMO_CODE_SHA256 to the hash of a new code
 *   replaces this one, and every browser that holds the old code stops being
 *   unlimited at once. To make a hash: printf '%s' CODE | shasum -a 256
 * - A right code earns a cookie, `jura_promo`, holding a keyed hash of the
 *   secret visitor salt and the code's hash. It can't be made without the salt,
 *   and it stops working if the salt or the code changes. It is sent with the
 *   tools' own requests only (Path=/api/apps), like `jura_vid`.
 * - What it gives: `unlimited` in the visitor context, the same as a network
 *   in AI_UNLIMITED_NETWORKS. No try is counted for the visitor or their IP.
 *   The site's daily budget and call cap still hold for everyone.
 * - Guessing: 10 wrong codes a day per connection, counted in app_tries under
 *   the reserved key '#promo' (so no migration), then 429 until midnight SGT.
 */
import { json, readText, sgtDay } from "./http.js";
import { sha256Hex } from "./crypto.js";
import { hashIp } from "./visitor.js";
import { takeFrom } from "./limit.js";

export const DEFAULT_PROMO_HASH = "582c8f796968190bdcc7b53f9a29fa4a7d7cbd51d9249aacae1d28a907f66c3e";

export const PROMO_COOKIE = "jura_promo";
const MAX_AGE = 60 * 60 * 24 * 90;
const WRONG_GUESSES_PER_DAY = 10;
const GUESS_KEY = "#promo";
const HEX64 = /^[0-9a-f]{64}$/;

/** Upper case, letters and digits only, so "abcd-efgh 1234" reads as ABCDEFGH1234. */
export const normaliseCode = (input) => String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** The hash the code is checked against: the Pages secret if it is a SHA-256 hash, else the built-in one. */
const codeHash = (env) => (HEX64.test(String(env.AI_PROMO_CODE_SHA256 ?? "").trim().toLowerCase())
  ? String(env.AI_PROMO_CODE_SHA256).trim().toLowerCase()
  : DEFAULT_PROMO_HASH);

/** What the cookie holds for this deployment and this code. */
const tokenFor = (env) => sha256Hex(`${env.VISITOR_SALT}|promo|${codeHash(env)}`);

/** Same length in, same time out: strings of equal length are compared whole. */
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readPromoCookie(request) {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === PROMO_COOKIE) return rest.join("=");
  }
  return "";
}

/** True when the request carries a promo cookie made for this deployment's current code. */
export async function hasPromo(request, env) {
  const held = readPromoCookie(request);
  if (!HEX64.test(held) || !env.VISITOR_SALT) return false;
  return sameText(held, await tokenFor(env));
}

const promoCookie = (token) =>
  `${PROMO_COOKIE}=${token}; Path=/api/apps; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;

/**
 * POST /api/apps/promo with `{ code }`.
 *
 *   200 { ok: true }              right code; Set-Cookie: jura_promo
 *   400 { error: "bad_request" }  not JSON, or the code is not text
 *   401 { error: "wrong_code" }
 *   413 { error: "too_large" }
 *   429 { error: "too_many" }     10 wrong codes today from this connection
 *   503 { error: "not_configured" }  no D1 binding or visitor salt
 */
export async function handlePromo({ request, env, now }) {
  const body = await readText(request, 256);
  if (body.tooLarge) return json({ error: "too_large" }, 413);

  let payload;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (typeof payload?.code !== "string") return json({ error: "bad_request" }, 400);
  if (!env.DB || !env.VISITOR_SALT) return json({ error: "not_configured" }, 503);

  // Every attempt is counted before it is checked, so a right code after ten
  // wrong ones is still refused.
  try {
    const attempt = await takeFrom(env.DB, {
      day: sgtDay(now),
      hash: await hashIp(request, env.VISITOR_SALT),
      key: GUESS_KEY,
      limit: WRONG_GUESSES_PER_DAY,
    });
    if (attempt == null) return json({ error: "too_many" }, 429);
  } catch (error) {
    console.error(JSON.stringify({ at: "promo", ok: false, error: String(error?.name ?? "error") }));
    return json({ error: "not_configured" }, 503);
  }

  const code = normaliseCode(payload.code);
  const right = code !== "" && sameText(await sha256Hex(code), codeHash(env));
  if (!right) return json({ error: "wrong_code" }, 401);

  return json({ ok: true }, 200, { "Set-Cookie": promoCookie(await tokenFor(env)) });
}
