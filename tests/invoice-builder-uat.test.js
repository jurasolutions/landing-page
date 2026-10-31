/**
 * The UAT script's figures and PDFs (.scratch/invoice-builder/reviews/uat.md),
 * computed through the real code: the shared `quoteTotals`, the invoice's
 * totals rows, the preview, `buildInvoicePdf`, and a quote file written by
 * the quote builder's own `serialiseQuote` (PRD §2 criteria 1 to 8, §5.4).
 *
 * Each PDF is read back with pdf.js: its title, the IRAS rows, the page count,
 * the A4 page size and the totals on one page.
 *
 * Set QA_PDF_DIR to a folder to also write the PDFs there for the manual
 * viewer check (QA writes them to .scratch/invoice-builder/qa/, which git
 * ignores). Without it, nothing is written.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import { quoteTotals } from "../src/apps/quote-builder/calc.js";
import { serialiseQuote } from "../src/apps/quote-builder/quoteFile.js";
import { newQuote } from "../src/apps/quote-builder/model.js";
import COPY from "../src/apps/invoice-builder/copy.js";
import { buildInvoicePdf } from "../src/apps/invoice-builder/pdf.js";
import { invoiceTotalsRows } from "../src/apps/invoice-builder/totals-rows.js";
import { InvoicePreview } from "../src/apps/invoice-builder/InvoicePreview.jsx";
import { missingFields } from "../src/apps/invoice-builder/required.js";
import { newInvoice } from "../src/apps/invoice-builder/model.js";
import { openAnyFile, parseInvoiceFile, serialiseInvoice } from "../src/apps/invoice-builder/invoiceFile.js";

const OUT = process.env.QA_PDF_DIR;
const A4_PT = [595.28, 841.89];
const MONEY = /^-?\d{1,3}(,\d{3})*\.\d{2}$/;
const decode = (s) => s.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

// ---- UAT data sets B and C, invoice A, invoice P ----

const line = (description, quantity, unit, unitPrice, discountType = "none", discountValue = "") => ({
  id: `uat-${description}`,
  description,
  quantity,
  unit,
  unitPrice,
  discountType,
  discountValue,
});

function uatInvoice(items, { gst = true, overall = { type: "none", value: "" } } = {}) {
  const invoice = newInvoice({ today: "2026-10-31" });
  invoice.business = {
    name: "Sample Aircon Services Pte. Ltd.",
    address: "10 Example Road, #01-01, Singapore 123456",
    uen: "202600000A",
    phone: "6123 4567",
    email: "accounts@example.com",
    logo: null,
  };
  invoice.customer = {
    company: "Sample Condo MCST 0000",
    contact: "Alex Tan",
    address: "1 Sample Avenue, Singapore 654321",
    email: "office@example.com",
  };
  invoice.details = { number: "INV-20261031-01", date: "2026-10-31", dueDate: "2026-11-30" };
  invoice.items = items;
  invoice.overallDiscount = overall;
  // The registration number stays typed with GST off too (UAT scenario 2).
  invoice.gst = { on: gst, rate: "9", regNo: "M2-0000000-0" };
  invoice.payment = "Bank transfer to Example Bank 123-456789-0, or PayNow to UEN 202600000A";
  invoice.notes = "Thank you for your business.";
  return invoice;
}

const invoiceA = (gst) =>
  uatInvoice(
    [
      line("Aircon general servicing", "4", "units", "45.00"),
      line("Chemical overhaul", "1", "unit", "150.00", "percent", "10"),
      line("Gas top-up R32", "2", "units", "80.00", "amount", "20.00"),
      line("Labour", "2.5", "hours", "60.00"),
      line("Copper piping", "3.5", "m", "18.50"),
    ],
    { gst, overall: { type: "percent", value: "5" } }
  );

const invoiceP = () =>
  uatInvoice(Array.from({ length: 40 }, (_, i) => line(`Part ${i + 1}`, "1", "", "10.00")));

/** The totals block as the visitor reads it: [label, value] in order, final line last. */
const printedTotals = (invoice) => {
  const { rows, final } = invoiceTotalsRows(invoice, quoteTotals(invoice), COPY);
  return [...rows, final].map(({ label, value }) => [label, value]);
};

const preview = (invoice) =>
  decode(renderToStaticMarkup(React.createElement(InvoicePreview, { invoice, totals: quoteTotals(invoice), copy: COPY })));

