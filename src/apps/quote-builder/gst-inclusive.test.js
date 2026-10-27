import { describe, expect, it } from "vitest";

import COPY from "./copy.js";
import { quoteTotals } from "./calc.js";
import { applyDraft } from "./draft.js";
import { DEFAULT_GST_RATE, newQuote, readGst } from "./model.js";
import { FILE_FORMAT, FILE_VERSION, parseQuoteFile, serialiseQuote } from "./quoteFile.js";

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
