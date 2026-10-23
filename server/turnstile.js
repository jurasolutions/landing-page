/**
 * Cloudflare Turnstile server-side check. Fails closed: no secret, no token,
 * an unreachable endpoint or a slow answer all count as "not verified".
 *
 * TURNSTILE_VERIFY_URL exists only so a local `wrangler pages dev` run can
 * point at a stand-in. Leave it unset on Cloudflare Pages.
 */
export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile({ secret, token, ip, url = SITEVERIFY_URL }) {
  if (!secret || typeof token !== "string" || !token || token.length > 2048) {
    return { ok: false, codes: ["missing-input"] };
  }
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip && ip !== "unknown") body.append("remoteip", ip);

  try {
    const response = await fetch(url, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { ok: false, codes: [`http-${response.status}`] };
    const result = await response.json();
    return { ok: result.success === true, codes: result["error-codes"] ?? [] };
  } catch {
    return { ok: false, codes: ["unreachable"] };
  }
}
