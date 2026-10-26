/**
 * The last result, kept in this tab's sessionStorage so a phone that reloads
 * the page while the visitor is in another app still has the posts
 * (functional review S4). It stays in the browser; nothing reaches Jura.
 *
 * The words and the pictures are kept under separate keys. The pictures are
 * written once, when a try comes back; the words (captions, the caption
 * chosen on each frame, the frames chosen) again on every change. If the
 * pictures don't fit, the words are kept and each frame that had a picture
 * comes back marked `lost`, so the page can say so.
 */
import { readSession, removeSession, writeSession } from "../_shared/storage.js";

const WORDS = "product-photo-studio:result";
const PICTURES = "product-photo-studio:pictures";

const words = (result) => ({
  ...result,
  posts: result.posts.map(({ image, lost, ...post }) => ({ ...post, hadImage: Boolean(image || lost) })),
});

/** Keeps a new result. Returns { picturesKept }. */
export function keepResult(result) {
  const picturesKept = writeSession(
    PICTURES,
    result.posts.map((post) => post.image ?? null)
  );
  if (!picturesKept) removeSession(PICTURES);
  writeSession(WORDS, words(result));
  return { picturesKept };
}

/** Keeps the visitor's changes to the words; the pictures stay as they were. */
export function keepWords(result) {
  writeSession(WORDS, words(result));
}

/** The kept result, or null when there is none. */
export function restoreResult() {
  const kept = readSession(WORDS);
  if (!kept || !Array.isArray(kept.posts)) return null;
  const pictures = readSession(PICTURES) ?? [];
  return {
    ...kept,
    posts: kept.posts.map(({ hadImage, ...post }, index) => {
      const image = pictures[index];
      if (image) return { ...post, image };
      return hadImage ? { ...post, lost: true } : post;
    }),
  };
}

export function forgetResult() {
  removeSession(WORDS);
  removeSession(PICTURES);
}
