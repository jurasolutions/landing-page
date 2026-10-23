/**
 * The receipt table as CSV, tab-separated text and Excel, made in the
 * browser. Nothing is sent anywhere.
 *
 * Cells that came from a receipt are untrusted: text that starts with = + -
 * @ or a tab could run as a formula when a spreadsheet opens it, so such text
 * is prefixed with an apostrophe in CSV and the copied text. Valid amounts go
 * out as numbers so the spreadsheet can add them up.
 */
import { toCents } from "./model.js";

const FORMULA = /^[=+\-@\t\r]/;

function cell(value, kind = "text") {
  if (kind === "money") {
    const cents = toCents(value);
    if (cents !== null) return { type: "number", value: cents / 100 };
  }
  if (kind === "number") {
    const n = Number(String(value ?? "").trim());
    if (String(value ?? "").trim() !== "" && Number.isFinite(n)) return { type: "number", value: n };
  }
  return { type: "text", value: String(value ?? "") };
}

export function receiptTable(receipts, copy) {
  const F = copy.fields;
  const header = [F.merchant, F.merchantId, F.date, F.currency, F.subtotal, F.gst, F.total, F.payment, F.category, F.notes];
  const rows = receipts
    .filter((r) => r.isReceipt)
    .map((r) => [
      cell(r.merchant),
      cell(r.merchantId),
      cell(r.date),
      cell(r.currency),
      cell(r.subtotal, "money"),
      cell(r.gst, "money"),
      cell(r.total, "money"),
      cell(r.payment),
      cell(r.category),
      cell(r.notes),
    ]);
  return { header, rows };
}

export function itemsTable(receipts, copy) {
  const F = copy.fields;
  const header = [copy.exports.itemsReceipt, F.merchant, F.itemDescription, F.itemQuantity, F.itemAmount];
  const rows = [];
  receipts
    .filter((r) => r.isReceipt)
    .forEach((r, index) => {
      for (const item of r.items) {
        rows.push([cell(String(index + 1), "number"), cell(r.merchant), cell(item.description), cell(item.quantity, "number"), cell(item.amount, "money")]);
      }
    });
  return { header, rows };
}

const safeText = (value) => (FORMULA.test(value) ? `'${value}` : value);

function cellText(c, { money }) {
  // Amounts keep two decimals (12.30); other numbers print as they are.
  if (c.type === "number") return money ? c.value.toFixed(2) : String(c.value);
  return safeText(c.value);
}

const MONEY_COLUMNS = new Set([4, 5, 6]);

export function toCsv({ header, rows }, moneyColumns = MONEY_COLUMNS) {
  const quote = (text) => (/[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  const lines = [header.map((h) => quote(safeText(h)))];
  for (const row of rows) {
    lines.push(row.map((c, i) => quote(cellText(c, { money: moneyColumns.has(i) }))));
  }
  // A byte-order mark so Excel reads the file as UTF-8, and CRLF line ends.
  return `﻿${lines.map((line) => line.join(",")).join("\r\n")}\r\n`;
}

export function toTsv({ header, rows }, moneyColumns = MONEY_COLUMNS) {
  const clean = (text) => text.replace(/[\t\r\n]+/g, " ");
  const lines = [header.map(clean)];
  for (const row of rows) lines.push(row.map((c, i) => clean(cellText(c, { money: moneyColumns.has(i) }))));
  return lines.map((line) => line.join("\t")).join("\n");
}

/** An .xlsx Blob with two sheets, Receipts and Line items. */
export async function toXlsx(receipts, copy) {
  const { default: writeXlsxFile } = await import("write-excel-file/universal");
  const sheet = ({ header, rows }, moneyColumns) => [
    header.map((value) => ({ value, fontWeight: "bold" })),
    ...rows.map((row) =>
      row.map((c, i) =>
        c.type === "number"
          ? { type: Number, value: c.value, ...(moneyColumns.has(i) ? { format: "#,##0.00" } : {}) }
          : { type: String, value: c.value }
      )
    ),
  ];
  const receiptsSheet = receiptTable(receipts, copy);
  const items = itemsTable(receipts, copy);
  return writeXlsxFile([
    {
      data: sheet(receiptsSheet, MONEY_COLUMNS),
      sheet: copy.exports.receiptsSheet,
      columns: [28, 20, 12, 10, 12, 10, 12, 16, 16, 30].map((width) => ({ width })),
    },
    {
      data: sheet(items, new Set([4])),
      sheet: copy.exports.itemsSheet,
      columns: [10, 28, 40, 8, 12].map((width) => ({ width })),
    },
  ]).toBlob();
}

export const ITEM_MONEY_COLUMNS = new Set([4]);
