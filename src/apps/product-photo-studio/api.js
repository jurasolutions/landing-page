/** The product photo studio's two calls: tries left, and making the posts. */
import { fetchLimit as fetchToolLimit } from "../_shared/ai-limit.js";

export const TOOL = "product-photo-studio";

/** Photos per try (the Function refuses more). */
export const MAX_PHOTOS = 4;

/** The longest each typed field may be; the Function refuses longer. */
export const FIELD_LIMITS = { name: 80, instruction: 500 };

export const fetchLimit = () => fetchToolLimit(TOOL);

/**
 * The multipart body of one try: `token`; each photo twice, as `files` (the
 * 1600 px JPEG Claude reads) and `refs` (the 512 px JPEG the image model
 * draws from), in the same order; then `name` and `instruction`, trimmed and
 * left out when empty.
 *   photos  [{ file: Blob, ref: Blob }]
 */
export function postForm({ token, photos, name, instruction }) {
  const form = new FormData();
  form.append("token", token);
  photos.forEach((photo, index) => form.append("files", photo.file, `photo-${index + 1}.jpg`));
  photos.forEach((photo, index) => form.append("refs", photo.ref, `ref-${index + 1}.jpg`));
  for (const [key, value] of [
    ["name", name],
    ["instruction", instruction],
  ]) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) form.append(key, trimmed);
  }
  return form;
}

/** Returns { status, body }; status 0 when the network failed. */
export async function sendPosts(request) {
  try {
    const response = await fetch(`/api/apps/${TOOL}`, {
      method: "POST",
      body: postForm(request),
      credentials: "same-origin",
    });
    const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : {};
    return { status: response.status, body };
  } catch {
    return { status: 0, body: {} };
  }
}
