/**
 * Who is asking, for the AI try limit, without storing who they are.
 *
 * Identity is a salted SHA-256 of the connecting IP and a random first-party
 * cookie id (app factory PRD §5.4). Only the hash reaches D1. The cookie is
 * HttpOnly, scoped to /api/apps, and holds nothing but a random id.
 *
 * A visitor whose browser refuses the cookie still gets a stable identity:
 * every cookie-less request from one IP shares one bucket, so refusing
 * cookies is not a way round the limit.
 */
import { sha256Hex } from "./crypto.js";

export const VISITOR_COOKIE = "jura_vid";
const ID = /^[A-Za-z0-9-]{16,64}$/;
const YEAR = 60 * 60 * 24 * 365;

export function readVisitorId(request) {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === VISITOR_COOKIE) {
      const value = rest.join("=");
      return ID.test(value) ? value : null;
    }
  }
  return null;
}

export function visitorCookie(id) {
  return `${VISITOR_COOKIE}=${id}; Path=/api/apps; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax`;
}

export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

/**
 * Returns { hash, setCookie }. `setCookie` is a Set-Cookie value when this
 * request had no cookie and one should be issued (the hash already uses it,
 * so the next request lands in the same bucket only if the browser keeps
 * it; if it does not, the cookie-less bucket applies from then on).
 */
export async function identifyVisitor(request, salt, { issue = true } = {}) {
  const existing = readVisitorId(request);
  if (existing) {
    return { hash: await sha256Hex(`${salt}|${clientIp(request)}|${existing}`), setCookie: null };
  }
  // No cookie yet: count this request in the cookie-less bucket for the IP,
  // and offer a cookie for next time.
  const hash = await sha256Hex(`${salt}|${clientIp(request)}|no-cookie`);
  return { hash, setCookie: issue ? visitorCookie(crypto.randomUUID()) : null };
}
