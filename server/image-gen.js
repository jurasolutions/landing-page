/**
 * The pictures for APP-004 Product photo studio: one Cloudflare Workers AI
 * call through the `AI` binding per picture, its price, and what an error
 * means.
 *
 * Each call sends Claude's edit prompt, which has passed the server's check
 * (server/photo-studio.js), with the brand-safe suffix appended here, the
 * picture's size, and the visitor's product photos as reference images
 * (`input_image_0` to `input_image_3`, at most 512 px on the long edge), so
 * the model keeps each product as it is and changes only what is around it
 * (docs/adr/0002).
 */

export const KLEIN_4B = "@cf/black-forest-labs/flux-2-klein-4b";
export const KLEIN_9B = "@cf/black-forest-labs/flux-2-klein-9b";

/**
 * The default is 4B: the account is on the Workers free plan, where 10,000
 * neurons a day is about 56 4B pictures (18 tries) against about 6 9B ones. Set
 * AI_IMAGE_MODEL to the 9B id after moving to Workers Paid.
 */
export const DEFAULT_IMAGE_MODEL = KLEIN_4B;

/** What the model draws; the browser composes it to 1080 x 1350 or 1080 x 1080. */
export const PICTURE = { width: 1024, height: 1280 };

/** Positive phrasing only: FLUX has no negative prompt, so "no text" would invite text. */
export const BRAND_SAFE_SUFFIX =
  " Keep each product exactly as it appears in its reference image, with its own shape, colours and label. Photorealistic commercial product photography with soft, even, flattering light; plain unmarked props and surfaces; nobody in the frame.";

const tiles = (width, height) => Math.ceil(width / 512) * Math.ceil(height / 512);
const pixels = (refs) => refs.reduce((sum, ref) => sum + ref.width * ref.height, 0);

/**
 * Workers AI list prices in nano-dollars, checked on 2026-10-27 at
 * https://developers.cloudflare.com/workers-ai/platform/pricing/
 * Workers AI reports no usage, so a picture is settled at the list price for
 * its size and its reference images. Change these if Cloudflare's prices
 * change.
 *   klein 4B: US$0.000287 per 512 x 512 output tile and US$0.000059 per
 *             512 x 512 input tile, tiles counted as ceil(w / 512) x
 *             ceil(h / 512): 1024 x 1280 is 6 output tiles, and a reference
 *             of at most 512 px is one input tile.
 *   klein 9B: US$0.015 for the first output megapixel and US$0.002 a further
 *             one, plus US$0.002 an input megapixel. US$0.002 a megapixel is
 *             2 nano-dollars a pixel, so every amount is a whole number.
 * A model that is not here has no price, so the tool is not ready with it
 * (server/ai-tool.js) and an unpriced model is never called.
 */
const PRICES = {
  [KLEIN_4B]: ({ width, height }, refs) =>
    tiles(width, height) * 287_000 + refs.reduce((sum, ref) => sum + tiles(ref.width, ref.height) * 59_000, 0),
  [KLEIN_9B]: ({ width, height }, refs) => 15_000_000 + 2 * Math.max(0, width * height - 1_000_000) + 2 * pixels(refs),
};

/** Each klein model falls back to the other. */
const FALLBACK = { [KLEIN_4B]: KLEIN_9B, [KLEIN_9B]: KLEIN_4B };

/** refs: [{ width, height }], the reference images sent with the picture. */
export function imagePriceNano(model, refs = [], size = PICTURE) {
  const price = PRICES[model];
  return price ? price(size, refs) : null;
}

/** What one picture reserves: the dearer of the model and its fallback. */
export function pictureReserveNano(model, refs = []) {
  return Math.max(imagePriceNano(model, refs) ?? 0, imagePriceNano(FALLBACK[model], refs) ?? 0);
}

/** The model AI_IMAGE_MODEL names, or the default. */
export const imageModel = (env) => env.AI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;

