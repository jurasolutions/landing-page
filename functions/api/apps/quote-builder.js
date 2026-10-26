/**
 * Cloudflare Pages Function: POST /api/apps/quote-builder (APP-001a).
 * Turnstile, a size check, the shared try limiter, then Claude drafts the
 * quote. See server/quote-drafter.js for the order and the responses.
 */
import { handleQuoteDraft } from "../../../server/quote-drafter.js";

export async function onRequestPost(context) {
  return handleQuoteDraft(context);
}
