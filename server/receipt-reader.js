/**
 * POST /api/apps/receipt-reader: APP-002.
 *
 * multipart/form-data with `token` (Turnstile) and up to 3 `files` (JPG, PNG
 * or WEBP; the browser has already resized them and rendered any PDF's
 * first page to JPG).
 *
 * The order is fixed (app factory PRD §5.4, APP-002 §5.3):
 *   1. verify Turnstile
 *   2. check the files' number, size and real type
 *   3–6. the try, Claude, validation with one repair, the response
 *        (server/ai-run.js, shared by every AI tool)
 * Nothing uploaded is stored anywhere: the images live in this request's
 * memory and go to Anthropic's API, and the result goes back to the browser.
 *
 * Responses (`error` is a code; the page owns the words):
 *   200 { receipts, triesLeft }
 *   400 { error: "bad_request" | "count" }       413 { error: "too_large" }
 *   403 { error: "bot_check" }                    415 { error: "heic" | "type" }
 *   429 { error: "limit" | "cap", triesLeft }      502 { error: "unreadable" }
 *   503 { error: "unavailable" }                  404 { error: "not_found" }
 * 404 means the tool is still `draft` in the registry and AI_ALLOW_DRAFTS=1
 * is not set (server/drafts.js); it is answered before anything else.
 */
import { json } from "./http.js";
import { MAX_BODY_BYTES, checkUploads } from "./images.js";
import { verifyTurnstile } from "./turnstile.js";
import { clientIp } from "./visitor.js";
import { bytesToBase64 } from "./crypto.js";
import { aiReady, isServedAiTool } from "./ai-tool.js";
import { runAiTry } from "./ai-run.js";
import { MAX_OUTPUT_TOKENS, MODEL, reservationNano } from "./anthropic.js";
import {
  RECEIPT_SCHEMA,
  RECEIPT_SYSTEM_PROMPT,
  readModelOutput,
  receiptInstruction,
  repairInstruction,
} from "./receipts.js";

export const TOOL = "receipt-reader";
const MAX_TOKENS = MAX_OUTPUT_TOKENS;

function request(images) {
  return {
    model: MODEL,
    // The PRD set 2000; Haiku 5.5's thinking counts towards max_tokens, and
    // three receipts with their line items can need more than 2000 on their
    // own. At Haiku prices the difference is a fraction of a cent.
    max_tokens: MAX_TOKENS,
    system: RECEIPT_SYSTEM_PROMPT,
    output_config: { effort: "low", format: { type: "json_schema", schema: RECEIPT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          ...images.map((image) => ({
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: bytesToBase64(image.bytes) },
          })),
          { type: "text", text: receiptInstruction(images.length) },
        ],
      },
    ],
  };
}

function repairRequest(problems, text) {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: RECEIPT_SYSTEM_PROMPT,
    output_config: { effort: "low", format: { type: "json_schema", schema: RECEIPT_SCHEMA } },
    messages: [{ role: "user", content: repairInstruction(problems, text) }],
  };
}

export async function handleReceiptRead({ request: incoming, env, registry, now }) {
  const started = Date.now();
  if (!isServedAiTool(TOOL, env, registry)) return json({ error: "not_found" }, 404);
  if (!aiReady(env)) return json({ error: "unavailable" }, 503);

  const declared = Number(incoming.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);

  let form;
  try {
    form = await incoming.formData();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  // 1. Turnstile.
  const human = await verifyTurnstile({
    secret: env.TURNSTILE_SECRET,
    token: form.get("token"),
    ip: clientIp(incoming),
    url: env.TURNSTILE_VERIFY_URL || undefined,
  });
  if (!human.ok) return json({ error: "bot_check" }, 403);

  // 2. Size and type, before the counter or the API.
  const uploads = await checkUploads(form.getAll("files"));
  if (!uploads.ok) return json({ error: uploads.error }, uploads.status);

  // 3 to 6.
  return runAiTry({
    incoming,
    env,
    now,
    started,
    tool: TOOL,
    reserve: reservationNano({ images: uploads.images.length }),
    request: request(uploads.images),
    repair: repairRequest,
    read: readModelOutput,
    respond: (result) => ({ body: { receipts: result.receipts }, log: { receipts: result.receipts.length } }),
    logDefaults: { receipts: 0 },
  });
}
