import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import COPY from "./copy.js";
import { quoteTotals } from "./calc.js";
import { applyDraft } from "./draft.js";
import { DEFAULT_GST_RATE, newQuote, readGst } from "./model.js";
import { FILE_FORMAT, FILE_VERSION, parseQuoteFile, serialiseQuote } from "./quoteFile.js";
import { buildQuotePdf, A4 } from "./pdf.js";
import { QuotePreview } from "./QuotePreview.jsx";

/** Prices that include GST (APP-001b): the saved file, the remembered setting and an AI draft. */

const withoutIds = (quote) => ({ ...quote, items: quote.items.map(({ id, ...rest }) => rest) });

function quoteWith(gst) {
  const quote = newQuote({ today: "2026-10-27" });
  quote.items = [
    { id: "item-0", description: "Aircon servicing", quantity: "1", unit: "", unitPrice: "109.00", discountType: "none", discountValue: "" },
  ];
  quote.gst = gst;
  return quote;
}

/** A file as a given version of the app wrote it, with the gst block hand-made. */
const fileWith = (version, gst) =>
  JSON.stringify({
    format: FILE_FORMAT,
    version,
    savedAt: "2026-10-27T00:00:00.000Z",
    quote: { items: [], gst },
  });

describe("the new quote", () => {
  it("quotes prices without GST included until the visitor says otherwise", () => {
    expect(newQuote().gst.inclusive).toBe(false);
  });
});

describe("the saved file", () => {
  it("is written as version 2 and opens as version 1 or 2, never 0 or 3 and up", () => {
    expect(FILE_VERSION).toBe(2);
    expect(JSON.parse(serialiseQuote(newQuote())).version).toBe(2);
    for (const version of [1, 2]) {
      expect(parseQuoteFile(fileWith(version, { on: true, rate: "9" })).ok, `version ${version}`).toBe(true);
    }
    for (const version of [0, 3, 99, 1.5, "2", null]) {
      expect(parseQuoteFile(fileWith(version, { on: true, rate: "9" })), `version ${version}`).toEqual({ ok: false });
    }
  });

  it.each([true, false])("keeps the choice through a save and an open (%s)", (choice) => {
    const quote = quoteWith({ on: true, rate: "9", regNo: "M90312345A", inclusive: choice });
    const file = serialiseQuote(quote);
    expect(JSON.parse(file).quote.gst).toEqual({ on: true, rate: "9", regNo: "M90312345A", inclusive: choice });

    const opened = parseQuoteFile(file);
    expect(opened.ok).toBe(true);
    expect(withoutIds(opened.quote)).toEqual(withoutIds(quote));
    expect(opened.quote.gst.inclusive).toBe(choice);
    expect(quoteTotals(opened.quote)).toEqual(quoteTotals(quote));
  });

  it("keeps the choice while GST is off, so switching GST back on finds it still there", () => {
    const quote = quoteWith({ on: false, rate: "9", regNo: "", inclusive: true });
    const opened = parseQuoteFile(serialiseQuote(quote));
    expect(opened.quote.gst).toEqual({ on: false, rate: "9", regNo: "", inclusive: true });
    expect(quoteTotals(opened.quote).inclusive).toBe(false);
  });

  it("opens a version 1 file, which has no choice, as exclusive and changes nothing else", () => {
    const opened = parseQuoteFile(fileWith(1, { on: true, rate: "8", regNo: "M1" }));
    expect(opened.ok).toBe(true);
    expect(opened.quote.gst).toEqual({ on: true, rate: "8", regNo: "M1", inclusive: false });
  });

  it("opens a version 2 file with the choice missing as exclusive", () => {
    expect(parseQuoteFile(fileWith(2, { on: true, rate: "9" })).quote.gst.inclusive).toBe(false);
  });

  it("opens a hand-edited version 1 file that says true as inclusive, whatever its version", () => {
    expect(parseQuoteFile(fileWith(1, { on: true, rate: "9", inclusive: true })).quote.gst.inclusive).toBe(true);
  });

  it.each([["yes"], ["true"], ["false"], [1], [0], [null], [[]], [{}]])(
    "opens %j as exclusive and does not refuse the file",
    (stand) => {
      const opened = parseQuoteFile(fileWith(2, { on: true, rate: "9", inclusive: stand }));
      expect(opened.ok).toBe(true);
      expect(opened.quote.gst.inclusive).toBe(false);
    }
  );

  it("opens a file with no gst block at all as GST off and exclusive", () => {
    const opened = parseQuoteFile(JSON.stringify({ format: FILE_FORMAT, version: 2, quote: { items: [] } }));
    expect(opened.quote.gst).toEqual({ on: false, rate: "", regNo: "", inclusive: false });
  });
});

