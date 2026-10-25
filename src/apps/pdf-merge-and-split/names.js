/**
 * Names for the files the tool hands back. They are the visitor's documents,
 * so their own names are kept as typed, in any script; only the characters a
 * file name cannot hold are swapped for a dash. (`safeFilename` in _shared
 * keeps ASCII only, which would turn a Chinese file name into nothing.)
 */
const UNSAFE = /[\u0000-\u001f\u007f/\\:*?"<>|]+/g;

function clean(value) {
  return String(value ?? "")
    .replace(UNSAFE, "-")
    .replace(/-+/g, "-")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
    .slice(0, 120);
}

const withoutPdf = (value) => String(value ?? "").trim().replace(/\.pdf$/i, "");

/** The visitor's file name without its .pdf, made safe. */
export function baseName(fileName, fallback = "document") {
  return clean(withoutPdf(fileName)) || fallback;
}

/** `<original name>-page-01.pdf`, padded to the widest page number. */
export function pageFileName(base, index, pageCount) {
  const width = Math.max(2, String(pageCount).length);
  return `${base}-page-${String(index + 1).padStart(width, "0")}.pdf`;
}

/** The name typed for the new file, or the fallback, with .pdf once. */
export function pdfFileName(typed, fallback) {
  return `${clean(withoutPdf(typed)) || fallback}.pdf`;
}
