/**
 * Gets each product photo ready to send, in the browser. A photo is decoded
 * once and drawn twice: a 1600 px JPEG (quality 0.8) that Claude reads, and a
 * 512 px JPEG (quality 0.85) that the image model draws from. No PDFs.
 *
 * Returns { ok: true, file, ref } or
 * { ok: false, reason: "heic" | "type" | "tooBig" | "unopenable" }.
 * The page shows `ref` as the thumbnail, through an object URL it owns.
 */
import { decodeImage, drawJpeg, imageKind as photoKind } from "../_shared/photos.js";

/** "image", "heic" (taken when the browser can decode it) or null (refused). */
export { photoKind };

export const SIZES = { file: { edge: 1600, quality: 0.8 }, ref: { edge: 512, quality: 0.85 } };

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function preparePhoto(file) {
  const kind = photoKind(file);
  if (!kind) return { ok: false, reason: "type" };
  let made;
  try {
    const source = await decodeImage(file);
    try {
      made = {
        file: await drawJpeg(source, SIZES.file.edge, SIZES.file.quality),
        ref: await drawJpeg(source, SIZES.ref.edge, SIZES.ref.quality),
      };
    } finally {
      source.close?.();
    }
  } catch {
    // A HEIC photo is tried like any other: Safari can decode it.
    return { ok: false, reason: kind === "heic" ? "heic" : "unopenable" };
  }
  if (made.file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "tooBig" };
  return { ok: true, ...made };
}
