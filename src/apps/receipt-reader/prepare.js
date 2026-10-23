/**
 * Gets each file ready to send, in the browser: photos are resized to a
 * 1600 px long edge and re-encoded as JPEG at quality 0.8, and a PDF's first
 * page is rendered to the same. pdf.js is only fetched when a PDF is added.
 *
 * Returns { ok: true, blob, previewUrl, fromPdf } or
 * { ok: false, reason: "heic" | "type" | "tooBig" | "unopenable" }.
 */
export const LONG_EDGE = 1600;
export const QUALITY = 0.8;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function kindOf(file) {
  const name = (file.name ?? "").toLowerCase();
  const type = (file.type ?? "").toLowerCase();
  if (type === "image/heic" || type === "image/heif" || /\.(heic|heif)$/.test(name)) return "heic";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (IMAGE_TYPES.includes(type) || /\.(jpe?g|png|webp)$/.test(name)) return "image";
  return null;
}

/** Width and height that fit the long edge, never enlarging. */
export function fitLongEdge(width, height, edge = LONG_EDGE) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const toJpeg = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/jpeg", QUALITY)
  );

function canvasFor(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  // JPEG has no transparency: give a PNG's clear areas a white background.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  return { canvas, context };
}

async function decode(file) {
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

async function fromImage(file) {
  const source = await decode(file);
  const { width, height } = fitLongEdge(source.width, source.height);
  const { canvas, context } = canvasFor(width, height);
  context.drawImage(source, 0, 0, width, height);
  source.close?.();
  return toJpeg(canvas);
}

async function fromPdf(file) {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const { width, height } = fitLongEdge(base.width * 4, base.height * 4);
    const viewport = page.getViewport({ scale: width / base.width });
    const { canvas, context } = canvasFor(width, height);
    await page.render({ canvasContext: context, viewport }).promise;
    return toJpeg(canvas);
  } finally {
    pdf.destroy();
  }
}

export async function prepareFile(file) {
  const kind = kindOf(file);
  if (kind === "heic") return { ok: false, reason: "heic" };
  if (!kind) return { ok: false, reason: "type" };
  let blob;
  try {
    blob = kind === "pdf" ? await fromPdf(file) : await fromImage(file);
  } catch {
    return { ok: false, reason: "unopenable" };
  }
  if (blob.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "tooBig" };
  return { ok: true, blob, previewUrl: URL.createObjectURL(blob), fromPdf: kind === "pdf" };
}