/** Builds the PDF and reads it back with pdf.js. */
async function readPdf(invoice, name) {
  const built = await buildInvoicePdf(invoice, quoteTotals(invoice), COPY);
  if (OUT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, name), built.bytes);
  }
  const pdf = await pdfjs.getDocument({ data: built.bytes.slice(), isEvalSupported: false, disableFontFace: true }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const { width, height } = page.getViewport({ scale: 1 });
    const items = (await page.getTextContent()).items.filter((i) => i.str.trim());
    pages.push({ width, height, items, text: items.map((i) => i.str).join(" ") });
  }
  const { info } = await pdf.getMetadata();
  return { built, pdf, pages, info, all: pages.map((p) => p.text).join(" ") };
}

/** The page numbers on which each text appears in the pdf.js read. */
const pagesWith = (read, text) => read.pages.flatMap((p, i) => (p.items.some((it) => it.str === text) ? [i + 1] : []));

/**
 * The value printed on the same baseline as `label`, at the right. Takes the
 * last such label, because the totals come after the table's headings (which
 * also say "Discount").
 */
function valueBeside(read, label) {
  for (const page of [...read.pages].reverse()) {
    const found = page.items.findLast((i) => i.str === label);
    if (!found) continue;
    const y = found.transform[5];
    const beside = page.items.filter((i) => i !== found && Math.abs(i.transform[5] - y) < 0.5 && i.transform[4] > found.transform[4]);
    return beside.map((i) => i.str).join(" ");
  }
  return undefined;
}

const IRAS = (invoice) => [
  "Tax invoice",
  invoice.business.name,
  invoice.business.address,
  `GST reg. no. ${invoice.gst.regNo}`,
  invoice.details.number,
  "31 Oct 2026",
  invoice.customer.company,
  invoice.customer.address,
  ...invoice.items.map((i) => i.description),
  "GST (9%)",
  "Amount before GST",
  "Amount with GST",
];

// ---- Figures ----

describe("UAT figures, through the real code", () => {
  it("invoice A with GST on: 669.75, -33.49, 636.26, 57.26, 693.52", () => {
    const invoice = invoiceA(true);
    const totals = quoteTotals(invoice);
    expect(totals.lines.map((l) => l.total)).toEqual([18000n, 13500n, 14000n, 15000n, 6475n]);
    expect(printedTotals(invoice)).toEqual([
      ["Subtotal", "669.75"],
      ["Discount", "-33.49"],
      ["Amount before GST", "636.26"],
      ["GST (9%)", "57.26"],
      ["Amount with GST", "693.52"],
    ]);
    expect(totals.taxable + totals.gst).toBe(totals.total);
  });

  it("invoice A with GST off: 669.75, -33.49, Total 636.26, and no GST row", () => {
    expect(printedTotals(invoiceA(false))).toEqual([
      ["Subtotal", "669.75"],
      ["Discount", "-33.49"],
      ["Total", "636.26"],
    ]);
  });

  it("the half-cent tie: 150.50 at 9% gives GST 13.55 and 164.05 (13.54 is a fail)", () => {
    const invoice = uatInvoice([line("Call-out fee", "1", "", "150.50")]);
    const totals = quoteTotals(invoice);
    expect(totals.gst).toBe(1355n);
    expect(printedTotals(invoice)).toEqual([
      ["Amount before GST", "150.50"],
      ["GST (9%)", "13.55"],
      ["Amount with GST", "164.05"],
    ]);
    expect(preview(invoice)).toContain("13.55");
    expect(preview(invoice)).toContain("164.05");
  });

  it("GST is rounded once on the total: three 10.50 lines give 2.84 and 34.34 (2.85 is a fail)", () => {
    const invoice = uatInvoice([1, 2, 3].map((n) => ({ ...line("Filter", "1", "", "10.50"), id: `f${n}` })));
    expect(printedTotals(invoice)).toEqual([
      ["Amount before GST", "31.50"],
      ["GST (9%)", "2.84"],
      ["Amount with GST", "34.34"],
    ]);
  });

  it("3 x 0.10 shows 0.30, with no long decimals in the preview", () => {
    const invoice = uatInvoice([line("Washers", "3", "", "0.10")], { gst: false });
    const markup = preview(invoice);
    expect(markup).toContain("0.30");
    expect(markup).not.toMatch(/\d\.\d{3,}/);
  });

  it("invoice P (40 lines): 400.00, 36.00, 436.00", () => {
    expect(printedTotals(invoiceP())).toEqual([
      ["Amount before GST", "400.00"],
      ["GST (9%)", "36.00"],
      ["Amount with GST", "436.00"],
    ]);
  });

  it("the preview shows the same title and totals as the PDF, for invoice A both ways", () => {
    for (const gst of [true, false]) {
      const invoice = invoiceA(gst);
      const markup = preview(invoice);
      expect(markup).toContain(gst ? "Tax invoice" : "Invoice");
      for (const [label, value] of printedTotals(invoice)) {
        expect(markup).toContain(label);
        expect(markup).toContain(value);
      }
      if (!gst) {
        expect(markup).not.toMatch(/tax invoice/i);
        expect(markup).not.toContain("M2-0000000-0");
        expect(markup).not.toMatch(/GST/);
      }
    }
  });
});

