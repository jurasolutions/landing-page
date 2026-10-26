/**
 * Whether the visitor can make posts right now, what the page says after a
 * try, and the three frames' state. Pure, so the rules are unit-tested
 * without a DOM.
 *   limit  what GET /api/apps/limit returned, or null while it is loading
 */
import { failureMessage as readFailure, isOutOfTries } from "../receipt-reader/read-state.js";

/**
 * Why "Make my posts" cannot be pressed yet, or null when it can. The first
 * thing in the way wins, in the order the visitor would meet them. A try
 * needs at least one product photo.
 *   siteKey     the Turnstile site key ("" when the build has none)
 *   photoCount  photos prepared and ready to send
 */
export function makeBlocker({ limit, siteKey, photoCount, preparing, sending }) {
  if (!limit) return "loading";
  if (!limit.ready || !siteKey) return "unavailable";
  if (isOutOfTries(limit)) return "outOfTries";
  if (sending) return "sending";
  if (preparing) return "preparing";
  if (photoCount <= 0) return "noPhotos";
  return null;
}

/**
 * The hint under the disabled button. Empty where the page already says why:
 * the not-ready alert, the out-of-tries notice, or the button's own label.
 */
export function blockerText(reason, copy) {
  return copy.makeWhy[reason] ?? "";
}

/**
 * What the page says after a try that brought no posts back (400, 403, 413,
 * 415, 422, 502, 503, or 0 when the network failed; 429 shows the
 * out-of-tries notice instead). A 422 means no product was found: the try was
 * used, so nothing is said about it coming back. Every other answer follows
 * the receipt reader's rule: "This try wasn't counted" only when it is true.
 */
export function failureMessage({ status, body = {}, triesBefore }, copy) {
  if (status === 422) return copy.errors.noProduct;
  return readFailure({ status, body, triesBefore }, copy);
}

/** A caption as the frame shows it and Copy caption copies it. */
const captionText = (post) => `${String(post.caption ?? "").trim()}\n\n${(post.hashtags ?? []).join(" ")}`.trim();

/**
 * The page's result from a 200 answer:
 *   { products: [{ name, description }],
 *     posts: [{ look, alt, image?, captions: [3 texts], choice, picked }] }
 * Every frame carries its own copy of all three captions, so the visitor can
 * pick and edit one frame's caption without touching the others; `choice`
 * starts at the frame's own. `image` is the base64 JPEG, left out for a
 * picture that could not be drawn. `picked` is "Choose this one".
 */
export function resultFromApi(body) {
  const posts = body.posts ?? [];
  const captions = posts.map(captionText);
  return {
    products: (body.products ?? []).map(({ name, description }) => ({ name, description })),
    posts: posts.map((post, index) => ({
      look: post.look ?? "",
      alt: post.alt ?? "",
      ...(post.image ? { image: post.image } : {}),
      captions: [...captions],
      choice: index,
      picked: false,
    })),
  };
}

export const shownCaption = (post) => post.captions[post.choice] ?? "";

export const chooseCaption = (post, choice) => ({ ...post, choice });

/** Replaces the frame's chosen caption with the visitor's words. */
export const editCaption = (post, text) => ({
  ...post,
  captions: post.captions.map((caption, index) => (index === post.choice ? text : caption)),
});

/** The first letter of the business name for the frame's avatar, or "". */
export const avatarInitial = (name) => (Array.from(String(name ?? "").trim())[0] ?? "").toUpperCase();
