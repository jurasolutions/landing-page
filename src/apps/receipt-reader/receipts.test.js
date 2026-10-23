import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import COPY from "./copy.js";
import { fromApi, itemsMismatch, toCents } from "./model.js";
import { itemsTable, receiptTable, toCsv, toTsv, toXlsx } from "./exports.js";
import { fitLongEdge, kindOf } from "./prepare.js";

const API_RECEIPT = {
  is_receipt: true,
  merchant: "FairPrice Finest",
  merchant_id: "M2-0012345-6",
  date: "2026-10-20",
  currency: "SGD",
  subtotal: 18.35,
  gst: 1.65,
  total: 20,
  payment_method: "NETS",
  items: [
    { description: "Milk 1L", quantity: 2, amount: 6.4 },
    { description: "Bread, wholemeal", quantity: 1, amount: 13.6 },
  ],
  notes: null,
};

describe("receipts from the server", () => {
  it("become editable text, amounts to two decimals", () => {
    const r = fromApi(API_RECEIPT);
    expect(r).toMatchObject({ merchant: "FairPrice Finest", total: "20.00", gst: "1.65", category: "", notes: "" });
    expect(r.items[0]).toMatchObject({ description: "Milk 1L", quantity: "2", amount: "6.40" });
  });

  it("read money without floats", () => {
    expect(toCents("20.00")).toBe(2000);
    expect(toCents("1,234.5")).toBe(123450);
    expect(toCents("-1.50")).toBe(-150);
    expect(toCents("S$3")).toBe(300);
    expect(toCents("")).toBe(null);
    expect(toCents("abc")).toBe(null);
  });
});

describe("the add-up check", () => {
  it("passes when items match the total, the subtotal, or the total less GST", () => {
    expect(itemsMismatch(fromApi(API_RECEIPT))).toBe(false);
    expect(itemsMismatch(fromApi({ ...API_RECEIPT, items: [{ description: "x", quantity: 1, amount: 18.35 }] }))).toBe(false);
  });

  it("flags items that add up to none of them", () => {
    const off = fromApi({ ...API_RECEIPT, items: [{ description: "x", quantity: 1, amount: 5 }] });
    expect(itemsMismatch(off)).toBe(true);
  });

  it("follows the visitor's edits", () => {
    const r = fromApi(API_RECEIPT);
    r.items[1].amount = "12.60";
    expect(itemsMismatch(r)).toBe(true);
    r.total = "19.00";
    expect(itemsMismatch(r)).toBe(false);
  });

  it("stays quiet with no items, no total, or not a receipt", () => {
    expect(itemsMismatch(fromApi({ ...API_RECEIPT, items: [] }))).toBe(false);
    expect(itemsMismatch(fromApi({ ...API_RECEIPT, total: null }))).toBe(false);
    expect(itemsMismatch(fromApi({ ...API_RECEIPT, is_receipt: false }))).toBe(false);
  });
});

describe("exports", () => {
  const receipts = [
    fromApi(API_RECEIPT),
    fromApi({ ...API_RECEIPT, merchant: '=HYPERLINK("https://evil.example","click")', notes: 'Said "thanks", twice\nnew line' }),
    fromApi({ ...API_RECEIPT, is_receipt: false, merchant: null }),
  ];
  receipts[0].category = "Supplies";

  it("CSV: UTF-8 BOM, CRLF, quoted where needed, amounts as numbers, not-a-receipt rows left out", () => {
    const csv = toCsv(receiptTable(receipts, COPY));
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Merchant,UEN or GST reg. no.,Date,Currency,Subtotal,GST,Total,Payment method,Category,Notes");
    expect(lines[1]).toBe("FairPrice Finest,M2-0012345-6,2026-10-20,SGD,18.35,1.65,20.00,NETS,Supplies,");
    expect(lines).toHaveLength(4); // header, two receipts, trailing empty
  });

  it("CSV and copied text defuse spreadsheet formulas from receipt text", () => {
    const csv = toCsv(receiptTable(receipts, COPY));
    expect(csv).toContain(`"'=HYPERLINK(""https://evil.example"",""click"")"`);
    expect(csv).toContain('"Said ""thanks"", twice\nnew line"');
    const tsv = toTsv(receiptTable(receipts, COPY));
    expect(tsv.split("\n")[2].startsWith("'=HYPERLINK")).toBe(true);
    expect(tsv.split("\n")).toHaveLength(3);
    expect(tsv.split("\n")[1].split("\t")).toHaveLength(10);
  });

  it("line items carry their receipt number", () => {
    const { header, rows } = itemsTable(receipts, COPY);
    expect(header).toEqual(["Receipt", "Merchant", "Description", "Qty", "Amount"]);
    expect(rows).toHaveLength(4);
    expect(rows[0].map((c) => c.value)).toEqual([1, "FairPrice Finest", "Milk 1L", 2, 6.4]);
  });

  it("Excel: a valid .xlsx with Receipts and Line items sheets and numeric amounts", async () => {
    const blob = await toXlsx(receipts, COPY);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]));
    const workbook = strFromU8(files["xl/workbook.xml"]);
    expect(workbook).toContain('name="Receipts"');
    expect(workbook).toContain('name="Line items"');
    const sheet1 = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(sheet1).toMatch(/<v>18\.35<\/v>/);
    expect(sheet1).toMatch(/<v>20<\/v>/);
    // Receipt text is stored as text, never as a formula.
    expect(sheet1).not.toContain("<f>");
    const strings = files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]) : sheet1;
    expect(strings).toContain("FairPrice Finest");
    expect(strings).toContain("=HYPERLINK");
  });
});

describe("file preparation rules", () => {
  it("recognises HEIC, PDF and images by type or name", () => {
    expect(kindOf({ name: "IMG_0001.HEIC", type: "" })).toBe("heic");
    expect(kindOf({ name: "x", type: "image/heif" })).toBe("heic");
    expect(kindOf({ name: "receipt.pdf", type: "application/pdf" })).toBe("pdf");
    expect(kindOf({ name: "a.jpg", type: "image/jpeg" })).toBe("image");
    expect(kindOf({ name: "a.webp", type: "" })).toBe("image");
    expect(kindOf({ name: "a.gif", type: "image/gif" })).toBe(null);
  });

  it("resizes to a 1600 px long edge and never enlarges", () => {
    expect(fitLongEdge(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitLongEdge(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitLongEdge(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
