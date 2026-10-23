/**
 * Cloudflare Pages Function: GET /api/apps/limit?tool=<slug>
 * Free AI tries left today for this visitor. See server/limit-endpoint.js.
 */
import { handleLimit } from "../../../server/limit-endpoint.js";

export async function onRequestGet(context) {
  return handleLimit(context);
}
