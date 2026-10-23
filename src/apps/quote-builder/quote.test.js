import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import COPY from "./copy.js";
import { quoteTotals } from "./calc.js";
import { addDays, displayDate, newQuote, suggestNumber, DEFAULT_GST_RATE } from "./model.js";
import { FILE_FORMAT, parseQuoteFile, readBusiness, serialiseQuote } from "./quoteFile.js";
import { toPrintable, unprintableIn } from "./winansi.js";
import { A4, buildQuotePdf, fitLogo } from "./pdf.js";
import { solidPng } from "../../../tests/helpers/png.js";

const withoutIds = (quote) => ({ ...quote, items: quote.items.map(({ id, ...rest }) => rest) });

function sampleQuote(lines = 5, overrides = {}) {
  const quote = newQuote({ today: "2026-10-24" });
  quote.business = {
    name: "Tan Brothers Aircon Pte Ltd",
    address: "10 Ubi Crescent\n#05-12 Ubi Techpark\nSingapore 408564",
    uen: "201912345K",
    phone: "+65 6123 4567",
    email: "hello@tanbrothers.example",
    logo: null,
  };
  quote.customer = {
    company: "Harbourfront Dental",
    contact: "Dr Lim",
    address: "1 Maritime Square, Singapore 099253",
    email: "admin@harbourfront.example",
  };
  quote.items = Array.from({ length: lines }, (_, i) => ({
    id: `item-${i}`,
    description: i % 7 === 3 ? "Chemical overhaul of a ceiling cassette unit, including coil cleaning and drain flush" : `Aircon servicing, unit ${i + 1}`,
    quantity: String((i % 3) + 1),
    unit: i % 2 ? "units" : "",
    unitPrice: "45.50",
    discountType: i === 1 ? "percent" : i === 2 ? "amount" : "none",
    discountValue: i === 1 ? "10" : i === 2 ? "5" : "",
  }));
  quote.gst = { on: true, rate: "9", regNo: "M90312345A" };
  return Object.assign(quote, overrides);
}

describe("the default GST rate", () => {
  it("is the IRAS standard rate checked on build day, and GST is off by default", () => {
    expect(DEFAULT_GST_RATE).toBe("9");
    expect(newQuote().gst).toEqual({ on: false, rate: "9", regNo: "" });
  });
});

describe("quote numbers and dates", () => {
  it("suggests Q-YYYYMMDD-01 and counts up on the same day", () => {
    expect(suggestNumber("2026-10-24")).toBe("Q-20261024-01");
    expect(suggestNumber("2026-10-24", "Q-20261024-01")).toBe("Q-20261024-02");
    expect(suggestNumber("2026-10-25", "Q-20261024-07")).toBe("Q-20261025-01");
    expect(suggestNumber("2026-10-24", "my own number")).toBe("Q-20261024-01");
  });

  it("is valid for 30 days by default", () => {
    const quote = newQuote({ today: "2026-10-24" });
    expect(quote.details.validUntil).toBe("2026-11-23");
    expect(addDays("2026-12-15", 30)).toBe("2027-01-14");
    expect(displayDate("2026-10-24")).toBe("24 Oct 2026");
    expect(displayDate("")).toBe("");
  });
});

