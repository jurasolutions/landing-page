/**
 * Gets each file ready to send, in the browser: photos are resized to a
 * 1600 px long edge and re-encoded as JPEG at quality 0.8, and a PDF's first
 * page is rendered to the same. pdf.js is only fetched when a PDF is added.
 * A HEIC photo is accepted when the browser can decode it, and refused
 * ("heic") only when it can't.
 *
 * Returns { ok: true, blob, previewUrl, fromPdf } or
 * { ok: false, reason: "heic" | "type" | "tooBig" | "unopenable" }.
 */
import { canvasToJpeg, openPdfjs } from "../_shared/pdfjs.js";
import { decodeImage, drawJpeg, fitLongEdge as fitEdge, imageKind, whiteCanvas } from "../_shared/photos.js";

export const LONG_EDGE = 1600;
export const QUALITY = 0.8;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function kindOf(file) {
  const name = (file.name ?? "").toLowerCase();
  const type = (file.type ?? "").toLowerCase();
  const kind = imageKind(file);
  if (kind === "heic") return "heic";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  return kind;
}

/** Width and height that fit the long edge, never enlarging. */
export const fitLongEdge = (width, height, edge = LONG_EDGE) => fitEdge(width, height, edge);

async function fromImage(file) {
  const source = await decodeImage(file);
  try {
    return await drawJpeg(source, LONG_EDGE, QUALITY);
  } finally {
    source.close?.();
  }
}

async function fromPdf(file) {
  const pdf = await openPdfjs(new Uint8Array(await file.arrayBuffer()));
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const { width, height } = fitLongEdge(base.width * 4, base.height * 4);
    const viewport = page.getViewport({ scale: width / base.width });
    const { canvas, context } = whiteCanvas(width, height);
    await page.render({ canvasContext: context, viewport }).promise;
    return canvasToJpeg(canvas, QUALITY);
  } finally {
    pdf.destroy();
  }
}

export async function prepareFile(file) {
  const kind = kindOf(file);
  if (!kind) return { ok: false, reason: "type" };
  let blob;
  try {
    // A HEIC photo is tried like any other: Safari can decode it.
    blob = kind === "pdf" ? await fromPdf(file) : await fromImage(file);
  } catch {
    return { ok: false, reason: kind === "heic" ? "heic" : "unopenable" };
  }
  if (blob.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "tooBig" };
  return { ok: true, blob, previewUrl: URL.createObjectURL(blob), fromPdf: kind === "pdf" };
}
