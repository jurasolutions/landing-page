import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import COPY from "./copy.js";
import { quoteTotals } from "./calc.js";
import { newQuote } from "./model.js";
import { totalsRows } from "./totals-rows.js";
import { QuotePreview } from "./QuotePreview.jsx";
import { buildQuotePdf } from "./pdf.js";

/** A one-line quote of 100.00, with GST, and a 1.00 overall discount when asked. */
function quoteOf({ gst, discount = false }) {
  const quote = newQuote({ today: "2026-10-27" });
  quote.items = [
    {
      id: "item-0",
      description: "Aircon servicing",
      quantity: "1",
      unit: "",
      unitPrice: "100.00",
      discountType: "none",
      discountValue: "",
    },
  ];
  quote.overallDiscount = discount ? { type: "amount", value: "1" } : { type: "none", value: "" };
  quote.gst = { on: gst, rate: "9", regNo: "" };
  return quote;
}

const rowsFor = (options) => {
  const quote = quoteOf(options);
  return totalsRows(quote, quoteTotals(quote), COPY);
};

describe("totalsRows", () => {
  it("shows only the subtotal when GST is off and there is no discount", () => {
    expect(rowsFor({ gst: false })).toEqual({
      rows: [{ label: "Subtotal", value: "100.00" }],
      breakdown: [],
      note: null,
    });
  });

  it("adds the discount row, with its leading minus, when GST is off and there is a discount", () => {
    const { rows } = rowsFor({ gst: false, discount: true });
    expect(rows).toEqual([
      { label: "Subtotal", value: "100.00" },
      { label: "Discount", value: "-1.00" },
    ]);
  });

  it("adds the GST row after the subtotal when GST is on and there is no discount", () => {
    const { rows } = rowsFor({ gst: true });
    expect(rows).toEqual([
      { label: "Subtotal", value: "100.00" },
      { label: "GST (9%)", value: "9.00" },
    ]);
  });

  it("adds the discount and the total before GST when GST is on and there is a discount", () => {
    const { rows } = rowsFor({ gst: true, discount: true });
    expect(rows).toEqual([
      { label: "Subtotal", value: "100.00" },
      { label: "Discount", value: "-1.00" },
      { label: "Total before GST", value: "99.00" },
      { label: "GST (9%)", value: "8.91" },
    ]);
  });

  it("leaves the breakdown empty and the note null for now", () => {
    for (const gst of [false, true]) {
      for (const discount of [false, true]) {
        const { breakdown, note } = rowsFor({ gst, discount });
        expect(breakdown).toEqual([]);
        expect(note).toBeNull();
      }
    }
  });
});

describe("the preview and the PDF agree with totalsRows", () => {
  for (const gst of [false, true]) {
    for (const discount of [false, true]) {
      it(`shows every row in both, GST ${gst ? "on" : "off"}, ${discount ? "with" : "without"} a discount`, async () => {
        const quote = quoteOf({ gst, discount });
        const totals = quoteTotals(quote);
        const { rows } = totalsRows(quote, totals, COPY);
        expect(rows.length).toBeGreaterThanOrEqual(1);

        const html = renderToStaticMarkup(React.createElement(QuotePreview, { quote, totals, copy: COPY }));
        const { ops } = await buildQuotePdf(quote, totals, COPY);
        const pdfTexts = ops.map((op) => op.text);

        for (const { label, value } of rows) {
          expect(html).toContain(`<dt>${label}</dt>`);
          expect(html).toContain(`<dd>${value}</dd>`);
          expect(pdfTexts).toContain(label);
          expect(pdfTexts).toContain(value);
        }
      });
    }
  }
});
