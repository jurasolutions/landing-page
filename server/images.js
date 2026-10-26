/**
 * Upload checks for the AI tools: what a file really is, by its first bytes,
 * whatever the browser claimed. Runs before the try counter or the API.
 */
export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 4 * 1024 * 1024; // PRD: files up to 4 MB
export const MAX_BODY_BYTES = MAX_FILES * MAX_FILE_BYTES + 256 * 1024;

const ascii = (bytes, start, end) => String.fromCharCode(...bytes.subarray(start, end));

/** "image/jpeg" | "image/png" | "image/webp" | "image/heic" | null */
export function sniffImage(bytes) {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(ascii(bytes, 8, 12))) {
    return "image/heic";
  }
  return null;
}

/**
 * Checks the files from a multipart form: 1 to `max` of them (3 unless a tool
 * says otherwise). Returns
 *   { ok: true, images: [{ mediaType, bytes }] }  or
 *   { ok: false, status, error: "count" | "too_large" | "heic" | "type" }.
 */
export async function checkUploads(files, { max = MAX_FILES } = {}) {
  if (files.length < 1 || files.length > max) return { ok: false, status: 400, error: "count" };
  const images = [];
  for (const file of files) {
    if (typeof file === "string" || typeof file?.arrayBuffer !== "function") {
      return { ok: false, status: 400, error: "type" };
    }
    if (file.size > MAX_FILE_BYTES) return { ok: false, status: 413, error: "too_large" };
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_FILE_BYTES) return { ok: false, status: 413, error: "too_large" };
    const mediaType = sniffImage(bytes);
    if (mediaType === "image/heic") return { ok: false, status: 415, error: "heic" };
    if (!mediaType) return { ok: false, status: 415, error: "type" };
    images.push({ mediaType, bytes });
  }
  return { ok: true, images };
}

/** Start-of-frame markers, which carry the image's size: C0 to CF but C4, C8 and CC. */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/**
 * A JPEG's width and height, read from its first start-of-frame marker
 * without decoding it, or null when the bytes are not a readable JPEG.
 */
export function jpegSize(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 3 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at += 1; // a fill byte
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2; // a marker with no segment
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // the end, or the scan, before any frame
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    if (length < 2) return null;
    if (SOF.has(marker)) {
      if (at + 8 >= bytes.length) return null;
      const height = (bytes[at + 5] << 8) | bytes[at + 6];
      const width = (bytes[at + 7] << 8) | bytes[at + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    at += 2 + length;
  }
  return null;
}

/** The image model's reference images: the browser makes them at most 512 px on the long edge. */
export const MAX_REF_SIDE = 512;
export const MAX_REF_BYTES = 300 * 1024;

/**
 * Checks the reference images that go to the image model with a tool's
 * photos: exactly `count` of them, one per photo, each a JPEG of at most
 * 512 px a side and under 300 KB. Returns
 *   { ok: true, refs: [{ bytes, width, height }] }  or
 *   { ok: false, status, error: "count" | "too_large" | "bad_request" }.
 */
export async function checkRefs(files, count) {
  if (files.length !== count) return { ok: false, status: 400, error: "count" };
  const refs = [];
  for (const file of files) {
    if (typeof file === "string" || typeof file?.arrayBuffer !== "function") {
      return { ok: false, status: 400, error: "bad_request" };
    }
    if (file.size >= MAX_REF_BYTES) return { ok: false, status: 413, error: "too_large" };
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length >= MAX_REF_BYTES) return { ok: false, status: 413, error: "too_large" };
    const size = sniffImage(bytes) === "image/jpeg" ? jpegSize(bytes) : null;
    if (!size || size.width > MAX_REF_SIDE || size.height > MAX_REF_SIDE) {
      return { ok: false, status: 400, error: "bad_request" };
    }
    refs.push({ bytes, ...size });
  }
  return { ok: true, refs };
}
