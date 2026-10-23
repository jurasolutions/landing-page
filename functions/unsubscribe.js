/**
 * Cloudflare Pages Function: /unsubscribe?t=<token>
 *
 *   GET   the link in an outreach email: suppress the address, then show
 *         /unsubscribed (303). A bad or tampered token shows
 *         /unsubscribed?status=invalid and writes nothing.
 *   POST  RFC 8058 one-click unsubscribe (List-Unsubscribe-Post:
 *         List-Unsubscribe=One-Click): 200 with no body, or 400.
 *
 * The token contract is in server/unsubscribe.js.
 */
import { handleUnsubscribeGet, handleUnsubscribePost } from "../server/unsubscribe.js";

export async function onRequestGet(context) {
  return handleUnsubscribeGet(context);
}

export async function onRequestPost(context) {
  return handleUnsubscribePost(context);
}