/** A Workers AI binding, and a model this file can price. */
export const imageReady = (env) => typeof env.AI?.run === "function" && imagePriceNano(imageModel(env)) !== null;

/**
 * What kind of failure a Workers AI error is:
 *   "cap"          the account's daily allocation is used up (code 4006 on
 *                  the free plan): close this tool until 00:00 UTC
 *   "unavailable"  anything else, such as 3043 "Internal server error" or a
 *                  timeout: worth another attempt
 * The binding throws plain Errors. The code counts only as the error's `code`
 * or as the message's leading code ("AiError: 4006: ..."), never as a number
 * anywhere in it: a request id such as 1b4e28ba-2fa1-4006-... must not close
 * the tool for the day.
 */
export function classifyImageError(error) {
  const message = String(error?.message ?? error ?? "");
  if (Number(error?.code) === 4006 || /^(?:AiError:\s*)*4006\b/.test(message)) return "cap";
  if (/daily free allocation|neurons|upgrade to Cloudflare's Workers Paid/i.test(message)) return "cap";
  return "unavailable";
}

/**
 * Attempts per picture: three on the configured model, with a short wait
 * between them (one 4B or 9B call in a few failed with 3043 in testing, each
 * in under a second), then one on the other klein model. A timed-out attempt
 * may still be drawn and billed, so a timeout ends the picture and keeps its
 * price: retrying after one would risk paying twice and keep the visitor
 * waiting minutes.
 */
export const TIMING = {
  backoffMs: [300, 900],
  timeoutMs: { [KLEIN_4B]: 60_000, [KLEIN_9B]: 30_000 },
};

const TIMED_OUT = Symbol("timed out");

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The multipart body Workers AI's FLUX.2 models take: prompt, size, references. */
function multipart(prompt, refs) {
  const form = new FormData();
  form.append("prompt", prompt + BRAND_SAFE_SUFFIX);
  form.append("width", String(PICTURE.width));
  form.append("height", String(PICTURE.height));
  refs.forEach((ref, i) => form.append(`input_image_${i}`, new Blob([ref.bytes], { type: "image/jpeg" }), `ref-${i}.jpg`));
  const body = new Response(form);
  return { body: body.body, contentType: body.headers.get("content-type") };
}

/**
 * Draws one picture. `job` is { prompt, refs: [{ bytes, width, height }] }.
 * Resolves, never rejects, to
 *   { ok: true, image: <base64 JPEG>, model, costNano }   or
 *   { ok: false, kind: "cap" | "unavailable", costNano }
 * where costNano is what to settle: the picture's price when drawn, plus the
 * price of an attempt that timed out. An error answer is not billed.
 * `timing` and `sleep` exist for the tests.
 */
export async function drawPicture(env, { prompt, refs }, { timing = TIMING, sleep = wait } = {}) {
  const model = imageModel(env);
  const backoff = timing.backoffMs ?? TIMING.backoffMs;
  const attempts = [model, model, model, FALLBACK[model]];
  let kind = "unavailable";
  for (const [i, attempt] of attempts.entries()) {
    if (i > 0 && attempt === model) await sleep(backoff[i - 1] ?? 0);
    let answer;
    try {
      answer = await withTimeout(
        env.AI.run(attempt, { multipart: multipart(prompt, refs) }),
        timing.timeoutMs?.[attempt] ?? TIMING.timeoutMs[attempt]
      );
    } catch (error) {
      kind = classifyImageError(error);
      if (kind === "cap") break;
      continue;
    }
    if (answer === TIMED_OUT) return { ok: false, kind: "unavailable", costNano: imagePriceNano(attempt, refs) };
    if (typeof answer?.image === "string" && answer.image.length > 0) {
      return { ok: true, image: answer.image, model: attempt, costNano: imagePriceNano(attempt, refs) };
    }
    kind = "unavailable";
  }
  return { ok: false, kind, costNano: 0 };
}