// ---- PDFs, read back with pdf.js ----

describe("UAT PDFs, built by buildInvoicePdf and read with pdf.js", () => {
  it("invoice A with GST on: a one-page A4 tax invoice with every IRAS item and the UAT figures", async () => {
    const invoice = invoiceA(true);
    const read = await readPdf(invoice, "uat-invoice-A-gst-on.pdf");
    expect(read.pdf.numPages).toBe(1);
    expect(read.built.pageCount).toBe(1);
    for (const page of read.pages) {
      expect(page.width).toBeCloseTo(A4_PT[0], 1);
      expect(page.height).toBeCloseTo(A4_PT[1], 1);
    }
    expect(read.info.Title).toBe("Tax invoice INV-20261031-01");
    expect(read.info.Author).toBe("Sample Aircon Services Pte. Ltd.");
    for (const wanted of IRAS(invoice)) expect(read.all, wanted).toContain(wanted);
    // The title is the largest text on the page.
    const title = read.pages[0].items.find((i) => i.str === "Tax invoice");
    const sizes = read.pages[0].items.map((i) => Math.abs(i.transform[3]));
    expect(Math.abs(title.transform[3])).toBe(Math.max(...sizes));
    expect(valueBeside(read, "Subtotal")).toBe("669.75");
    expect(valueBeside(read, "Discount")).toBe("-33.49");
    expect(valueBeside(read, "Amount before GST")).toBe("636.26");
    expect(valueBeside(read, "GST (9%)")).toBe("57.26");
    expect(valueBeside(read, "Amount with GST")).toBe("693.52");
    expect(read.all).not.toMatch(/jura|made with|IRAS|inland revenue/i);
  });

  it("invoice A with GST off: titled Invoice, total 636.26, with no GST, rate or registration number", async () => {
    const read = await readPdf(invoiceA(false), "uat-invoice-A-gst-off.pdf");
    expect(read.pdf.numPages).toBe(1);
    expect(read.pages[0].width).toBeCloseTo(A4_PT[0], 1);
    expect(read.pages[0].height).toBeCloseTo(A4_PT[1], 1);
    expect(read.info.Title).toBe("Invoice INV-20261031-01");
    expect(read.pages[0].items.some((i) => i.str === "Invoice")).toBe(true);
    expect(valueBeside(read, "Total")).toBe("636.26");
    expect(read.all).not.toMatch(/tax invoice/i);
    expect(read.all).not.toMatch(/GST/);
    expect(read.all).not.toContain("M2-0000000-0");
    expect(read.all).not.toMatch(/9\s*%/);
    expect(read.all).not.toMatch(/jura|made with/i);
  });

  it("invoice P (40 lines): A4 pages, each with headings and Page n of N, rows 1 to 40 once, totals on one page", async () => {
    const read = await readPdf(invoiceP(), "uat-invoice-P-40-lines.pdf");
    const n = read.pdf.numPages;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(read.built.pageCount).toBe(n);
    read.pages.forEach((page, i) => {
      expect(page.width).toBeCloseTo(A4_PT[0], 1);
      expect(page.height).toBeCloseTo(A4_PT[1], 1);
      expect(page.text, `page ${i + 1}`).toContain(`Page ${i + 1} of ${n}`);
      expect(page.items.some((it) => it.str === "Description"), `headings on page ${i + 1}`).toBe(true);
    });
    for (let part = 1; part <= 40; part += 1) {
      expect(pagesWith(read, `Part ${part}`), `Part ${part}`).toHaveLength(1);
    }
    const totalsPages = new Set(["Amount before GST", "GST (9%)", "Amount with GST"].flatMap((t) => pagesWith(read, t)));
    expect(totalsPages.size).toBe(1);
    expect(valueBeside(read, "Amount before GST")).toBe("400.00");
    expect(valueBeside(read, "GST (9%)")).toBe("36.00");
    expect(valueBeside(read, "Amount with GST")).toBe("436.00");
    expect(read.pages[0].text).toContain("Tax invoice");
  });

  it("every amount drawn in the three PDFs is a clean two-decimal figure", async () => {
    for (const invoice of [invoiceA(true), invoiceA(false), invoiceP()]) {
      const { ops } = await buildInvoicePdf(invoice, quoteTotals(invoice), COPY);
      const money = ops.filter((op) => op.kind === "total" && !/[A-Za-z]/.test(op.text)).map((op) => op.text);
      expect(money.length).toBeGreaterThan(0);
      for (const text of money) expect(text).toMatch(MONEY);
      expect(ops.map((op) => op.text).join(" ")).not.toMatch(/\d\.\d{3,}/);
    }
  });
});

