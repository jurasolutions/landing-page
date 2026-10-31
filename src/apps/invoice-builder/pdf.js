/**
 * Builds the invoice PDF in the browser with pdf-lib. This module, and pdf-lib
 * with it, is only loaded when the tool needs it (see index.jsx), so neither
 * reaches any other page of the site.
 *
 * The PDF is the visitor's document: their logo, their name, a neutral
 * Helvetica and plain greys. The colours below are raw values on purpose.
 * Design system tokens style Jura's pages, and this is not one of them. There
 * is no Jura name anywhere: no "Made with" line, and the metadata's creator
 * and producer are "pdf-lib".
 *
 * Layout: A4 portrait, 48pt margins, the same as the quote's. The first page
 * has the header (logo and business on the left, the title, number and dates
 * on the right) and "Bill to". The items table flows across as many pages as
 * it needs, repeating its column headings on each; a row moves to the next
 * page whole, and only a row taller than a page is split. The totals block is
 * measured first and moves to a new page whole if it doesn't fit. The payment
 * details and the notes follow and may flow. Every page has a page number.
 *
 * The items table is a copy of the quote's loop on purpose (technical.md §2,
 * D3): the quote's PDF is live, and both are pinned by their own tests.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCents, formatPercent, formatQuantity, parseCents, parsePercent, parseQuantity } from "../quote-builder/calc.js";
import { displayDate } from "../quote-builder/model.js";
import { toPrintable } from "../quote-builder/winansi.js";
import { A4, fitLogo } from "../quote-builder/pdf-geometry.js";
import { wrapText } from "../quote-builder/pdf-text.js";
import { invoiceTotalsRows } from "./totals-rows.js";

const MARGIN = 48;
const BOTTOM = 64; // keep body text above the footer
const FOOTER_Y = 30;

const INK = rgb(0.1, 0.11, 0.1);
const MUTED = rgb(0.38, 0.42, 0.4);
const RULE = rgb(0.85, 0.87, 0.86);

const SIZE = { body: 9.5, small: 8, label: 8.5, name: 12, title: 20, total: 11, footer: 7.5 };
const LEADING = 12.5;
const TOTAL_STEP = LEADING + 3;

function discountLabel(item, line) {
  if (line.discount <= 0n) return "";
  if (item.discountType === "percent") return `${formatPercent(parsePercent(item.discountValue).value ?? 0n)}%`;
  return formatCents(line.discount);
}

/**
 * invoice: the form state (model.js). totals: quoteTotals(invoice).
 * logo: null, or { bytes: Uint8Array, kind: "png" | "jpg" } ready to embed.
 * Returns { bytes, ops, pageCount }. `ops` records every piece of text drawn,
 * with its page, position and kind, so the tests can check the layout.
 */
export async function buildInvoicePdf(invoice, totals, copy, { logo = null } = {}) {
  const P = copy.pdf;
  const gstOn = invoice.gst.on === true;
  const title = P.title(gstOn);

  const doc = await PDFDocument.create();
  doc.setTitle(toPrintable(`${title} ${invoice.details.number}`.trim()));
  doc.setAuthor(toPrintable(invoice.business.name));
  doc.setCreator("pdf-lib");
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

  const b = invoice.business;
  const leftWidth = width * 0.55;
  // An empty name prints nothing (decision D2): never a placeholder.
  if (b.name.trim()) {
    for (const line of wrapText(b.name, bold, SIZE.name, leftWidth)) {
      leftY -= SIZE.name;
      text(line, left, leftY, { size: SIZE.name, font: bold });
      leftY -= 3;
    }
  }
  const businessLines = [
    ...wrapText(b.address, regular, SIZE.body, leftWidth),
    b.uen ? `${P.uen} ${b.uen}` : "",
    // With GST off the registration number never prints, even when typed.
    gstOn && invoice.gst.regNo ? `${P.gstRegNo} ${invoice.gst.regNo}` : "",
    b.phone ? `${P.phone} ${b.phone}` : "",
    b.email ? `${P.email} ${b.email}` : "",
  ].filter((line) => line !== "");
  for (const line of businessLines) {
    leftY -= LEADING;
    text(line, left, leftY, { color: MUTED });
  }

  let rightY = y - SIZE.title;
  text(title, right, rightY, { size: SIZE.title, font: bold, align: "right", kind: "title" });
  rightY -= 10;
  const details = [
    [P.number, invoice.details.number],
    [P.date, displayDate(invoice.details.date, P.months)],
    [P.dueDate, displayDate(invoice.details.dueDate, P.months)],
  ].filter(([, value]) => value);
  for (const [label, value] of details) {
    rightY -= LEADING + 1;
    text(value, right, rightY, { font: bold, align: "right" });
    text(label, right - 150, rightY, { color: MUTED });
  }

  y = Math.min(leftY, rightY) - 26;

  // ---- Bill to ----

  const c = invoice.customer;
  const customerLines = [
    ...wrapText(c.contact, regular, SIZE.body, leftWidth),
    ...wrapText(c.address, regular, SIZE.body, leftWidth),
    ...(c.email ? [c.email] : []),
  ].filter((line) => line !== "");
  if (c.company || customerLines.length) {
    text(P.billTo, left, y, { size: SIZE.label, font: bold, color: MUTED });
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

  const rows = invoice.items
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

  // ---- Totals: measured first, so the block moves to a new page whole ----

  const { rows: totalRows, final } = invoiceTotalsRows(invoice, totals, copy);
  const totalsHeight = totalRows.length * TOTAL_STEP + 10 + SIZE.total + 6;
  if (!room(totalsHeight)) addPage();

  const labelX = right - 210;
  for (const { label, value } of totalRows) {
    y -= TOTAL_STEP;
    text(label, labelX, y, { color: MUTED, kind: "total" });
    text(value, right, y, { align: "right", kind: "total" });
  }
  y -= 10;
  rule(y, labelX, right, 0.8);
  y -= SIZE.total + 6;
  text(final.label, labelX, y, { size: SIZE.total, font: bold, kind: "total" });
  text(final.value, right, y, { size: SIZE.total, font: bold, align: "right", kind: "total" });
  y -= 30;

  // ---- Payment details, then notes: wrapped, and free to flow ----

  const section = (label, value) => {
    const lines = wrapText(value, regular, SIZE.body, width);
    if (!lines.some((line) => line.trim())) return;
    if (!room(LEADING * 2 + SIZE.label)) addPage();
    y -= SIZE.label;
    text(label, left, y, { size: SIZE.label, font: bold, color: MUTED });
    y -= 4;
    for (const line of lines) {
      if (!room(LEADING)) addPage();
      y -= LEADING;
      text(line, left, y);
    }
    y -= 18;
  };
  section(P.payment, invoice.payment);
  section(P.notes, invoice.notes);

  // ---- Footer on every page: the page number only ----

  pages.forEach((footerPage, index) => {
    const label = P.page(index + 1, pages.length);
    const labelWidth = regular.widthOfTextAtSize(label, SIZE.footer);
    footerPage.drawText(label, { x: right - labelWidth, y: FOOTER_Y, size: SIZE.footer, font: regular, color: MUTED });
    ops.push({ page: index + 1, kind: "footer", text: label, x: right - labelWidth, y: FOOTER_Y, width: labelWidth, size: SIZE.footer });
  });

  const bytes = await doc.save();
  return { bytes, ops, pageCount: pages.length };
}
