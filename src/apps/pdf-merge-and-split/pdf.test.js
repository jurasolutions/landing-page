import { describe, expect, it } from "vitest";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";

import { extractPages, mergePdfs, readPdf, splitPages } from "./pdf.js";
import { moveDown, moveItem, moveUp } from "./order.js";
import { parseRanges } from "./ranges.js";
import * as fixtures from "./__fixtures__/fixtures.js";

const openWithPdfjs = (bytes) =>
  pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true }).promise;

/** Each page's text, read back with pdf.js: selectable text survives. */
async function pageTexts(bytes) {
  const pdf = await openWithPdfjs(bytes);
  try {
    const texts = [];
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const content = await (await pdf.getPage(n)).getTextContent();
      texts.push(content.items.map((item) => item.str).join(" ").trim());
    }
    return texts;
  } finally {
    await pdf.destroy();
  }
}

const threeFixtures = async () => ({
  portrait: { name: "portrait.pdf", bytes: await fixtures.portraitA4() },
  landscape: { name: "landscape.pdf", bytes: await fixtures.landscapeA4() },
  letter: { name: "letter.pdf", bytes: await fixtures.usLetter() },
});

describe("mergePdfs", () => {
  it("joins portrait A4, landscape A4 and US Letter in the chosen order, keeping sizes, rotation and text", async () => {
    const { portrait, landscape, letter } = await threeFixtures();
    const merged = await mergePdfs([letter, portrait, landscape]);

    expect(await pageTexts(merged)).toEqual([
      "US Letter page 1",
      "US Letter page 2",
      "Portrait A4 page 1",
      "Portrait A4 page 2",
      "Landscape A4 page 1",
    ]);

    const doc = await PDFDocument.load(merged);
    const boxes = doc.getPages().map((page) => {
      const { width, height } = page.getMediaBox();
      return [width, height, page.getRotation().angle];
    });
    expect(boxes).toEqual([
      [612, 792, 0],
      [612, 792, 90],
      [595.28, 841.89, 0],
      [595.28, 841.89, 0],
      [841.89, 595.28, 0],
    ]);
  });

  it("follows the order after Move up, Move down or a drag", async () => {
    const { portrait, landscape, letter } = await threeFixtures();
    const listed = [portrait, landscape, letter];
    const firstPage = async (list) => (await pageTexts(await mergePdfs(list)))[0];

    expect(await firstPage(moveUp(listed, 1))).toBe("Landscape A4 page 1");
    expect(await firstPage(moveDown(listed, 0))).toBe("Landscape A4 page 1");
    expect(await firstPage(moveItem(listed, 2, 0))).toBe("US Letter page 1");
  });

  it("adds no producer, creator or title of its own, and drops titles when files are combined", async () => {
    const { portrait, letter } = await threeFixtures();
    const merged = await mergePdfs([letter, portrait]);
    const doc = await PDFDocument.load(merged, { updateMetadata: false });
    expect(doc.getProducer()).toBeUndefined();
    expect(doc.getCreator()).toBeUndefined();
    expect(doc.getTitle()).toBeUndefined();
    expect(new TextDecoder("latin1").decode(merged)).not.toMatch(/jura|pdf-lib/i);
  });

  it("keeps the source title when only one file is involved", async () => {
    const { letter } = await threeFixtures();
    const doc = await PDFDocument.load(await mergePdfs([letter]), { updateMetadata: false });
    expect(doc.getTitle()).toBe("Site report");
  });

  it("names the file that could not be read, so the others stay as they are", async () => {
    const { portrait, landscape } = await threeFixtures();
    const broken = { name: "broken.pdf", bytes: await fixtures.damaged() };
    await expect(mergePdfs([portrait, broken, landscape])).rejects.toMatchObject({ index: 1, reason: "damaged" });
  });
});

