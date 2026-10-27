import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import COPY from "./copy.js";
import { formatCents, quoteTotals } from "./calc.js";
import { newQuote } from "./model.js";
import { totalsRows } from "./totals-rows.js";
import { QuotePreview } from "./QuotePreview.jsx";
import { buildQuotePdf } from "./pdf.js";

/**
 * A one-line quote of 100.00, with GST, and a 1.00 overall discount when asked.
 * `inclusive` is the stored choice; it only takes effect while GST is on.
 */
function quoteOf({ gst, discount = false, inclusive = false }) {
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
  quote.gst = { on: gst, rate: "9", regNo: "", inclusive };
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

  it("prints the statement GST added at the rate shown while GST is on and prices exclude it", () => {
    for (const discount of [false, true]) {
      const { breakdown, note } = rowsFor({ gst: true, discount });
      expect(breakdown).toEqual([]);
      expect(note).toBe("GST added at the rate shown");
    }
  });

  it("prints no breakdown and no statement at all while GST is off, whatever the stored choice", () => {
    for (const inclusive of [false, true]) {
      for (const discount of [false, true]) {
        const { breakdown, note } = rowsFor({ gst: false, discount, inclusive });
        expect(breakdown).toEqual([]);
        expect(note).toBeNull();
      }
    }
  });

  it("leaves GST-off rows exactly as they were when the stored choice is true", () => {
    expect(rowsFor({ gst: false, discount: true, inclusive: true })).toEqual(rowsFor({ gst: false, discount: true }));
  });

  describe("when prices include GST", () => {
    it("finishes the sum first: the rows stop at the discount, with no discount row when there is none", () => {
      expect(rowsFor({ gst: true, inclusive: true }).rows).toEqual([{ label: "Subtotal", value: "100.00" }]);
      expect(rowsFor({ gst: true, inclusive: true, discount: true }).rows).toEqual([
        { label: "Subtotal", value: "100.00" },
        { label: "Discount", value: "-1.00" },
      ]);
    });

    it("splits the total below it: the total before GST, then the GST it includes", () => {
      expect(rowsFor({ gst: true, inclusive: true }).breakdown).toEqual([
        { label: "Total before GST", value: "91.74" },
        { label: "Includes GST (9%)", value: "8.26" },
      ]);
      expect(rowsFor({ gst: true, inclusive: true, discount: true }).breakdown).toEqual([
        { label: "Total before GST", value: "90.83" },
        { label: "Includes GST (9%)", value: "8.17" },
      ]);
    });

    it("shows the total before GST with or without a discount, unlike exclusive mode", () => {
      expect(rowsFor({ gst: true, inclusive: true }).breakdown[0].label).toBe("Total before GST");
    });

    it("says prices include GST", () => {
      expect(rowsFor({ gst: true, inclusive: true }).note).toBe("Prices include GST");
    });
  });
});

describe("the preview and the PDF agree with totalsRows", () => {
  const MODES = [
    { name: "GST off", gst: false, inclusive: false },
    { name: "GST off, choice stored as inclusive", gst: false, inclusive: true },
    { name: "GST added", gst: true, inclusive: false },
    { name: "GST included", gst: true, inclusive: true },
  ];

  /** Pairs up each label with the next text run on the same line of the PDF. */
  const pdfPairs = (ops) => {
    const pairs = [];
    for (const op of ops) {
      const value = ops.find((o) => o !== op && o.page === op.page && o.y === op.y && o.x > op.x && o.kind === op.kind);
      if (value) pairs.push({ label: op.text, value: value.text, y: op.y, page: op.page });
    }
    return pairs;
  };

  for (const mode of MODES) {
    for (const discount of [false, true]) {
      it(`shows every row, in order, in both: ${mode.name}, ${discount ? "with" : "without"} a discount`, async () => {
        const quote = quoteOf({ ...mode, discount });
        const totals = quoteTotals(quote);
        const { rows, breakdown, note } = totalsRows(quote, totals, COPY);
        const totalLine = { label: COPY.pdf.total, value: formatCents(totals.total) };
        const expected = [...rows, totalLine, ...breakdown];

        // Preview: each row is a label cell next to its value cell, in this order.
        const html = renderToStaticMarkup(React.createElement(QuotePreview, { quote, totals, copy: COPY }));
        const block = html.match(/<dl class="qb-paper-totals">.*?<\/dl>/s)?.[0] ?? "";
        const cells = [...block.matchAll(/<dt[^>]*>([^<]*)<\/dt><dd[^>]*>([^<]*)<\/dd>/g)].map((m) => ({ label: m[1], value: m[2] }));
        expect(cells).toEqual(expected);
        if (note) expect(html.indexOf(`>${note}<`)).toBeGreaterThan(html.lastIndexOf(`>${totalLine.value}<`));
        else for (const text of [COPY.pdf.pricesInclude, COPY.pdf.pricesExclude]) expect(html).not.toContain(text);

        // PDF: each label sits on the same line as its value, and the lines run down the page.
        const { ops } = await buildQuotePdf(quote, totals, COPY);
        const pairs = pdfPairs(ops);
        let lastY = Infinity;
        for (const row of expected) {
          const hit = pairs.find((p) => p.label === row.label && p.value === row.value);
          expect(hit, `${row.label} ${row.value}`).toBeDefined();
          expect(hit.y, `${row.label} is below the row before it`).toBeLessThan(lastY);
          lastY = hit.y;
        }
        const noteOp = ops.find((o) => o.text === note);
        if (note) {
          expect(noteOp, note).toBeDefined();
          expect(noteOp.y).toBeLessThan(lastY);
        } else {
          for (const text of [COPY.pdf.pricesInclude, COPY.pdf.pricesExclude]) {
            expect(ops.some((o) => o.text === text)).toBe(false);
          }
        }
      });
    }
  }

  it("prints a subtotal that is not also a line amount, so the Subtotal row cannot go missing unseen", async () => {
    // Two lines, so the subtotal (100.00 + 40.00 = 140.00) is a figure no line shows.
    const quote = quoteOf({ gst: true, inclusive: true });
    quote.items.push({ ...quote.items[0], id: "item-1", unitPrice: "40.00" });
    const totals = quoteTotals(quote);
    const { ops } = await buildQuotePdf(quote, totals, COPY);
    expect(pdfPairs(ops)).toContainEqual(expect.objectContaining({ label: "Subtotal", value: "140.00" }));
    const html = renderToStaticMarkup(React.createElement(QuotePreview, { quote, totals, copy: COPY }));
    expect(html).toContain("<dt>Subtotal</dt><dd>140.00</dd>");
  });
});
