/**
 * Test PDFs, made here rather than downloaded. The unit tests build them at
 * test time; `make-fixtures.mjs` writes the same files next to this one so
 * they can be dropped into the tool on the dev server (PRD §5.4).
 *
 * Every page carries a line of real text, so a test can check the text is
 * still selectable after a merge or split, and which page ended up where.
 */
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";

export const SIZES = {
  a4Portrait: [595.28, 841.89],
  a4Landscape: [841.89, 595.28],
  usLetter: [612, 792],
};

async function textPdf(pages, { title } = {}) {
  const doc = await PDFDocument.create({ updateMetadata: false });
  if (title) doc.setTitle(title);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const { size, text, rotate = 0 } of pages) {
    const page = doc.addPage(size);
    page.drawText(text, { x: 56, y: size[1] - 96, size: 18, font });
    if (rotate) page.setRotation(degrees(rotate));
  }
  return doc.save();
}

/** Two A4 portrait pages. */
export const portraitA4 = () =>
  textPdf([
    { size: SIZES.a4Portrait, text: "Portrait A4 page 1" },
    { size: SIZES.a4Portrait, text: "Portrait A4 page 2" },
  ]);

/** One A4 landscape page. */
export const landscapeA4 = () => textPdf([{ size: SIZES.a4Landscape, text: "Landscape A4 page 1" }]);

/** Two US Letter pages, the second turned a quarter, with a document title. */
export const usLetter = () =>
  textPdf(
    [
      { size: SIZES.usLetter, text: "US Letter page 1" },
      { size: SIZES.usLetter, text: "US Letter page 2", rotate: 90 },
    ],
    { title: "Site report" }
  );

/** A longer A4 file for the page range and split tests. */
export const tenPages = () =>
  textPdf(Array.from({ length: 10 }, (_, i) => ({ size: SIZES.a4Portrait, text: `Ten pages page ${i + 1}` })), {
    title: "Claim pack",
  });

/**
 * A minimal PDF whose trailer points at a standard security handler
 * dictionary. The /O and /U entries match no password, so pdf.js asks for one
 * (PasswordException) and pdf-lib refuses to load it (EncryptedPDFError),
 * exactly as with a real password-protected file. Nothing in it is readable.
 */
export function passwordProtected() {
  const hex = (length, seed) =>
    Array.from({ length }, (_, i) => ((i * 37 + seed) % 256).toString(16).padStart(2, "0")).join("");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>",
    `<< /Filter /Standard /V 1 /R 2 /Length 40 /P -44 /O <${hex(32, 11)}> /U <${hex(32, 99)}> >>`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, i) => {
    const offset = body.length;
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 4 0 R ` +
    `/ID [<${hex(16, 5)}> <${hex(16, 5)}>] >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

/** A real PDF cut off halfway, as an interrupted download leaves it. */
export async function damaged() {
  const whole = await portraitA4();
  return whole.slice(0, Math.floor(whole.length / 2));
}

/** A text file someone has named .pdf. */
export const notAPdf = () => new TextEncoder().encode("Meeting notes\nThis is a plain text file, not a PDF.\n");
