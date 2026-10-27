/**
 * POST /api/apps/product-photo-studio: APP-004 Product photo studio.
 *
 * multipart/form-data with `token` (Turnstile), 1 to 4 `files` (the product
 * photos, JPG, PNG or WEBP, which the browser has resized to 1600 px for
 * Claude), the same number of `refs` (the same photos as JPEGs of at most
 * 512 px, in the same order, for the image model), and optional `name` (80
 * characters) and `instruction` (500).
 *
 * The order is fixed:
 *   1. the tool is served and ready (its Workers AI binding included)
 *   2. the request's size, fields, photos and references, then whether the
 *      tool is closed until 00:00 UTC after a Workers AI quota error
 *      (server/limit.js closeToolForToday): 429 cap, before any try
 *   3. Turnstile
 *   4–6. the try with Claude's and three pictures' worst case reserved,
 *        Claude, validation with one repair (server/ai-run.js), then three
 *        pictures in parallel, each settled at its real price
 * Nothing is stored: the photos live in this request's memory and go to
 * Anthropic's API and to Workers AI, and the result goes back to the browser.
 *
 * Responses (`error` is a code; the page owns the words):
 *   200 { products: [{ name, description }],
 *         posts: [{ look, caption, hashtags: ["#..."], alt, image?: <base64 JPEG> }] (3),
 *         triesLeft }                 a post whose picture failed has no `image`
 *   422 { error: "no_product", triesLeft }   no photo shows a product; the try is used
 *   400 { error: "bad_request" | "count" }   413 { error: "too_large" }
 *   403 { error: "bot_check" }               415 { error: "heic" | "type" }
 *   429 { error: "limit" | "cap", triesLeft }
 *   502 { error: "unreadable", reason: "refused" | "rejected", triesLeft }
 *   503 { error: "busy", triesLeft }         Anthropic's rate limit; the try comes back
 *   503 { error: "unavailable", reason?: "bad_output", triesLeft? }
 *   (server/ai-run.js has what each one means)
 *   404 { error: "not_found" }  the tool is a draft and AI_ALLOW_DRAFTS=1 is not set
 */
import { json } from "./http.js";
import { MAX_FILE_BYTES, MAX_REF_BYTES, checkRefs, checkUploads } from "./images.js";
import { verifyTurnstile } from "./turnstile.js";
import { clientIp } from "./visitor.js";
import { bytesToBase64 } from "./crypto.js";
import { aiReady, isServedAiTool, logCall, reply, visitorContext } from "./ai-tool.js";
import { runAiTry } from "./ai-run.js";
import { closeToolForToday, remaining, toolClosed } from "./limit.js";
import { MAX_OUTPUT_TOKENS, MODEL, reservationNano } from "./anthropic.js";
import { drawPicture, imageModel, pictureReserveNano } from "./image-gen.js";
import {
  MAX_INSTRUCTION_CHARS,
  MAX_NAME_CHARS,
  MAX_PHOTOS,
  POSTS,
  STUDIO_SCHEMA,
  STUDIO_SYSTEM_PROMPT,
  readStudioOutput,
  studioInstruction,
  studioRepairInstruction,
} from "./photo-studio.js";

export const TOOL = "product-photo-studio";
const MAX_BODY_BYTES = MAX_PHOTOS * (MAX_FILE_BYTES + MAX_REF_BYTES) + 256 * 1024;

const settings = {
  model: MODEL,
  max_tokens: MAX_OUTPUT_TOKENS,
  system: STUDIO_SYSTEM_PROMPT,
  output_config: { effort: "low", format: { type: "json_schema", schema: STUDIO_SCHEMA } },
};

function request(images, fields) {
  return {
    ...settings,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((image) => ({
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: bytesToBase64(image.bytes) },
          })),
          { type: "text", text: studioInstruction({ photos: images.length, ...fields }) },
        ],
      },
    ],
  };
}

const repairRequest = (problems, text) => ({ ...settings, messages: [{ role: "user", content: studioRepairInstruction(problems, text) }] });

/** An optional text field: "" when absent, null when it is not text or too long. */
function textField(form, key, max) {
  const value = form.get(key);
  if (value === null) return "";
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > max ? null : trimmed;
}

/**
 * The step after Claude: three pictures in parallel. `drawPicture` never
 * rejects; if something else does, that picture's reservation is kept, since
 * it may have been drawn.
 */
