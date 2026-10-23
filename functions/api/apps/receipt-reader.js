/**
 * Cloudflare Pages Function: POST /api/apps/receipt-reader (APP-002).
 * Turnstile, upload checks, the shared try limiter, then Claude. See
 * server/receipt-reader.js for the order and the responses.
 */
import { handleReceiptRead } from "../../../server/receipt-reader.js";

export async function onRequestPost(context) {
  return handleReceiptRead(context);
}
