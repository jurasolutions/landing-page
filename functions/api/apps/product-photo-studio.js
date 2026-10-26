/**
 * Cloudflare Pages Function: POST /api/apps/product-photo-studio (APP-004).
 * Input checks, Turnstile, the shared try limiter, Claude, then three
 * pictures from Workers AI. See server/product-photo-studio.js for the order
 * and the responses.
 */
import { handlePhotoStudio } from "../../../server/product-photo-studio.js";

export async function onRequestPost(context) {
  return handlePhotoStudio(context);
}
