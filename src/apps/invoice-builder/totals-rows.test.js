import { describe, expect, it } from "vitest";

import { quoteTotals } from "../quote-builder/calc.js";
import COPY from "./copy.js";
import { invoiceOf, item } from "./fixtures.js";
import { invoiceTotalsRows } from "./totals-rows.js";

/** One line of 100.00, with GST and a 1.00 overall discount as asked. */
const rowsFor = ({ gst, discount = false, rate = "9" }) => {
  const invoice = invoiceOf([item("1", "100")], {
    gst,
    rate,
    overall: discount ? { type: "amount", value: "1" } : { type: "none", value: "" },
    regNo: "M90312345A",
  });
  return invoiceTotalsRows(invoice, quoteTotals(invoice), COPY);
};

describe("invoiceTotalsRows (decision D5)", () => {
  it("GST off, no discount: no rows, then Total", () => {
    expect(rowsFor({ gst: false })).toEqual({ rows: [], final: { label: "Total", value: "100.00" } });
  });

  it("GST off, discount: Subtotal and Discount, then Total", () => {
    expect(rowsFor({ gst: false, discount: true })).toEqual({
      rows: [
        { label: "Subtotal", value: "100.00" },
        { label: "Discount", value: "-1.00" },
      ],
      final: { label: "Total", value: "99.00" },
    });
  });

  it("GST on, no discount: Amount before GST and GST, then Amount with GST", () => {
    expect(rowsFor({ gst: true })).toEqual({
      rows: [
        { label: "Amount before GST", value: "100.00" },
        { label: "GST (9%)", value: "9.00" },
      ],
      final: { label: "Amount with GST", value: "109.00" },
    });
  });

  it("GST on, discount: Subtotal, Discount, Amount before GST and GST, then Amount with GST", () => {
    expect(rowsFor({ gst: true, discount: true })).toEqual({
      rows: [
        { label: "Subtotal", value: "100.00" },
        { label: "Discount", value: "-1.00" },
        { label: "Amount before GST", value: "99.00" },
        { label: "GST (9%)", value: "8.91" },
      ],
      final: { label: "Amount with GST", value: "107.91" },
    });
  });

  it("prints a rate with a fraction as typed", () => {
    expect(rowsFor({ gst: true, rate: "8.5" }).rows[1]).toEqual({ label: "GST (8.5%)", value: "8.50" });
  });

  it("never says GST while GST is off, even with a registration number typed", () => {
    for (const discount of [false, true]) {
      const { rows, final } = rowsFor({ gst: false, discount });
      expect(JSON.stringify([rows, final])).not.toMatch(/GST/i);
    }
  });
});
