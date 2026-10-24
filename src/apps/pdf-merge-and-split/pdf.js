/**
 * Reads, merges and splits PDFs in the browser with pdf-lib, and zips split
 * pages with fflate. This module, and both libraries with it, is loaded only
 * when the tool needs it (see index.jsx), so neither reaches any other page.
 *
 * Nothing here makes a network request. The files are the visitor's own:
 * no footer, watermark, producer or other metadata is added, and the source
 * title is kept only when one file is involved.
 *
 * Encrypted PDFs are refused, never opened. pdf-lib's load throws for them
 * unless told to ignore encryption, and this module never tells it to.
 */
import { EncryptedPDFError, PDFDocument } from "pdf-lib";
import { zipSync } from "fflate";
import { pageFileName } from "./names.js";

/** "%PDF-" may sit anywhere in the first 1024 bytes (ISO 32000-1, 7.5.2 note). */
function startsLikePdf(bytes) {
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i + 5 <= head.length; i += 1) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46 && head[i + 4] === 0x2d)
      return true;
  }
  return false;
}

const asBytes = (data) => (data instanceof Uint8Array ? data : new Uint8Array(data));

/**
 * pdf-lib is compiled to ES5 classes, so its errors are plain Errors at run
 * time and `instanceof EncryptedPDFError` cannot be trusted. Its message can.
 */
function isEncryptedError(error) {
  return error instanceof EncryptedPDFError || /is encrypted/i.test(String(error?.message ?? ""));
}

/**
 * Why a file could not be used: `reason` is "notPdf", "encrypted" or
 * "damaged", and `index` (when merging) is the file's place in the list.
 */
export class PdfProblem extends Error {
  constructor(reason, index) {
    super(`PDF problem: ${reason}`);
    this.name = "PdfProblem";
    this.reason = reason;
    if (index !== undefined) this.index = index;
  }
}

/** Loads a PDF for reading, or throws a PdfProblem. */
async function load(data) {
  const bytes = asBytes(data);
  if (!startsLikePdf(bytes)) throw new PdfProblem("notPdf");
  let doc;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
    if (doc.getPageCount() < 1) throw new Error("no pages");
  } catch (error) {
    throw new PdfProblem(isEncryptedError(error) ? "encrypted" : "damaged");
  }
  return doc;
}

/** A new, empty document: no producer, creator or dates from pdf-lib. */
const blank = () => PDFDocument.create({ updateMetadata: false });

async function copyInto(target, source, indices) {
  const pages = await target.copyPages(source, indices);
  pages.forEach((page) => target.addPage(page));
}

/** Lets the page repaint ("Putting your file together…") between files. */
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The size a page shows at, after its rotation. */
function shownSize(page) {
  const { width, height } = page.getCropBox();
  const quarter = ((page.getRotation().angle % 360) + 360) % 180 === 90;
  return quarter ? { width: height, height: width } : { width, height };
}

/**
 * Checks a file the visitor added. Returns
 *   { ok: true, pageCount, pages: [{ width, height }], title }  (title or null)
 *   { ok: false, reason: "notPdf" | "encrypted" | "damaged" }
 */
export async function readPdf(data) {
  try {
    const doc = await load(data);
    return {
      ok: true,
      pageCount: doc.getPageCount(),
      pages: doc.getPages().map(shownSize),
      title: doc.getTitle() ?? null,
    };
  } catch (error) {
    return { ok: false, reason: error instanceof PdfProblem ? error.reason : "damaged" };
  }
}

/**
 * Joins the files, in the order given, into one PDF. Each source is
 * { bytes } (an ArrayBuffer or Uint8Array). Pages keep their own size,
 * rotation and text. Resolves to the new file's bytes, or rejects with a
 * PdfProblem whose `index` says which file could not be read.
 */
export async function mergePdfs(sources) {
  const target = await blank();
  for (const [index, source] of sources.entries()) {
    try {
      const doc = await load(source.bytes);
      await copyInto(target, doc, doc.getPageIndices());
      if (sources.length === 1 && doc.getTitle()) target.setTitle(doc.getTitle());
    } catch (error) {
      throw new PdfProblem(error instanceof PdfProblem ? error.reason : "damaged", index);
    }
    await breathe();
  }
  return target.save();
}

/** One new PDF holding `indices` (zero-based, in that order) of the source. */
async function pagesOf(source, indices) {
  const target = await blank();
  await copyInto(target, source, indices);
  const title = source.getTitle();
  if (title) target.setTitle(title);
  return target.save();
}

/** Keeps the given pages (zero-based indices) of one file as a new PDF. */
export async function extractPages(data, indices) {
  return pagesOf(await load(data), indices);
}

/**
 * Splits a file into one PDF per page, zipped. Entries are named
 * `<base>-page-01.pdf` and so on. PDFs are already compressed, so the ZIP
 * stores them as they are rather than spending time squeezing them again.
 */
export async function splitPages(data, base) {
  const source = await load(data);
  const count = source.getPageCount();
  const entries = {};
  for (let index = 0; index < count; index += 1) {
    entries[pageFileName(base, index, count)] = [await pagesOf(source, [index]), { level: 0 }];
    if (index % 10 === 9) await breathe();
  }
  return zipSync(entries);
}
