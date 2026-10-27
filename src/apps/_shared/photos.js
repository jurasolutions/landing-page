/**
 * Photos made ready to send, in the browser: decoded once (turned the right
 * way up), then drawn at a long edge and encoded as JPEG. Shared by the AI
 * tools that take photos. Nothing here leaves the device.
 */
import { canvasToJpeg } from "./pdfjs.js";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** "heic", "image" (JPG, PNG or WEBP), or null, from a file's type and name. */
export function imageKind(file) {
  const name = (file.name ?? "").toLowerCase();
  const type = (file.type ?? "").toLowerCase();
  if (type === "image/heic" || type === "image/heif" || /\.(heic|heif)$/.test(name)) return "heic";
  if (IMAGE_TYPES.includes(type) || /\.(jpe?g|png|webp)$/.test(name)) return "image";
  return null;
}

/** Width and height that fit the long edge, never enlarging. */
export function fitLongEdge(width, height, edge) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** A canvas of the size, white underneath: JPEG has no transparency. */
export function whiteCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  return { canvas, context };
}

/** Decodes a photo file the right way up. Call `close?.()` on the result when done. */
export async function decodeImage(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall back to an <img> below.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draws a decoded image to fit `edge` and encodes it as a JPEG blob. */
export function drawJpeg(source, edge, quality) {
  const { width, height } = fitLongEdge(source.width, source.height, edge);
  const { canvas, context } = whiteCanvas(width, height);
  context.drawImage(source, 0, 0, width, height);
  return canvasToJpeg(canvas, quality);
}
