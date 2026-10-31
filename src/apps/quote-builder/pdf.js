/**
 * Builds the quote PDF in the browser with pdf-lib. This module, and pdf-lib
 * with it, is only loaded when the tool needs it (see index.jsx), so neither
 * reaches any other page of the site.
 *
 * The PDF is the visitor's document: their logo, their name, a neutral
 * Helvetica and plain greys. The colours below are raw values on purpose.
 * Design system tokens style Jura's pages, and this is not one of them.
 *
 * Layout: A4 portrait, 48pt margins. The first page has the header, then the
 * items table flows across as many pages as it needs, repeating its column
 * headings on each, followed by the totals and the notes. Every page has a
 * page number and, unless the visitor switches it off, the "Made with" line.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCents, formatPercent, formatQuantity, parseCents, parsePercent, parseQuantity } from "./calc.js";
import { displayDate } from "./model.js";
import { totalsRows } from "./totals-rows.js";
import { toPrintable } from "./winansi.js";
import { A4, fitLogo } from "./pdf-geometry.js";
import { wrapText } from "./pdf-text.js";

export { A4, fitLogo, wrapText };
const MARGIN = 48;
const BOTTOM = 64; // keep body text above the footer
const FOOTER_Y = 30;

const INK = rgb(0.1, 0.11, 0.1);
const MUTED = rgb(0.38, 0.42, 0.4);
const RULE = rgb(0.85, 0.87, 0.86);

const SIZE = { body: 9.5, small: 8, label: 8.5, name: 12, title: 20, total: 11, footer: 7.5 };
const LEADING = 12.5;

function discountLabel(item, line) {
  if (line.discount <= 0n) return "";
  if (item.discountType === "percent") return `${formatPercent(parsePercent(item.discountValue).value ?? 0n)}%`;
  return formatCents(line.discount);
}

/**
 * quote: the form state (model.js). totals: quoteTotals(quote) from calc.js.
 * logo: null, or { bytes: Uint8Array, kind: "png" | "jpg" } ready to embed
 * (SVG logos are rasterised to PNG in the browser first).
 * Returns { bytes, ops, pageCount }. `ops` records every piece of text drawn,
 * with its page and position, so the tests can check the layout.
 */
