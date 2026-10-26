/**
 * Turns a drawn picture into the file the visitor saves, in the browser: a
 * social post's portrait (1080 x 1350) or a square (1080 x 1080), as a JPEG.
 *
 * The geometry (`cropRect`), the file name and the save mode are pure and
 * unit-tested; the canvas draw is checked in a real browser.
 */
import { canvasToJpeg } from "../_shared/pdfjs.js";

export const SHAPES = {
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
};

export const JPEG_QUALITY = 0.92;

/**
 * The part of a `w` x `h` source to draw, and the size to draw it at. The
 * largest centred area with the shape's proportions is taken, so a 4:5
 * picture is used whole for portrait and loses its top and bottom for
 * square. Nothing is ever stretched.
 */
export function cropRect(shape, w, h) {
  const { width, height } = SHAPES[shape];
  const ratio = width / height;
  const sw = Math.round(Math.min(w, h * ratio));
  const sh = Math.round(Math.min(h, w / ratio));
  return { sx: Math.round((w - sw) / 2), sy: Math.round((h - sh) / 2), sw, sh, width, height };
}

/**
 * `<look-slug>-<shape>.jpg`. Accents are dropped ("Café" gives "cafe"); a
 * look with nothing a file name can keep gives "product-photo".
 */
export function pictureName(look, shape) {
  const slug = String(look ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `${slug || "product-photo"}-${shape}.jpg`;
}

/**
 * The answer's base64 picture as a JPEG blob, to show through an object URL
 * (never a data URL of half a megabyte in the DOM).
 */
export function base64ToBlob(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "image/jpeg" });
}

/**
 * "share" where the browser can hand `file` to the share sheet (iPhone
 * Safari, Android Chrome: "Save Image" puts it in Photos), else "download".
 */
export function saveMode(nav, file) {
  try {
    return typeof nav?.share === "function" && nav.canShare?.({ files: [file] }) === true ? "share" : "download";
  } catch {
    return "download";
  }
}

/** Draws `blob` (the drawn picture) in `shape` and resolves to a JPEG blob. */
export async function composeJpeg(blob, shape) {
  const source = await createImageBitmap(blob);
  try {
    const { sx, sy, sw, sh, width, height } = cropRect(shape, source.width, source.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
    return await canvasToJpeg(canvas, JPEG_QUALITY);
  } finally {
    source.close?.();
  }
}
