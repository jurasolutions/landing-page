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
 * The part of an address that identifies one connection's owner. An IPv4
 * address is used whole. An IPv6 address is cut to its /64: a home or office
 * is usually given a whole /64 and can pick any address in it, so counting
 * full addresses would hand out fresh tries for the asking. An IPv6 address
 * with an IPv4 address inside (::ffff:192.0.2.1) counts as that IPv4 address.
 */
export function networkOf(ip) {
  if (!ip.includes(":")) return ip;
  const address = ip.split("%")[0].toLowerCase();
  const v4 = address.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) return v4[1];
  const [head, tail, extra] = address.split("::");
  if (extra !== undefined) return ip;
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups =
    tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  if (groups.length !== 8 || !groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return ip;
  return `${groups
    .slice(0, 4)
    .map((group) => Number.parseInt(group, 16).toString(16))
    .join(":")}::/64`;
}

/**
 * True when the connection comes from one of the networks in `list`
 * (AI_UNLIMITED_NETWORKS: addresses separated by commas or spaces), matched
 * the way the per-IP ceiling counts them: an IPv4 address whole, an IPv6
 * address by its /64. Those networks try the AI tools without a count.
 */
export function isUnlimitedNetwork(request, list) {
  const ip = clientIp(request);
  if (!list || ip === "unknown") return false;
  const networks = String(list).split(/[\s,]+/).filter(Boolean).map(networkOf);
  return networks.includes(networkOf(ip));
}

/**
 * A salted SHA-256 of the connecting IP alone (its /64 for IPv6), for the
 * per-IP ceiling (AI_TRIES_PER_IP), so clearing cookies is not a way round
 * the limit. The "ip" segment keeps it from ever equalling an IP-and-cookie
 * hash.
 */
export function hashIp(request, salt) {
  return sha256Hex(`${salt}|ip|${networkOf(clientIp(request))}`);
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