export async function buildQuotePdf(quote, totals, copy, { logo = null } = {}) {
  const P = copy.pdf;
  const doc = await PDFDocument.create();
  doc.setTitle(toPrintable(`${P.title} ${quote.details.number}`.trim()));
  doc.setAuthor(toPrintable(quote.business.name));
  // The document is the visitor's: Jura is named in its metadata only when
  // they leave the "Made with" line on.
  doc.setCreator(quote.madeWith ? P.madeWith : "pdf-lib");
  doc.setProducer("pdf-lib");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const [pageWidth, pageHeight] = A4;
  const left = MARGIN;
  const right = pageWidth - MARGIN;
  const width = right - left;

  const ops = [];
  const pages = [];
  let page;
  let y;

  const addPage = () => {
    page = doc.addPage(A4);
    pages.push(page);
    y = pageHeight - MARGIN;
  };

  const text = (
    value,
    x,
    atY,
    { size = SIZE.body, font = regular, color = INK, align = "left", kind = "body", row } = {}
  ) => {
    const printable = toPrintable(value);
    if (!printable) return;
    const textWidth = font.widthOfTextAtSize(printable, size);
    const drawX = align === "right" ? x - textWidth : x;
    page.drawText(printable, { x: drawX, y: atY, size, font, color });
    ops.push({ page: pages.length, kind, row, text: printable, x: drawX, y: atY, width: textWidth, size });
  };

  const rule = (atY, x1 = left, x2 = right, thickness = 0.6) => {
    page.drawLine({ start: { x: x1, y: atY }, end: { x: x2, y: atY }, thickness, color: RULE });
  };

  const room = (needed) => y - needed >= BOTTOM;

  addPage();

  // ---- Header: logo and business on the left, title and details on the right ----

  let leftY = y;
  if (logo) {
    const image = logo.kind === "png" ? await doc.embedPng(logo.bytes) : await doc.embedJpg(logo.bytes);
    const size = fitLogo(image.width, image.height);
    page.drawImage(image, { x: left, y: leftY - size.height, width: size.width, height: size.height });
    ops.push({ page: 1, kind: "logo", x: left, y: leftY - size.height, width: size.width, height: size.height });
    leftY -= size.height + 14;
  }

  const b = quote.business;
  const leftWidth = width * 0.55;
  if (b.name) {
    for (const line of wrapText(b.name, bold, SIZE.name, leftWidth)) {
      leftY -= SIZE.name;
      text(line, left, leftY, { size: SIZE.name, font: bold });
      leftY -= 3;
    }
  }
  const businessLines = [
    ...wrapText(b.address, regular, SIZE.body, leftWidth),
    b.uen ? `${P.uen} ${b.uen}` : "",
    quote.gst.on && quote.gst.regNo ? `${P.gstRegNo} ${quote.gst.regNo}` : "",
    b.phone ? `${P.phone} ${b.phone}` : "",
    b.email ? `${P.email} ${b.email}` : "",
  ].filter((line) => line !== "");
  for (const line of businessLines) {
    leftY -= LEADING;
    text(line, left, leftY, { color: MUTED });
  }

  let rightY = y - SIZE.title;
  text(P.title, right, rightY, { size: SIZE.title, font: bold, align: "right" });
  rightY -= 10;
  const details = [
    [P.number, quote.details.number],
    [P.date, displayDate(quote.details.date, P.months)],
    [P.validUntil, displayDate(quote.details.validUntil, P.months)],
  ].filter(([, value]) => value);
  for (const [label, value] of details) {
    rightY -= LEADING + 1;
    text(value, right, rightY, { font: bold, align: "right" });
    text(label, right - 150, rightY, { color: MUTED });
  }

  y = Math.min(leftY, rightY) - 26;

  // ---- Prepared for ----

  const c = quote.customer;
  const customerLines = [
    ...wrapText(c.contact, regular, SIZE.body, leftWidth),
    ...wrapText(c.address, regular, SIZE.body, leftWidth),
    ...(c.email ? [c.email] : []),
  ].filter((line) => line !== "");
  if (c.company || customerLines.length) {
    text(P.preparedFor, left, y, { size: SIZE.label, font: bold, color: MUTED });
    y -= 4;
    if (c.company) {
      for (const line of wrapText(c.company, bold, SIZE.total, leftWidth)) {
        y -= SIZE.total + 3;
        text(line, left, y, { size: SIZE.total, font: bold });
      }
    }
    for (const line of customerLines) {
      y -= LEADING;
      text(line, left, y);
    }
    y -= 26;
  }

  // ---- Items table ----

  const rows = quote.items
    .map((item, index) => ({ item, line: totals.lines[index] }))
    .filter(({ line }) => line.included);
  const showUnit = rows.some(({ item }) => item.unit.trim());
  const showDiscount = rows.some(({ line }) => line.discount > 0n);

  const columns = [{ key: "index", label: P.columns.index, width: 22, align: "left" }];
  columns.push({ key: "description", label: P.columns.description, width: 0, align: "left" });
  columns.push({ key: "quantity", label: P.columns.quantity, width: 46, align: "right" });
  if (showUnit) columns.push({ key: "unit", label: P.columns.unit, width: 50, align: "left", pad: 10 });
  columns.push({ key: "unitPrice", label: P.columns.unitPrice, width: 70, align: "right" });
  if (showDiscount) columns.push({ key: "discount", label: P.columns.discount, width: 58, align: "right" });
  columns.push({ key: "amount", label: P.columns.amount, width: 76, align: "right" });
  const fixed = columns.reduce((sum, column) => sum + column.width, 0);
  columns[1].width = width - fixed;

  let x = left;
  for (const column of columns) {
    column.x = x;
    x += column.width;
  }
  const cellX = (column) => (column.align === "right" ? column.x + column.width : column.x + (column.pad ?? 0));
  const descriptionWidth = columns[1].width - 12;

  const tableHeader = () => {
    y -= SIZE.label;
    for (const column of columns) {
      text(column.label, cellX(column), y, { size: SIZE.label, font: bold, color: MUTED, align: column.align });
    }
    y -= 6;
    rule(y, left, right, 0.8);
  };

  if (rows.length) {
    if (!room(60)) addPage();
    text(P.currencyNote, right, y, { size: SIZE.small, color: MUTED, align: "right" });
    y -= 10;
    tableHeader();

    rows.forEach(({ item, line }, index) => {
      const cells = {
        index: String(index + 1),
        quantity: formatQuantity(parseQuantity(item.quantity).value ?? 0n),
        unit: item.unit,
        unitPrice: formatCents(parseCents(item.unitPrice).value ?? 0n),
        discount: discountLabel(item, line),
        amount: formatCents(line.total),
      };
      let descriptionLines = wrapText(item.description, regular, SIZE.body, descriptionWidth);
      if (descriptionLines.length === 0) descriptionLines = [""];

      // A row that does not fit moves to the next page whole. Only a row
      // taller than a whole page is split, and then line by line.
      const rowHeight = 5 + SIZE.body + (descriptionLines.length - 1) * LEADING + 6;
      const pageRoom = pageHeight - MARGIN - BOTTOM - (SIZE.label + 6);
      if (!room(rowHeight) && rowHeight <= pageRoom) {
        addPage();
        tableHeader();
      }

      let first = true;
      while (descriptionLines.length) {
        const fit = Math.floor((y - BOTTOM - 8) / LEADING);
        if (fit < 1) {
          addPage();
          tableHeader();
          continue;
        }
        const chunk = descriptionLines.splice(0, fit);
        const top = y - 5;
        chunk.forEach((descriptionLine, i) => {
          text(descriptionLine, columns[1].x, top - SIZE.body - i * LEADING, { kind: "cell", row: index });
        });
        if (first) {
          for (const column of columns) {
            if (column.key === "description") continue;
            text(cells[column.key], cellX(column), top - SIZE.body, {
              font: column.key === "amount" ? bold : regular,
              align: column.align,
              kind: "cell",
              row: index,
            });
          }
          first = false;
        }
        y = top - SIZE.body - (chunk.length - 1) * LEADING - 6;
        if (descriptionLines.length === 0) rule(y);
        else {
          addPage();
          tableHeader();
        }
      }
    });
    y -= 14;
  }

  // ---- Totals ----

  const { rows: totalRows, breakdown, note } = totalsRows(quote, totals, copy);
  // The whole block is counted, the split and the statement included, so it
  // moves to a new page together and never strands the statement on its own.
  const extraLines = breakdown.length + (note ? 1 : 0);
  const totalsHeight = (totalRows.length + extraLines) * (LEADING + 3) + 30;
  if (!room(totalsHeight)) addPage();

  const labelX = right - 210;
  for (const { label, value } of totalRows) {
    y -= LEADING + 3;
    text(label, labelX, y, { color: MUTED });
    text(value, right, y, { align: "right" });
  }
  y -= 10;
  rule(y, labelX, right, 0.8);
  y -= SIZE.total + 6;
  text(P.total, labelX, y, { size: SIZE.total, font: bold });
  text(formatCents(totals.total), right, y, { size: SIZE.total, font: bold, align: "right" });
  for (const { label, value } of breakdown) {
    y -= LEADING + 3;
    text(label, labelX, y, { color: MUTED });
    text(value, right, y, { color: MUTED, align: "right" });
  }
  if (note) {
    y -= LEADING + 3;
    text(note, right, y, { size: SIZE.label, color: MUTED, align: "right" });
  }
  // The statement and the split already add height under the total, so the gap
  // before the notes is smaller, which keeps the terms on the total's page
  // where they sat before the statement was added.
  y -= extraLines ? 14 : 30;

  // ---- Notes and terms ----

  const notes = wrapText(quote.notes, regular, SIZE.body, width);
  if (notes.some((line) => line.trim())) {
    if (!room(LEADING * 2 + SIZE.label)) addPage();
    y -= SIZE.label;
    text(P.notes, left, y, { size: SIZE.label, font: bold, color: MUTED });
    y -= 4;
    for (const line of notes) {
      if (!room(LEADING)) addPage();
      y -= LEADING;
      text(line, left, y);
    }
  }

  // ---- Footer on every page ----

  pages.forEach((footerPage, index) => {
    page = footerPage;
    const kind = "footer";
    const label = P.page(index + 1, pages.length);
    const labelWidth = regular.widthOfTextAtSize(label, SIZE.footer);
    page.drawText(label, { x: right - labelWidth, y: FOOTER_Y, size: SIZE.footer, font: regular, color: MUTED });
    ops.push({ page: index + 1, kind, text: label, x: right - labelWidth, y: FOOTER_Y, width: labelWidth, size: SIZE.footer });
    if (quote.madeWith) {
      const madeWidth = regular.widthOfTextAtSize(P.madeWith, SIZE.footer);
      page.drawText(P.madeWith, { x: left, y: FOOTER_Y, size: SIZE.footer, font: regular, color: MUTED });
      ops.push({ page: index + 1, kind, text: P.madeWith, x: left, y: FOOTER_Y, width: madeWidth, size: SIZE.footer });
    }
  });

  const bytes = await doc.save();
  return { bytes, ops, pageCount: pages.length };
}