describe("the remembered GST setting", () => {
  const full = { on: true, rate: "8", regNo: "M90312345A", inclusive: true };

  it("keeps all four parts", () => {
    expect(readGst(full)).toEqual(full);
  });

  it("reads an older setting, saved before the choice existed, as exclusive", () => {
    expect(readGst({ on: true, rate: "9", regNo: "M1" })).toEqual({ on: true, rate: "9", regNo: "M1", inclusive: false });
  });

  it.each([["true"], ["yes"], [1], [null], [[]], [{}]])("reads %j as exclusive", (stand) => {
    expect(readGst({ ...full, inclusive: stand }).inclusive).toBe(false);
  });

  it("falls back to the default rate and trims long text, as it did before", () => {
    expect(readGst({ on: true, rate: 9, regNo: "x".repeat(500) })).toEqual({
      on: true,
      rate: DEFAULT_GST_RATE,
      regNo: "x".repeat(120),
      inclusive: false,
    });
    expect(readGst({ rate: "1".repeat(50) }).rate).toBe("1".repeat(20));
  });

  it.each([[undefined], [null], ["gst"], [7]])("gives nothing for %j, so a new quote takes its own default", (raw) => {
    expect(readGst(raw)).toBeUndefined();
  });
});

describe("an AI draft", () => {
  it("leaves the GST choice as the visitor set it", () => {
    const start = quoteWith({ on: true, rate: "9", regNo: "", inclusive: true });
    const draft = {
      summary: null,
      customer: { company: null, contact: null, address: null, email: null },
      items: [{ description: "Servicing", quantity: 1, unit: null, unit_price: 109 }],
    };
    const next = applyDraft(start, draft, COPY);
    expect(next.gst).toEqual({ on: true, rate: "9", regNo: "", inclusive: true });
    expect(quoteTotals(next)).toMatchObject({ inclusive: true, total: 10900n, gst: 900n });
  });
});