describe("the saved quote file", () => {
  it("re-opens to an identical quote", () => {
    const quote = sampleQuote(6);
    quote.business.logo = { dataUrl: `data:image/png;base64,${Buffer.from(solidPng(40, 20)).toString("base64")}`, width: 40, height: 20 };
    quote.overallDiscount = { type: "percent", value: "2.5" };
    quote.madeWith = false;
    const file = serialiseQuote(quote);
    expect(JSON.parse(file)).toMatchObject({ format: FILE_FORMAT, version: 1 });

    const opened = parseQuoteFile(file);
    expect(opened.ok).toBe(true);
    expect(withoutIds(opened.quote)).toEqual(withoutIds(quote));
    expect(quoteTotals(opened.quote).total).toBe(quoteTotals(quote).total);
  });

  it.each([
    ["not JSON", "hello"],
    ["another app's JSON", JSON.stringify({ invoices: [] })],
    ["the wrong format marker", JSON.stringify({ format: "something-else", version: 1, quote: {} })],
    ["a newer version", JSON.stringify({ format: FILE_FORMAT, version: 99, quote: {} })],
    ["items that are not a list", JSON.stringify({ format: FILE_FORMAT, version: 1, quote: { items: "x" } })],
    [
      "a logo that is not an image",
      JSON.stringify({
        format: FILE_FORMAT,
        version: 1,
        quote: { items: [], business: { logo: { dataUrl: "data:text/html;base64,PHNjcmlwdD4=", width: 1, height: 1 } } },
      }),
    ],
    [
      "a field far too long",
      JSON.stringify({ format: FILE_FORMAT, version: 1, quote: { items: [], notes: "x".repeat(5000) } }),
    ],
  ])("refuses %s", (_, contents) => {
    expect(parseQuoteFile(contents)).toEqual({ ok: false });
  });

  it("reads remembered business details and ignores junk", () => {
    expect(readBusiness({ name: "Tan", address: "1 Road" })).toMatchObject({ name: "Tan", address: "1 Road", logo: null });
    expect(readBusiness({ name: 42 })).toBe(null);
  });
});

describe("characters the PDF cannot print", () => {
  it("are listed for the form and left out of the PDF", () => {
    expect(unprintableIn(["陈记 Trading", "Café ✓", "m² and €5 – “quoted”"])).toEqual(["陈", "记", "✓"]);
    expect(toPrintable("陈记 Trading")).toBe(" Trading");
    expect(toPrintable("Café – “quoted” m² €")).toBe("Café – “quoted” m² €");
    expect(toPrintable("ＡＢＣ１２３")).toBe("ABC123"); // full-width input
  });
});

