/**
 * The visitor's logo, handled entirely in the browser: read into a data URL
 * for the preview and the saved file, then turned into PNG or JPG bytes for
 * the PDF. SVG is drawn onto a canvas first, because PDFs cannot embed it.
 */
import { LOGO_MAX_BYTES } from "./quoteFile.js";
import { fitLogo } from "./pdf-geometry.js";

const TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg" };

function kindOf(file) {
  if (TYPES[file.type]) return TYPES[file.type];
  const name = file.name?.toLowerCase() ?? "";
  if (name.endsWith(".svg")) return "svg";
  if (name.endsWith(".png")) return "png";
  if (/\.jpe?g$/.test(name)) return "jpg";
  return null;
}

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("unreadable"));
    image.src = src;
  });

/** An SVG with no width and height still has a shape: read it from the viewBox. */
function svgSize(dataUrl) {
  try {
    const source = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
    const box = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(source);
    if (box) return { width: Number(box[1]), height: Number(box[2]) };
  } catch {
    // Fall through to the browser's own measurement.
  }
  return null;
}

/**
 * Returns { ok: true, logo: { dataUrl, width, height } } or
 * { ok: false, reason: "tooBig" | "type" | "unreadable" }.
 */
export async function readLogo(file) {
  const kind = kindOf(file);
  if (!kind) return { ok: false, reason: "type" };
  if (file.size > LOGO_MAX_BYTES) return { ok: false, reason: "tooBig" };
  try {
    let dataUrl = await readAsDataUrl(file);
    // Some systems report SVG without a type; give the data URL the right one.
    if (kind === "svg") dataUrl = dataUrl.replace(/^data:[^;,]*/, "data:image/svg+xml");
    const image = await loadImage(dataUrl);
    const measured = kind === "svg" ? svgSize(dataUrl) : null;
    const width = measured?.width || image.naturalWidth || 300;
    const height = measured?.height || image.naturalHeight || 150;
    return { ok: true, logo: { dataUrl, width, height } };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}

function base64ToBytes(dataUrl) {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Draws any logo onto a canvas at print resolution and returns PNG bytes. */
export async function rasteriseLogo(logo) {
  const image = await loadImage(logo.dataUrl);
  const size = fitLogo(logo.width, logo.height);
  const scale = 4; // about 290 dpi at the printed size
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(size.width * scale));
  canvas.height = Math.max(1, Math.round(size.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: "png" };
}

/** PNG and JPG go into the PDF as they are; SVG is rasterised. */
export async function logoForPdf(logo) {
  if (!logo) return null;
  if (logo.dataUrl.startsWith("data:image/png")) return { bytes: base64ToBytes(logo.dataUrl), kind: "png" };
  if (logo.dataUrl.startsWith("data:image/jpeg")) return { bytes: base64ToBytes(logo.dataUrl), kind: "jpg" };
  return rasteriseLogo(logo);
}
