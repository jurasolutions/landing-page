/**
 * The invoice PDF with GST off (ticket 02), and the layout rules that hold
 * either way: A4, pagination at 40 lines, totals kept together, no Jura name
 * (PRD §2 criteria 4, 8; technical.md §6). Ported from the quote builder's
 * quote.test.js. Ticket 03 adds the tax invoice's own checks.
 */
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import { quoteTotals } from "../quote-builder/calc.js";
import { A4 } from "../quote-builder/pdf-geometry.js";
import { solidPng } from "../../../tests/helpers/png.js";
import COPY from "./copy.js";
import { buildInvoicePdf } from "./pdf.js";
import { invoiceOf, item, sampleInvoice } from "./fixtures.js";

const [PAGE_WIDTH, PAGE_HEIGHT] = A4;
const MONEY = /^-?\d{1,3}(,\d{3})*\.\d{2}$/;

const gstOff = (lines, overrides = {}) => {
  const invoice = sampleInvoice(lines, overrides);
  invoice.gst = { ...invoice.gst, on: false };
  return invoice;
};
const build = (invoice, options) => buildInvoicePdf(invoice, quoteTotals(invoice), COPY, options);
const textsOf = (ops) => ops.map((op) => op.text);

describe("the invoice PDF with GST off", () => {
  it("builds a 5-line invoice on one A4 page, titled Invoice in the largest type", async () => {
    const { bytes, ops, pageCount } = await build(gstOff(5));
    expect(pageCount).toBe(1);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([width, height]).toEqual(A4);

    const title = ops.find((op) => op.text === "Invoice");
    expect(title).toBeDefined();
    expect(title.size).toBe(Math.max(...ops.map((op) => op.size)));
    const firstCell = ops.find((op) => op.kind === "cell");
    expect(title.y).toBeGreaterThan(firstCell.y);
  });

  it("prints the business, customer, number, dates and every item", async () => {
    const invoice = gstOff(5);
    const texts = textsOf((await build(invoice)).ops);
    for (const expected of [
      "Tan Brothers Aircon Pte Ltd",
      "10 Ubi Crescent",
      "UEN 201912345K",
      "Tel +65 6123 4567",
      "Email hello@tanbrothers.example",
      "Invoice no.",
      "INV-20261031-01",
      "Date",
      "31 Oct 2026",
      "Due date",
      "30 Nov 2026",
      "Bill to",
      "Harbourfront Dental",
      "Dr Lim",
      "1 Maritime Square, Singapore 099253",
      "Aircon servicing, unit 1",
      "All amounts in SGD",
    ]) {
      expect(texts, expected).toContain(expected);
    }
  });

  it("states no GST, rate or registration number, even with a registration number typed", async () => {
    for (const discount of [false, true]) {
      const invoice = gstOff(5, discount ? { overallDiscount: { type: "percent", value: "5" } } : {});
      expect(invoice.gst.regNo).toBe("M90312345A");
      const { ops, bytes } = await build(invoice);
      for (const op of ops) {
        expect(op.text, op.text).not.toMatch(/tax invoice|GST/i);
        expect(op.text, op.text).not.toContain("M90312345A");
        expect(op.text, op.text).not.toMatch(/\(9%\)/);
      }
      const doc = await PDFDocument.load(bytes, { updateMetadata: false });
      expect(doc.getTitle()).toBe("Invoice INV-20261031-01");
    }
  });

  it("prints the money table's figures, as the totals rows give them", async () => {
    const plain = invoiceOf([item("3", "45.50"), item("2.5", "80")]);
    let texts = textsOf((await build(plain)).ops);
    expect(texts).toEqual(expect.arrayContaining(["136.50", "200.00", "Total", "336.50"]));
    expect(texts).not.toContain("Subtotal");

    const discounted = invoiceOf([item("3", "45.50"), item("2.5", "80")], { overall: { type: "amount", value: "36.50" } });
    texts = textsOf((await build(discounted)).ops);
    expect(texts).toEqual(expect.arrayContaining(["Subtotal", "336.50", "Discount", "-36.50", "Total", "300.00"]));
  });

  it("prints every amount with two decimals and no floating-point artefacts", async () => {
    const invoice = invoiceOf([item("1", "0.10"), item("1", "0.20"), item("3", "19.99"), item("1", "1035.5")], {
      overall: { type: "percent", value: "2.5" },
    });
    const { ops } = await build(invoice);
    const amounts = ops.filter((op) => op.kind === "total" && /\d/.test(op.text)).map((op) => op.text);
    expect(amounts.length).toBeGreaterThan(0);
    for (const amount of amounts) expect(amount).toMatch(MONEY);
    expect(textsOf(ops).join(" ")).not.toMatch(/\d\.\d{3,}/);
  });

  it("prints the payment details and notes after the totals", async () => {
    const invoice = gstOff(3);
    const { ops } = await build(invoice);
    const at = (text) => ops.find((op) => op.text === text);
    const final = ops.filter((op) => op.kind === "total").at(-1);
    expect(at("Payment details").y).toBeLessThan(final.y);
    expect(at("DBS 012-345678-9, PayNow UEN 201912345K").y).toBeLessThan(at("Payment details").y);
    expect(at("Notes").y).toBeLessThan(at("DBS 012-345678-9, PayNow UEN 201912345K").y);
    expect(at("Thank you for your business.")).toBeDefined();
  });

  it("leaves out an empty due date, payment details and notes, labels and all", async () => {
    const invoice = gstOff(2, { payment: "", notes: "  " });
    invoice.details.dueDate = "";
    const texts = textsOf((await build(invoice)).ops);
    for (const label of ["Due date", "Payment details", "Notes"]) expect(texts).not.toContain(label);
  });

  it("prints nothing for an empty business name, never Jura's (decision D2)", async () => {
    const invoice = gstOff(2);
    invoice.business = { name: "", address: "", uen: "", phone: "", email: "", logo: null };
    const { ops } = await build(invoice);
    expect(textsOf(ops).join(" ")).not.toMatch(/jura/i);
    expect(ops.filter((op) => op.size === 12)).toEqual([]);
  });
});