describe("the PDF", () => {
  it("builds a 5-line quote with GST on, on one A4 page", async () => {
    const quote = sampleQuote(5);
    const { bytes, ops, pageCount } = await buildQuotePdf(quote, quoteTotals(quote), COPY);
    expect(pageCount).toBe(1);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([width, height]).toEqual(A4);
    const texts = ops.map((op) => op.text);
    expect(texts).toContain("Quotation");
    expect(texts).toContain("GST (9%)");
    expect(texts).toContain("GST reg. no. M90312345A");
    expect(texts).toContain("Made with jurasolutions.sg/apps");
    expect(texts.join(" ")).not.toMatch(/tax invoice/i);
  });

  it("paginates 40 lines cleanly, repeating the column headings", async () => {
    const quote = sampleQuote(40);
    const { bytes, ops, pageCount } = await buildQuotePdf(quote, quoteTotals(quote), COPY);
    expect(pageCount).toBe(2);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
    expect(ops.filter((o) => o.kind === "cell").length).toBeGreaterThan(40 * 4);

    const [pageWidth, pageHeight] = A4;
    for (const op of ops.filter((o) => o.kind !== "footer")) {
      expect(op.y, op.text).toBeGreaterThanOrEqual(64 - 0.01);
      expect(op.y + op.size, op.text).toBeLessThanOrEqual(pageHeight - 48 + 0.01);
      expect(op.x, op.text).toBeGreaterThanOrEqual(48 - 0.01);
      expect(op.x + op.width, op.text).toBeLessThanOrEqual(pageWidth - 48 + 0.01);
    }
    for (const n of [1, 2]) {
      expect(ops.some((o) => o.page === n && o.text === "Description")).toBe(true);
      expect(ops.some((o) => o.page === n && o.text === `Page ${n} of 2`)).toBe(true);
    }
    // No row is split across two pages.
    for (let row = 0; row < 40; row += 1) {
      const pagesOfRow = new Set(ops.filter((o) => o.row === row).map((o) => o.page));
      expect(pagesOfRow.size, `row ${row + 1}`).toBe(1);
    }
    // Every one of the 40 rows is numbered once, in order.
    const indexes = ops.filter((o) => /^\d+$/.test(o.text) && o.x === 48).map((o) => Number(o.text));
    expect(indexes).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });

  it("keeps two-line rows whole at every page break", async () => {
    for (const lines of [30, 40, 47]) {
      const quote = sampleQuote(lines);
      quote.items.forEach((item, i) => {
        item.description = `Aircon general servicing of a wall-mounted fan coil unit, number ${i + 1}`;
      });
      const { ops, pageCount } = await buildQuotePdf(quote, quoteTotals(quote), COPY, {
        logo: { bytes: solidPng(400, 400), kind: "png" },
      });
      expect(pageCount).toBeGreaterThan(1);
      for (let row = 0; row < lines; row += 1) {
        const pagesOfRow = new Set(ops.filter((o) => o.row === row).map((o) => o.page));
        expect(pagesOfRow.size, `${lines} lines, row ${row + 1}`).toBe(1);
      }
    }
  });

  it("carries a very long description across pages without running off the bottom", async () => {
    const quote = sampleQuote(1);
    quote.items[0].description = Array.from({ length: 120 }, (_, i) => `Line ${i + 1} of the scope of works`).join("\n");
    const { ops, pageCount } = await buildQuotePdf(quote, quoteTotals(quote), COPY);
    expect(pageCount).toBeGreaterThan(1);
    for (const op of ops.filter((o) => o.kind !== "footer")) expect(op.y).toBeGreaterThanOrEqual(64 - 0.01);
    expect(ops.filter((o) => o.text.startsWith("Line ")).length).toBe(120);
  });

  it("prints wide and square logos at a sensible size", async () => {
    expect(fitLogo(1200, 300)).toEqual({ width: 170, height: 42.5 });
    expect(fitLogo(500, 500)).toEqual({ width: 56, height: 56 });
    expect(fitLogo(40, 40)).toEqual({ width: 56, height: 56 });

    for (const [w, h] of [
      [1200, 300],
      [400, 400],
    ]) {
      const quote = sampleQuote(2);
      const { ops } = await buildQuotePdf(quote, quoteTotals(quote), COPY, { logo: { bytes: solidPng(w, h), kind: "png" } });
      const logo = ops.find((o) => o.kind === "logo");
      expect(logo.width).toBeLessThanOrEqual(170 + 1e-9);
      expect(logo.height).toBeLessThanOrEqual(56 + 1e-9);
      expect(Math.max(logo.width / 170, logo.height / 56)).toBeCloseTo(1, 5);
    }
  });

  it("leaves the Made with line off when the visitor switches it off", async () => {
    const quote = sampleQuote(2, { madeWith: false });
    const { ops } = await buildQuotePdf(quote, quoteTotals(quote), COPY);
    expect(ops.some((o) => o.text.includes("jurasolutions"))).toBe(false);
  });

  it("leaves out characters it cannot print instead of failing", async () => {
    const quote = sampleQuote(2);
    quote.business.name = "陈记 Trading";
    quote.items[0].description = "Install ✓ done";
    const { ops } = await buildQuotePdf(quote, quoteTotals(quote), COPY);
    expect(ops.some((o) => o.text.includes("Trading"))).toBe(true);
    expect(ops.some((o) => /[陈记✓]/.test(o.text))).toBe(false);
  });

  it("is readable by a second, independent PDF parser (pdf.js)", async () => {
    const quote = sampleQuote(40);
    const { bytes, pageCount } = await buildQuotePdf(quote, quoteTotals(quote), COPY, {
      logo: { bytes: solidPng(300, 100), kind: "png" },
    });
    const pdf = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true }).promise;
    expect(pdf.numPages).toBe(pageCount);
    const first = await pdf.getPage(1);
    expect(first.view.map(Math.round)).toEqual([0, 0, 595, 842]);
    const content = await first.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    expect(text).toContain("Quotation");
    expect(text).toContain("Harbourfront Dental");
    const last = await (await pdf.getPage(pageCount)).getTextContent();
    expect(last.items.map((item) => item.str).join(" ")).toContain("Total (SGD)");
  });
});
