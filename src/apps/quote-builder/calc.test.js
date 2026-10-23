import { describe, expect, it } from "vitest";
import {
  divRoundHalfUp,
  formatCents,
  formatPercent,
  formatQuantity,
  lineFigures,
  normaliseMoneyInput,
  parseCents,
  parseQuantity,
  quoteTotals,
} from "./calc.js";

const item = (quantity, unitPrice, discountType = "none", discountValue = "", description = "Item") => ({
  description,
  quantity,
  unit: "",
  unitPrice,
  discountType,
  discountValue,
});

const quote = (items, { overall = { type: "none", value: "" }, gst = { on: false, rate: "9" } } = {}) => ({
  items,
  overallDiscount: overall,
  gst,
});

const money = (totals) => ({
  subtotal: formatCents(totals.subtotal),
  discount: formatCents(totals.discount),
  taxable: formatCents(totals.taxable),
  gst: formatCents(totals.gst),
  total: formatCents(totals.total),
});

describe("parsing what the visitor typed", () => {
  it("reads money to integer cents without floats", () => {
    expect(parseCents("12.5").value).toBe(1250n);
    expect(parseCents("1,234.56").value).toBe(123456n);
    expect(parseCents("S$ 80").value).toBe(8000n);
    expect(parseCents("$0.10").value).toBe(10n);
    expect(parseCents(".5").value).toBe(50n);
    expect(parseCents("0.125").value).toBe(13n); // half up past the cent
    expect(parseCents("0.124").value).toBe(12n);
    expect(parseCents("").empty).toBe(true);
  });

  it("refuses anything that is not a plain non-negative number", () => {
    for (const bad of ["-5", "1e3", "abc", ".", "1.2.3", "12a", "--1"]) {
      expect(parseCents(bad).error, bad).toBe("invalid");
    }
  });

  it("reads quantities to thousandths", () => {
    expect(parseQuantity("2.5").value).toBe(2500n);
    expect(parseQuantity("1").value).toBe(1000n);
    expect(parseQuantity("0.3333").value).toBe(333n);
    expect(parseQuantity("0.0005").value).toBe(1n);
  });

  it("rounds half up", () => {
    expect(divRoundHalfUp(5n, 10n)).toBe(1n);
    expect(divRoundHalfUp(4n, 10n)).toBe(0n);
    expect(divRoundHalfUp(15n, 10n)).toBe(2n);
    expect(divRoundHalfUp(25n, 10n)).toBe(3n); // not banker's rounding
  });
});

describe("totals", () => {
  it("no discount", () => {
    const totals = quoteTotals(quote([item("3", "19.99"), item("2.5", "80")]));
    expect(totals.lines.map((l) => formatCents(l.total))).toEqual(["59.97", "200.00"]);
    expect(money(totals)).toEqual({
      subtotal: "259.97",
      discount: "0.00",
      taxable: "259.97",
      gst: "0.00",
      total: "259.97",
    });
  });

  it("line discount by percentage", () => {
    const totals = quoteTotals(
      quote([item("1", "100", "percent", "12.5"), item("3", "33.33", "percent", "10")])
    );
    // 99.99 less 10% = 89.991, rounded once at the line total.
    expect(totals.lines.map((l) => formatCents(l.total))).toEqual(["87.50", "89.99"]);
    expect(totals.lines.map((l) => formatCents(l.discount))).toEqual(["12.50", "10.00"]);
    expect(formatCents(totals.total)).toBe("177.49");
  });

  it("line discount by percentage rounds half up at the line", () => {
    const totals = quoteTotals(quote([item("1", "0.05", "percent", "50")]));
    expect(formatCents(totals.lines[0].total)).toBe("0.03"); // 0.025 -> 0.03
  });

  it("line discount by amount", () => {
    const totals = quoteTotals(quote([item("2", "50", "amount", "15"), item("1", "10", "amount", "25")]));
    // The second discount is larger than its line, so the line stops at zero.
    expect(totals.lines.map((l) => formatCents(l.total))).toEqual(["85.00", "0.00"]);
    expect(formatCents(totals.total)).toBe("85.00");
  });

  it("overall discount by percentage", () => {
    const totals = quoteTotals(
      quote([item("3", "19.99"), item("2.5", "80")], { overall: { type: "percent", value: "10" } })
    );
    // 10% of 259.97 is 25.997, rounded half up to 26.00.
    expect(money(totals)).toEqual({
      subtotal: "259.97",
      discount: "26.00",
      taxable: "233.97",
      gst: "0.00",
      total: "233.97",
    });
  });

  it("overall discount by amount, never more than the subtotal", () => {
    const some = quoteTotals(quote([item("1", "100")], { overall: { type: "amount", value: "30" } }));
    expect(money(some).total).toBe("70.00");
    const tooMuch = quoteTotals(quote([item("1", "100")], { overall: { type: "amount", value: "500" } }));
    expect(money(tooMuch)).toMatchObject({ discount: "100.00", total: "0.00" });
  });

  it("GST on, calculated on the subtotal after discounts", () => {
    const totals = quoteTotals(
      quote([item("3", "19.99"), item("2.5", "80")], {
        overall: { type: "percent", value: "10" },
        gst: { on: true, rate: "9" },
      })
    );
    // 9% of 233.97 is 21.0573, rounded to 21.06.
    expect(money(totals)).toEqual({
      subtotal: "259.97",
      discount: "26.00",
      taxable: "233.97",
      gst: "21.06",
      total: "255.03",
    });
    expect(formatPercent(totals.gstRate)).toBe("9");
  });

  it("GST rounds half up", () => {
    expect(formatCents(quoteTotals(quote([item("1", "0.50")], { gst: { on: true, rate: "9" } })).gst)).toBe(
      "0.05" // 0.045
    );
    expect(formatCents(quoteTotals(quote([item("1", "1.50")], { gst: { on: true, rate: "9" } })).gst)).toBe(
      "0.14" // 0.135
    );
  });

  it("GST off adds nothing, whatever the rate field says", () => {
    const totals = quoteTotals(quote([item("1", "100")], { gst: { on: false, rate: "9" } }));
    expect(money(totals)).toMatchObject({ gst: "0.00", total: "100.00" });
  });

  it("flags a GST rate that is blank or not a number", () => {
    expect(quoteTotals(quote([item("1", "1")], { gst: { on: true, rate: "" } })).errors.gstRate).toBe("invalid");
    expect(quoteTotals(quote([item("1", "1")], { gst: { on: true, rate: "nine" } })).errors.gstRate).toBe("invalid");
  });

  it("all discounts and GST together", () => {
    const totals = quoteTotals(
      quote(
        [
          item("4", "125", "percent", "5"), // 500 less 25 = 475.00
          item("1.5", "66.67", "amount", "10"), // 100.005 -> 100.01, less 10 = 90.01
          item("10", "2.35"), // 23.50
        ],
        { overall: { type: "amount", value: "8.51" }, gst: { on: true, rate: "9" } }
      )
    );
    expect(totals.lines.map((l) => formatCents(l.total))).toEqual(["475.00", "90.01", "23.50"]);
    // 588.51 - 8.51 = 580.00; GST 52.20; total 632.20
    expect(money(totals)).toEqual({
      subtotal: "588.51",
      discount: "8.51",
      taxable: "580.00",
      gst: "52.20",
      total: "632.20",
    });
  });
});

