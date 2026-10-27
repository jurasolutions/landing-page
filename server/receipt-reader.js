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
 *   5b. a second look (the `finish` step): any image the first reading found
 *       no receipt in is sent once more, on its own, at effort "medium". It
 *       is free to the visitor; its worst case is reserved from the budget
 *       with the try and settled to what it cost. If the call cap refuses it
 *       or it fails, the first reading stands.
 * Nothing uploaded is stored anywhere: the images live in this request's
 * memory and go to Anthropic's API, and the result goes back to the browser.
 *
 * Responses (`error` is a code, `reason` says why; the page owns the words):
 *   200 { receipts: [{ image, is_receipt, problem, merchant, merchant_id,
 *         date, currency, subtotal, gst, total, payment_method, items,
 *         notes }], triesLeft }
 *       sorted by `image`, with every image from 1 to n there at least once.
 *       `problem` is null for a receipt, and for an image with no receipt
 *       "not_a_receipt" | "blurry" | "cut_off" | "too_dark" | "other" (or
 *       null when the model gave no reason it was allowed to give).
 *   400 { error: "bad_request" | "count" }       413 { error: "too_large" }
 *   403 { error: "bot_check" }                    415 { error: "heic" | "type" }
 *   429 { error: "limit" | "cap", triesLeft }
 *   502 { error: "unreadable", reason: "refused" | "rejected", triesLeft }
 *   503 { error: "busy", triesLeft }              Anthropic's rate limit; refunded
 *   503 { error: "unavailable", reason: "bad_output", triesLeft }   refunded
 *   503 { error: "unavailable", triesLeft? }      404 { error: "not_found" }
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
import { MAX_OUTPUT_TOKENS, MODEL, anthropicClient, costNano, reservationNano, responseText, unbilled, usageOf } from "./anthropic.js";
import {
  RECEIPT_SCHEMA,
  RECEIPT_SYSTEM_PROMPT,
  combineReadings,
  imageLabel,
  imagesWithoutReceipt,
  readModelOutput,
  readSecondLook,
  receiptInstruction,
  repairInstruction,
  secondLookInstruction,
} from "./receipts.js";

export const TOOL = "receipt-reader";
const MAX_TOKENS = MAX_OUTPUT_TOKENS;

/**
 * Each image after a text block naming its number ("Image 2"), so every
 * entry the model returns can say which image it came from. `numbers` are
 * the images' numbers in the visitor's batch.
 */
const labelled = (images, numbers) =>
  images.flatMap((image, i) => [
    { type: "text", text: imageLabel(numbers[i]) },
    { type: "image", source: { type: "base64", media_type: image.mediaType, data: bytesToBase64(image.bytes) } },
  ]);

const settings = (effort) => ({
  model: MODEL,
  // The PRD set 2000; Haiku 5.5's thinking counts towards max_tokens, and
  // three receipts with their line items can need more than 2000 on their
  // own. At Haiku prices the difference is a fraction of a cent.
  max_tokens: MAX_TOKENS,
  system: RECEIPT_SYSTEM_PROMPT,
  output_config: { effort, format: { type: "json_schema", schema: RECEIPT_SCHEMA } },
});

function request(images) {
  const numbers = images.map((_, i) => i + 1);
  return {
    ...settings("low"),
    messages: [{ role: "user", content: [...labelled(images, numbers), { type: "text", text: receiptInstruction(images.length) }] }],
  };
}

/** The second look: only the images in `numbers`, still labelled with their batch numbers. */
function secondLookRequest(images, numbers) {
  return {
    ...settings("medium"),
    messages: [
      {
        role: "user",
        content: [
          ...labelled(numbers.map((n) => images[n - 1]), numbers),
          { type: "text", text: secondLookInstruction(numbers) },
        ],
      },
    ],
  };
}

function repairRequest(problems, text) {
  return {
    ...settings("low"),
    messages: [{ role: "user", content: repairInstruction(problems, text) }],
  };
}

/**
 * The finish step: a second look at any image the first reading found no
 * receipt in. It never fails the try. Whatever goes wrong (the call cap, an
 * API error, a refusal, output that does not validate) leaves the first
 * reading as the answer.
 */
function secondLook({ env, images }) {
  const count = images.length;
  const reserve = reservationNano({ images: count });
  const done = (receipts, spent, looked) => ({
    ok: true,
    spent,
    body: { receipts },
    log: { receipts: receipts.length, second_look: looked },
  });

  const run = async (result, { countCall }) => {
    const first = result.receipts;
    const looked = imagesWithoutReceipt(first, count);
    if (looked.length === 0) return done(combineReadings(first, null, count), 0, 0);

    let spent = 0;
    let second = null;
    try {
      if (await countCall()) {
        let message;
        try {
          message = await anthropicClient(env).messages.create(secondLookRequest(images, looked));
        } catch (error) {
          // An error answer is not billed; a dropped connection may be.
          spent = unbilled(error) ? 0 : reserve;
          throw error;
        }
        spent = costNano(usageOf(message));
        if (message.stop_reason !== "refusal") {
          const read = readSecondLook(responseText(message), { looked, images: count });
          if (read.ok) second = { looked, entries: read.receipts };
        }
      }
    } catch {
      // The first reading stands.
    }
    return done(combineReadings(first, second, count), spent, looked.length);
  };

  return { reserve, costField: "second_look_nano_usd", run };
}

export async function handleReceiptRead({ request: incoming, env, registry, now }) {
  const started = Date.now();
  if (!isServedAiTool(TOOL, env, registry)) return json({ error: "not_found" }, 404);
  if (!aiReady(env, TOOL)) return json({ error: "unavailable" }, 503);

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
  const { images } = uploads;

  // 3 to 6.
  return runAiTry({
    incoming,
    env,
    now,
    started,
    tool: TOOL,
    reserve: reservationNano({ images: images.length }),
    request: request(images),
    repair: repairRequest,
    read: (text) => readModelOutput(text, { images: images.length }),
    finish: secondLook({ env, images }),
    logDefaults: { receipts: 0 },
  });
}