describe("the invoice PDF names nobody but the visitor", () => {
  it("has no Jura name, Made with line or claim about IRAS rules, in the text or the metadata", async () => {
    for (const on of [false, true]) {
      const invoice = sampleInvoice(5);
      invoice.gst.on = on;
      const { ops, bytes } = await build(invoice);
      for (const op of ops) expect(op.text, op.text).not.toMatch(/jura|made with|IRAS|inland revenue|compl(y|ies|iant)|approved/i);
      const doc = await PDFDocument.load(bytes, { updateMetadata: false });
      const meta = [doc.getTitle(), doc.getAuthor(), doc.getCreator(), doc.getProducer(), doc.getSubject(), doc.getKeywords()].join(" ");
      expect(meta).not.toMatch(/jura/i);
      expect(doc.getAuthor()).toBe("Tan Brothers Aircon Pte Ltd");
    }
  });
});

describe("the invoice PDF's pages", () => {
  it("paginates 40 lines cleanly, repeating the column headings", async () => {
    const { bytes, ops, pageCount } = await build(gstOff(40));
    expect(pageCount).toBe(2);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);

    for (const op of ops.filter((o) => o.kind !== "footer")) {
      expect(op.y, op.text).toBeGreaterThanOrEqual(64 - 0.01);
      expect(op.y + op.size, op.text).toBeLessThanOrEqual(PAGE_HEIGHT - 48 + 0.01);
      expect(op.x, op.text).toBeGreaterThanOrEqual(48 - 0.01);
      expect(op.x + op.width, op.text).toBeLessThanOrEqual(PAGE_WIDTH - 48 + 0.01);
    }
    for (const n of [1, 2]) {
      expect(ops.some((o) => o.page === n && o.text === "Description")).toBe(true);
      expect(ops.some((o) => o.page === n && o.text === `Page ${n} of 2`)).toBe(true);
    }
    for (let row = 0; row < 40; row += 1) {
      const pagesOfRow = new Set(ops.filter((o) => o.row === row).map((o) => o.page));
      expect(pagesOfRow.size, `row ${row + 1}`).toBe(1);
    }
    const indexes = ops.filter((o) => o.kind === "cell" && /^\d+$/.test(o.text) && o.x === 48).map((o) => Number(o.text));
    expect(indexes).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });

  it("keeps the totals together on one page, for 28 to 52 two-line rows, GST on and off, with and without a discount", async () => {
    const logo = { bytes: solidPng(1200, 300), kind: "png" };
    for (let lines = 28; lines <= 52; lines += 1) {
      for (const on of [false, true]) {
        for (const discount of [false, true]) {
          const invoice = sampleInvoice(lines, discount ? { overallDiscount: { type: "percent", value: "5" } } : {});
          invoice.gst.on = on;
          invoice.items.forEach((it, i) => {
            it.description = `Aircon general servicing of a wall-mounted fan coil unit, number ${i + 1}`;
          });
          const { ops } = await build(invoice, { logo });
          const totals = ops.filter((o) => o.kind === "total");
          const label = `${lines} lines, GST ${on ? "on" : "off"}, ${discount ? "" : "no "}discount`;
          expect(totals.length, label).toBe((discount ? 2 : 0) * 2 + (on ? 4 : 0) + 2);
          expect(new Set(totals.map((o) => o.page)).size, label).toBe(1);
          for (let row = 0; row < lines; row += 1) {
            expect(new Set(ops.filter((o) => o.row === row).map((o) => o.page)).size, `${label}, row ${row + 1}`).toBe(1);
          }
          for (const op of ops.filter((o) => o.kind !== "footer")) expect(op.y, label).toBeGreaterThanOrEqual(64 - 0.01);
        }
      }
    }
  });

  it("carries a very long description across pages without running off the bottom", async () => {
    const invoice = gstOff(1);
    invoice.items[0].description = Array.from({ length: 120 }, (_, i) => `Line ${i + 1} of the scope of works`).join("\n");
    const { ops, pageCount } = await build(invoice);
    expect(pageCount).toBeGreaterThan(1);
    for (const op of ops.filter((o) => o.kind !== "footer")) expect(op.y).toBeGreaterThanOrEqual(64 - 0.01);
    expect(ops.filter((o) => o.text.startsWith("Line ")).length).toBe(120);
  });

  it("flows long payment details and notes onto a new page instead of off the bottom", async () => {
    const invoice = gstOff(30);
    invoice.payment = Array.from({ length: 30 }, (_, i) => `Payment line ${i + 1}`).join("\n");
    invoice.notes = Array.from({ length: 30 }, (_, i) => `Note line ${i + 1}`).join("\n");
    const { ops, pageCount } = await build(invoice);
    expect(pageCount).toBeGreaterThan(1);
    for (const op of ops.filter((o) => o.kind !== "footer")) expect(op.y).toBeGreaterThanOrEqual(64 - 0.01);
    expect(ops.filter((o) => o.text.startsWith("Payment line ")).length).toBe(30);
    expect(ops.filter((o) => o.text.startsWith("Note line ")).length).toBe(30);
  });

  it("prints wide and square logos inside the logo box", async () => {
    for (const [w, h] of [
      [1200, 300],
      [400, 400],
    ]) {
      const { ops } = await build(gstOff(2), { logo: { bytes: solidPng(w, h), kind: "png" } });
      const logo = ops.find((o) => o.kind === "logo");
      expect(logo.width).toBeLessThanOrEqual(170 + 1e-9);
      expect(logo.height).toBeLessThanOrEqual(56 + 1e-9);
      expect(Math.max(logo.width / 170, logo.height / 56)).toBeCloseTo(1, 5);
    }
  });

  it("leaves out characters it cannot print instead of failing", async () => {
    const invoice = gstOff(2);
    invoice.customer.company = "陈记 Trading";
    invoice.items[0].description = "Install ✓ done";
    const { ops } = await build(invoice);
    expect(ops.some((o) => o.text.includes("Trading"))).toBe(true);
    expect(ops.some((o) => /[陈记✓]/.test(o.text))).toBe(false);
  });

  it("is readable by a second, independent PDF parser (pdf.js)", async () => {
    const { bytes, ops, pageCount } = await build(gstOff(40), { logo: { bytes: solidPng(300, 100), kind: "png" } });
    const pdf = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true }).promise;
    expect(pdf.numPages).toBe(pageCount);
    const first = await pdf.getPage(1);
    expect(first.view.map(Math.round)).toEqual([0, 0, 595, 842]);
    const text = (await first.getTextContent()).items.map((i) => i.str).join(" ");
    expect(text).toContain("Invoice");
    expect(text).not.toMatch(/tax invoice/i);
    expect(text).toContain("Harbourfront Dental");
    // The totals sit after the last row; the notes may flow on to a page of their own.
    const totalsPage = ops.find((o) => o.kind === "total").page;
    expect(totalsPage).toBe(ops.find((o) => o.row === 39).page);
    const totalsText = await (await pdf.getPage(totalsPage)).getTextContent();
    expect(totalsText.items.map((i) => i.str).join(" ")).toContain("Total");
  });
});