function drawPosts({ env, refs, timing, now }) {
  const perPicture = pictureReserveNano(imageModel(env), refs);
  return async (result) => {
    if (result.noProduct) {
      return { ok: true, spent: 0, status: 422, body: { error: "no_product" }, log: { reason: "no_product" } };
    }
    const settled = await Promise.allSettled(
      result.posts.map((post) => drawPicture(env, { prompt: post.editPrompt, refs }, timing ? { timing } : {}))
    );
    const pictures = settled.map((s) => (s.status === "fulfilled" ? s.value : { ok: false, kind: "unavailable", costNano: perPicture }));
    const spent = pictures.reduce((sum, picture) => sum + picture.costNano, 0);
    const drawn = pictures.filter((picture) => picture.ok).length;
    const cap = pictures.some((picture) => !picture.ok && picture.kind === "cap");
    if (cap) {
      // The allocation is used up: close this tool, and only this one, so the
      // next visitor is told before anyone pays for a Claude call.
      try {
        await closeToolForToday(env.DB, { tool: TOOL, now });
      } catch {
        // The next try meets the same error and tries again.
      }
    }

    if (drawn === 0) {
      return { ok: false, spent, kind: cap ? "cap" : "unavailable", reason: cap ? "image_cap" : "image_unavailable" };
    }
    return {
      ok: true,
      spent,
      body: {
        products: result.products,
        posts: result.posts.map((post, i) => ({
          look: post.look,
          caption: post.caption,
          hashtags: post.hashtags,
          alt: post.alt,
          ...(pictures[i].ok ? { image: pictures[i].image } : {}),
        })),
      },
      log: { products: result.products.length, pictures: drawn },
    };
  };
}

export async function handlePhotoStudio({ request: incoming, env, registry, now, imageTiming }) {
  const started = Date.now();
  // 1. Served and ready.
  if (!isServedAiTool(TOOL, env, registry)) return json({ error: "not_found" }, 404);
  if (!aiReady(env, TOOL)) return json({ error: "unavailable" }, 503);

  // 2. The request, before Turnstile (which spends the token), the counter or the API.
  const declared = Number(incoming.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
  let form;
  try {
    form = await incoming.formData();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const name = textField(form, "name", MAX_NAME_CHARS);
  const instruction = textField(form, "instruction", MAX_INSTRUCTION_CHARS);
  if (name === null || instruction === null) return json({ error: "bad_request" }, 400);
  const uploads = await checkUploads(form.getAll("files"), { max: MAX_PHOTOS });
  if (!uploads.ok) return json({ error: uploads.error }, uploads.status);
  const checked = await checkRefs(form.getAll("refs"), uploads.images.length);
  if (!checked.ok) return json({ error: checked.error }, checked.status);
  const { refs } = checked;

  // The tool may be closed until 00:00 UTC after a Workers AI quota error.
  try {
    if (await toolClosed(env.DB, { tool: TOOL, now })) {
      const ctx = await visitorContext(incoming, env, TOOL, now);
      const { triesLeft } = await remaining(ctx.db, ctx);
      logCall({ day: ctx.day, tool: TOOL, ok: false, reason: "closed", latency_ms: Date.now() - started });
      return reply(ctx, { error: "cap", triesLeft }, 429);
    }
  } catch {
    return json({ error: "unavailable" }, 503);
  }

  // 3. Turnstile.
  const human = await verifyTurnstile({
    secret: env.TURNSTILE_SECRET,
    token: form.get("token"),
    ip: clientIp(incoming),
    url: env.TURNSTILE_VERIFY_URL || undefined,
  });
  if (!human.ok) return json({ error: "bot_check" }, 403);

  // 4 to 6.
  const fields = { name, instruction };
  const finish = drawPosts({ env, refs, timing: imageTiming, now });
  return runAiTry({
    incoming,
    env,
    now,
    started,
    tool: TOOL,
    // Generous: a character is rarely more than one token.
    reserve: reservationNano({ images: uploads.images.length, inputTokens: name.length + instruction.length }),
    request: request(uploads.images, fields),
    repair: repairRequest,
    read: (text) => readStudioOutput(text, { photos: uploads.images.length, ...fields }),
    finish: { reserve: POSTS * pictureReserveNano(imageModel(env), refs), run: finish },
    logDefaults: { photos: uploads.images.length, products: 0, pictures: 0 },
  });
}