// ---- Quote Q, saved by the quote builder, opened into an invoice ----

function quoteQ(inclusive) {
  const quote = newQuote({ today: "2026-10-31" });
  quote.customer = {
    company: "Sample Condo MCST 0000",
    contact: "Alex Tan",
    address: "1 Sample Avenue, Singapore 654321",
    email: "office@example.com",
  };
  quote.items = [
    line("Site visit and measurement", "1", "visit", "200.00"),
    line("Planter box 200 x 100 x 70 cm", "2", "pcs", "350.00", "percent", "10"),
    line("Installation", "1", "job", "200.00", "amount", "50.00"),
  ];
  quote.overallDiscount = { type: "amount", value: "30.00" };
  quote.gst = { on: true, rate: "9", regNo: "", inclusive };
  quote.notes = "Delivery within 14 days of confirmation.";
  return serialiseQuote(quote);
}

describe("UAT quote Q, saved by serialiseQuote and opened into an invoice", () => {
  it.each([false, true])("opens with the customer, items, discounts, notes and GST on (prices include GST: %s)", (inclusive) => {
    const page = uatInvoice([line("Old line", "1", "", "1.00")]);
    const frozen = structuredClone(page);
    const result = openAnyFile(quoteQ(inclusive), page);
    expect(result.ok).toBe(true);
    expect(result.kind).toBe("quote");
    expect(result.pricesIncludedGst).toBe(inclusive);
    const { invoice } = result;
    expect(invoice.customer).toEqual(frozen.customer);
    expect(invoice.items.map(({ id, ...rest }) => rest)).toEqual([
      { description: "Site visit and measurement", quantity: "1", unit: "visit", unitPrice: "200.00", discountType: "none", discountValue: "" },
      { description: "Planter box 200 x 100 x 70 cm", quantity: "2", unit: "pcs", unitPrice: "350.00", discountType: "percent", discountValue: "10" },
      { description: "Installation", quantity: "1", unit: "job", unitPrice: "200.00", discountType: "amount", discountValue: "50.00" },
    ]);
    expect(invoice.overallDiscount).toEqual({ type: "amount", value: "30.00" });
    expect(invoice.notes).toBe("Delivery within 14 days of confirmation.");
    expect(invoice.gst).toEqual({ on: true, rate: "9", regNo: "M2-0000000-0" });
    // The page's business, number, dates and payment details stay.
    expect(invoice.business).toEqual(frozen.business);
    expect(invoice.details).toEqual(frozen.details);
    expect(invoice.payment).toBe(frozen.payment);
    expect(page).toEqual(frozen);
    expect(printedTotals(invoice)).toEqual([
      ["Subtotal", "980.00"],
      ["Discount", "-30.00"],
      ["Amount before GST", "950.00"],
      ["GST (9%)", "85.50"],
      ["Amount with GST", "1,035.50"],
    ]);
    expect(missingFields(invoice, quoteTotals(invoice))).toEqual([]);
  });

  it("downloads as a tax invoice showing Amount with GST 1,035.50", async () => {
    const { invoice } = openAnyFile(quoteQ(false), uatInvoice([]));
    const read = await readPdf(invoice, "uat-quote-Q-as-invoice.pdf");
    expect(read.pages[0].text).toContain("Tax invoice");
    expect(valueBeside(read, "Amount with GST")).toBe("1,035.50");
    expect(read.all).not.toMatch(/valid until/i);
  });

  it("a saved invoice A re-opens to an identical invoice, and an identical PDF text", async () => {
    const invoice = invoiceA(true);
    const reopened = parseInvoiceFile(serialiseInvoice(invoice));
    expect(reopened.ok).toBe(true);
    const strip = (inv) => ({ ...inv, items: inv.items.map(({ id, ...rest }) => rest) });
    expect(strip(reopened.invoice)).toEqual(strip(invoice));
    const texts = async (inv) => (await buildInvoicePdf(inv, quoteTotals(inv), COPY)).ops.map((op) => op.text);
    expect(await texts(reopened.invoice)).toEqual(await texts(invoice));
  });
});
