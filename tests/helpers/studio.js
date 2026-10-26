/**
 * Claude outputs and requests for APP-004 Product photo studio. The outputs
 * are in the shape of server/photo-studio.js STUDIO_SCHEMA.
 */
import { fakeJpeg, jpegOf } from "./ai.js";

/**
 * A POST to /api/apps/product-photo-studio. `files` are the photos for
 * Claude; `refs` default to one 512 x 384 JPEG per photo, for the image model.
 * A field set to null is left out of the form.
 */
export function studioRequest({
  files = [fakeJpeg(2048, "PHOTO-0")],
  refs,
  name = "",
  instruction = "",
  token = "XXXX.DUMMY.TOKEN.XXXX",
  ip = "203.0.113.10",
  cookie,
  extra = {},
} = {}) {
  const form = new FormData();
  if (token !== null) form.append("token", token);
  files.forEach((bytes, i) => form.append("files", new Blob([bytes], { type: "image/jpeg" }), `photo-${i + 1}.jpg`));
  (refs ?? files.map((_, i) => jpegOf(512, 384, { marker: `REF-${i}` }))).forEach((bytes, i) =>
    form.append("refs", new Blob([bytes], { type: "image/jpeg" }), `ref-${i + 1}.jpg`)
  );
  if (name !== null) form.append("name", name);
  if (instruction !== null) form.append("instruction", instruction);
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  return new Request("https://jurasolutions.sg/api/apps/product-photo-studio", {
    method: "POST",
    body: form,
    headers: { "CF-Connecting-IP": ip, ...(cookie ? { Cookie: cookie } : {}) },
  });
}

export const post = (overrides = {}) => ({
  look: "Clean white studio",
  edit_prompt:
    "The amber glass candle jar from image 0 stands centred on a seamless white sweep, with a small sprig of dried lavender beside it. An even white studio softbox lights it from the front left, with a soft shadow falling to the right. Eye-level view, the jar whole in frame with clear space above and below.",
  caption: "Light it and let the evening slow down.\n\nOur lavender candle is hand-poured in small batches. Message us to get yours.",
  hashtags: ["#candles", "#handpoured", "#lavender", "#homedecor", "#smallbusiness"],
  alt: "An amber glass candle jar on a plain white background with a sprig of dried lavender.",
  ...overrides,
});

export const STUDIO = {
  no_product: false,
  products: [{ name: "Lavender candle", description: "Amber glass jar candle with a plain kraft label." }],
  posts: [
    post(),
    post({
      look: "Morning counter",
      edit_prompt:
        "The amber glass candle jar from image 0 sits on a pale marble counter beside a folded oat linen napkin, in soft window daylight from the left. A 45 degree view, the jar centred and whole in frame with clear space above and below.",
    }),
    post({
      look: "Dark and moody",
      edit_prompt:
        "The amber glass candle jar from image 0 stands on a dark slate surface against a deep charcoal backdrop, lit by a single warm spotlight from above. Straight-on eye-level view, the jar centred with clear space above and below.",
    }),
  ],
};

export const NO_PRODUCT = { no_product: true, products: [], posts: [] };

/** STUDIO with one post's fields changed. */
export const withPost = (index, overrides) => ({
  ...STUDIO,
  posts: STUDIO.posts.map((p, i) => (i === index ? { ...p, ...overrides } : p)),
});
