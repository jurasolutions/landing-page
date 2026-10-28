/**
 * Cloudflare Pages Function: POST /api/apps/promo
 * Checks an access code and, if it is right, sets the cookie that lifts the
 * daily AI try limit for that browser. See server/promo.js.
 */
import { handlePromo } from "../../../server/promo.js";

export async function onRequestPost(context) {
  return handlePromo(context);
}