describe("extractPages", () => {
  it('keeps "1-2, 4" of a file as one new PDF, with its title', async () => {
    const source = await fixtures.tenPages();
    const { pages } = parseRanges("1-2, 4", 10);
    const kept = await extractPages(source, pages);
    expect(await pageTexts(kept)).toEqual(["Ten pages page 1", "Ten pages page 2", "Ten pages page 4"]);
    const doc = await PDFDocument.load(kept, { updateMetadata: false });
    expect(doc.getTitle()).toBe("Claim pack");
    expect(doc.getProducer()).toBeUndefined();
  });

  it("keeps a turned page turned", async () => {
    const kept = await extractPages(await fixtures.usLetter(), [1]);
    const [page] = (await PDFDocument.load(kept)).getPages();
    expect(page.getRotation().angle).toBe(90);
  });
});

describe("splitPages", () => {
  it("gives a ZIP with one PDF per page, named <original name>-page-01.pdf and so on", async () => {
    const zip = await splitPages(await fixtures.portraitA4(), "Claim pack");
    const entries = unzipSync(zip);
    expect(Object.keys(entries)).toEqual(["Claim pack-page-01.pdf", "Claim pack-page-02.pdf"]);
    expect(await pageTexts(entries["Claim pack-page-01.pdf"])).toEqual(["Portrait A4 page 1"]);
    expect(await pageTexts(entries["Claim pack-page-02.pdf"])).toEqual(["Portrait A4 page 2"]);
  });

  it("splits every page of a longer file, keeping each page's size and the source title", async () => {
    const entries = unzipSync(await splitPages(await fixtures.tenPages(), "Claim pack"));
    const names = Object.keys(entries);
    expect(names).toHaveLength(10);
    expect(names[9]).toBe("Claim pack-page-10.pdf");
    const tenth = await PDFDocument.load(entries[names[9]], { updateMetadata: false });
    expect(tenth.getPageCount()).toBe(1);
    expect(tenth.getTitle()).toBe("Claim pack");
    expect(await pageTexts(entries[names[9]])).toEqual(["Ten pages page 10"]);
  });

  it("refuses a password-protected file rather than opening it", async () => {
    await expect(splitPages(fixtures.passwordProtected(), "locked")).rejects.toMatchObject({ reason: "encrypted" });
    await expect(extractPages(fixtures.passwordProtected(), [0])).rejects.toMatchObject({ reason: "encrypted" });
  });
});

describe("readPdf", () => {
  it("gives a readable PDF's page count, page sizes and title", async () => {
    const result = await readPdf(await fixtures.usLetter());
    expect(result).toMatchObject({ ok: true, pageCount: 2, title: "Site report" });
    // The second page is turned a quarter, so it shows landscape.
    expect(result.pages).toEqual([
      { width: 612, height: 792 },
      { width: 792, height: 612 },
    ]);
  });

  it("refuses a password-protected PDF, which pdf.js also asks a password for", async () => {
    const bytes = fixtures.passwordProtected();
    expect(await readPdf(bytes)).toEqual({ ok: false, reason: "encrypted" });
    await expect(openWithPdfjs(bytes)).rejects.toMatchObject({ name: "PasswordException" });
  });

  it("calls a cut-off PDF damaged", async () => {
    expect(await readPdf(await fixtures.damaged())).toEqual({ ok: false, reason: "damaged" });
    expect(await readPdf(new TextEncoder().encode("%PDF-1.7\n" + "x".repeat(500)))).toEqual({
      ok: false,
      reason: "damaged",
    });
  });

  it("says a file isn't a PDF when it doesn't start like one, whatever its name", async () => {
    expect(await readPdf(fixtures.notAPdf())).toEqual({ ok: false, reason: "notPdf" });
    expect(await readPdf(new Uint8Array(0))).toEqual({ ok: false, reason: "notPdf" });
  });

  it("accepts an ArrayBuffer as File.arrayBuffer() gives it", async () => {
    const bytes = await fixtures.landscapeA4();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    expect(await readPdf(buffer)).toMatchObject({ ok: true, pageCount: 1, title: null });
  });
});