describe("the PDF with prices that include GST", () => {
  /** A quote of `lines` lines, 45.50 each, with a whole-quote discount, as a visitor might type it. */
  function longQuote(lines, gst) {
    const quote = quoteWith(gst);
    quote.items = Array.from({ length: lines }, (_, i) => ({
      id: `item-${i}`,
      description: `Aircon servicing, unit ${i + 1}`,
      quantity: "1",
      unit: "",
      unitPrice: "45.50",
      discountType: "none",
      discountValue: "",
    }));
    quote.overallDiscount = { type: "percent", value: "10" };
    return quote;
  }

  it("keeps the total, the split and the statement together on one page at every page edge", async () => {
    const [, pageHeight] = A4;
    for (let lines = 28; lines <= 52; lines += 1) {
      const quote = longQuote(lines, { on: true, rate: "9", regNo: "", inclusive: true });
      const totals = quoteTotals(quote);
      const { ops } = await buildQuotePdf(quote, totals, COPY);
      const wanted = [COPY.pdf.total, COPY.pdf.taxable, COPY.pdf.gstIncluded("9"), COPY.pdf.pricesInclude];
      const found = wanted.map((text) => ops.find((o) => o.text === text));
      for (const [i, op] of found.entries()) expect(op, `${wanted[i]} with ${lines} lines`).toBeDefined();
      expect(new Set(found.map((o) => o.page)).size, `one page with ${lines} lines`).toBe(1);
      for (const op of ops.filter((o) => o.kind !== "footer")) {
        expect(op.y, `${op.text} with ${lines} lines`).toBeGreaterThanOrEqual(64 - 0.01);
        expect(op.y + op.size, op.text).toBeLessThanOrEqual(pageHeight - 48 + 0.01);
      }
    }
  });

  it("keeps the exclusive statement with its total at every page edge", async () => {
    for (let lines = 28; lines <= 52; lines += 1) {
      const quote = longQuote(lines, { on: true, rate: "9", regNo: "", inclusive: false });
      const { ops } = await buildQuotePdf(quote, quoteTotals(quote), COPY);
      const total = ops.find((o) => o.text === COPY.pdf.total);
      const statement = ops.find((o) => o.text === COPY.pdf.pricesExclude);
      expect(statement, `${lines} lines`).toBeDefined();
      expect(statement.page, `${lines} lines`).toBe(total.page);
    }
  });

  it("prints no statement and no split with GST off, and never says tax invoice", async () => {
    const quote = longQuote(3, { on: false, rate: "9", regNo: "", inclusive: true });
    const totals = quoteTotals(quote);
    const { ops } = await buildQuotePdf(quote, totals, COPY);
    const texts = ops.map((o) => o.text);
    for (const text of [COPY.pdf.pricesInclude, COPY.pdf.pricesExclude, COPY.pdf.taxable, COPY.pdf.gstIncluded("9"), COPY.pdf.gst("9")]) {
      expect(texts, text).not.toContain(text);
    }
    expect(texts.join(" ")).not.toMatch(/tax invoice/i);
  });

  it("agrees between preview, PDF, and the same quote saved and opened again", async () => {
    const quote = longQuote(5, { on: true, rate: "9", regNo: "M90312345A", inclusive: true });
    quote.items[1].discountType = "percent";
    quote.items[1].discountValue = "10";
    quote.items[2].discountType = "amount";
    quote.items[2].discountValue = "5";

    const rowsOf = async (q) => {
      const totals = quoteTotals(q);
      const html = renderToStaticMarkup(React.createElement(QuotePreview, { quote: q, totals, copy: COPY }));
      const block = html.match(/<dl class="qb-paper-totals">.*?<\/dl>/s)?.[0] ?? "";
      const preview = [...block.matchAll(/<dt[^>]*>([^<]*)<\/dt><dd[^>]*>([^<]*)<\/dd>/g)].map((m) => `${m[1]} ${m[2]}`);
      const { ops } = await buildQuotePdf(q, totals, COPY);
      const pdf = ops.map((o) => o.text);
      return { preview, pdf, totals };
    };

    const before = await rowsOf(quote);
    const opened = parseQuoteFile(serialiseQuote(quote));
    expect(opened.ok).toBe(true);
    const after = await rowsOf(opened.quote);

    expect(after.preview).toEqual(before.preview);
    expect(after.pdf).toEqual(before.pdf);
    expect(before.preview.at(-1)).toMatch(/^Includes GST \(9%\) \d/);
    // The preview rows, flattened, are exactly the figures the PDF printed.
    for (const row of before.preview) {
      const value = row.slice(row.lastIndexOf(" ") + 1);
      expect(before.pdf, row).toContain(value);
    }
    expect(after.totals).toEqual(before.totals);
  });
});

describe("the new wording", () => {
  it("contains no digit of its own: the only number it can show is the rate the visitor typed", () => {
    const strings = [
      COPY.totals.gstInclusive,
      COPY.gstInclusiveHelper,
      COPY.pdf.pricesInclude,
      COPY.pdf.pricesExclude,
      COPY.pdf.gstIncluded("rate"),
    ];
    for (const text of strings) {
      expect(text).not.toMatch(/\d/);
      expect(text).not.toContain("!");
      expect(text).toMatch(/^[A-Z]/);
    }
  });

  it("puts the visitor's rate in the label, as the exclusive GST label does", () => {
    expect(COPY.pdf.gstIncluded("12.5")).toBe("Includes GST (12.5%)");
    expect(COPY.pdf.gst("12.5")).toBe("GST (12.5%)");
  });
});
