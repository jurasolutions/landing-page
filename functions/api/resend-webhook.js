/**
 * Cloudflare Pages Function: /api/resend-webhook
 *
 *   POST  Resend webhook (Svix-signed). email.bounced and email.complained
 *         add each recipient to the D1 suppression list.
 *   GET   health check: { endpoint, ok, canVerify, canStore }.
 *
 * Details in server/resend-webhook.js.
 */
import { handleResendWebhook, handleResendWebhookHealth } from "../../server/resend-webhook.js";

export async function onRequestPost(context) {
  return handleResendWebhook(context);
}

export async function onRequestGet(context) {
  return handleResendWebhookHealth(context);
}
