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
 * Checks the files from a multipart form. Returns
 *   { ok: true, images: [{ mediaType, bytes }] }  or
 *   { ok: false, status, error: "count" | "too_large" | "heic" | "type" }.
 */
export async function checkUploads(files) {
  if (files.length < 1 || files.length > MAX_FILES) return { ok: false, status: 400, error: "count" };
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
