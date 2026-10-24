/**
 * Cloudflare Pages Function: POST /api/apps/usage
 *
 * Counts an anonymous open or completion for a toolbox tool. The browser
 * fires and forgets, so every failure here is silent to the visitor.
 *
 *   204  counted
 *   400  unknown or draft slug (see server/drafts.js), unknown event, or not JSON
 *   413  body over 1 KB
 *   503  D1 not bound (DB) or the write failed
 */
import { handleUsage } from "../../../server/usage.js";

export async function onRequestPost(context) {
  return handleUsage(context);
}