describe("lines with no quantity", () => {
  it("are left off the totals and listed so the form can say so", () => {
    const totals = quoteTotals(
      quote([item("2", "10"), item("0", "99", "none", "", "Free survey"), item("", "50"), item("", "", "none", "", "")])
    );
    expect(formatCents(totals.total)).toBe("20.00");
    expect(totals.includedCount).toBe(1);
    // The untouched blank line is not worth a warning; the two with content are.
    expect(totals.ignored).toEqual([1, 2]);
    expect(totals.lines[1]).toMatchObject({ included: false, total: 0n });
  });

  it("leave out the blank line a new quote starts with, without a warning", () => {
    const totals = quoteTotals(quote([item("1", "", "none", "", "")]));
    expect(totals.includedCount).toBe(0);
    expect(totals.ignored).toEqual([]);
    expect(formatCents(totals.total)).toBe("0.00");
  });

  it("keep a described line at no charge", () => {
    const totals = quoteTotals(quote([item("1", "0", "none", "", "Site visit")]));
    expect(totals.includedCount).toBe(1);
  });

  it("show an empty quote as zero", () => {
    const totals = quoteTotals(quote([]));
    expect(money(totals).total).toBe("0.00");
    expect(totals.includedCount).toBe(0);
  });
});

describe("no floating-point artefacts in any displayed amount", () => {
  it("0.10 + 0.20 shows 0.30", () => {
    expect(formatCents(quoteTotals(quote([item("1", "0.10"), item("1", "0.20")])).total)).toBe("0.30");
  });

  it("every formatted amount is digits, commas and exactly two decimals", () => {
    const shape = /^-?\d{1,3}(,\d{3})*\.\d{2}$/;
    const prices = ["0.01", "0.07", "0.1", "0.3", "1.005", "19.99", "33.33", "1234.56", "99999.99"];
    const quantities = ["0.1", "0.2", "0.3", "1", "1.1", "2.5", "3", "7", "1000"];
    const rates = ["0", "7", "8", "9", "9.5", "12.5"];
    for (const price of prices) {
      for (const qty of quantities) {
        for (const rate of rates) {
          const totals = quoteTotals(
            quote([item(qty, price, "percent", "7.5"), item(qty, price)], {
              overall: { type: "percent", value: "3.3" },
              gst: { on: true, rate },
            })
          );
          for (const value of [totals.subtotal, totals.discount, totals.taxable, totals.gst, totals.total]) {
            expect(formatCents(value)).toMatch(shape);
          }
          for (const line of totals.lines) expect(formatCents(line.total)).toMatch(shape);
        }
      }
    }
  });

  it("formats quantities and percentages without trailing noise", () => {
    expect(formatQuantity(parseQuantity("0.1").value * 3n)).toBe("0.3");
    expect(formatQuantity(2500n)).toBe("2.5");
    expect(formatQuantity(1000000n)).toBe("1,000");
    expect(formatPercent(900n)).toBe("9");
    expect(formatPercent(1250n)).toBe("12.5");
  });

  it("tidies a money field on blur", () => {
    expect(normaliseMoneyInput("12.5")).toBe("12.50");
    expect(normaliseMoneyInput("1,234.5")).toBe("1234.50");
    expect(normaliseMoneyInput("")).toBe("");
    expect(normaliseMoneyInput("abc")).toBe("abc");
  });
});

describe("line errors", () => {
  it("marks fields that are not numbers", () => {
    expect(lineFigures(item("two", "10")).errors).toEqual({ quantity: "invalid" });
    expect(lineFigures(item("1", "ten")).errors).toEqual({ unitPrice: "invalid" });
    expect(lineFigures(item("1", "10", "percent", "150")).errors).toEqual({ discountValue: "percent" });
  });
});
