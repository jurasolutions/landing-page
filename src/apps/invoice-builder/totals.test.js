/**
 * PRD §2 criteria 1 to 3: the invoice's money, worked out by the quote
 * builder's own calc module (imported, never copied; offline.test.js scans
 * the sources for that). Figures from test-strategy.md and functional.md AC1
 * to AC3, worked by hand.
 */
import { describe, expect, it } from "vitest";

import { formatCents, normaliseMoneyInput, quoteTotals } from "../quote-builder/calc.js";
import { invoiceOf, item } from "./fixtures.js";
import { invoiceTotalsRows } from "./totals-rows.js";
import COPY from "./copy.js";

const MONEY = /^-?\d{1,3}(,\d{3})*\.\d{2}$/;
const base = () => [item("3", "45.50"), item("2.5", "80")];

const figures = (invoice) => {
  const t = quoteTotals(invoice);
  return [t.subtotal, t.discount, t.taxable, t.gst, t.total].map(formatCents);
};

describe("invoice totals (test strategy money table)", () => {
  it.each([
    ["no discount, GST off", base(), {}, ["336.50", "0.00", "336.50", "0.00", "336.50"]],
    ["no discount, GST 9%, a half cent of GST", base(), { gst: true }, ["336.50", "0.00", "336.50", "30.29", "366.79"]],
    ["line 1 discount 10%", [item("3", "45.50", "percent", "10"), item("2.5", "80")], { gst: true }, ["322.85", "0.00", "322.85", "29.06", "351.91"]],
    ["line 1 discount 5.00", [item("3", "45.50", "amount", "5"), item("2.5", "80")], { gst: true }, ["331.50", "0.00", "331.50", "29.84", "361.34"]],
    ["overall discount 2.5%", base(), { gst: true, overall: { type: "percent", value: "2.5" } }, ["336.50", "8.41", "328.09", "29.53", "357.62"]],
    ["overall discount 36.50, GST off", base(), { overall: { type: "amount", value: "36.50" } }, ["336.50", "36.50", "300.00", "0.00", "300.00"]],
    [
      "everything at once",
      [item("3", "45.50", "percent", "10"), item("2.5", "80", "amount", "5"), item("1", "0.10"), item("1", "0.20")],
      { gst: true, overall: { type: "percent", value: "5" } },
      ["318.15", "15.91", "302.24", "27.20", "329.44"],
    ],
  ])("%s", (_, items, options, expected) => {
    expect(figures(invoiceOf(items, options))).toEqual(expected);
  });
});

describe("invoice totals (functional review AC1)", () => {
  const t1 = () => [item("3", "45"), item("1", "80"), item("2.5", "60")];
  it.each([
    ["T1 no discount, GST off", t1(), {}, ["365.00", "0.00", "365.00", "0.00", "365.00"]],
    ["T2 no discount, GST 9%", t1(), { gst: true }, ["365.00", "0.00", "365.00", "32.85", "397.85"]],
    ["T3 line %", [item("3", "33.33", "percent", "15")], { gst: true }, ["84.99", "0.00", "84.99", "7.65", "92.64"]],
    ["T4 line amount", [item("2", "150", "amount", "25")], {}, ["275.00", "0.00", "275.00", "0.00", "275.00"]],
    ["T4b amount over the line", [item("2", "150", "amount", "400")], {}, ["0.00", "0.00", "0.00", "0.00", "0.00"]],
    ["T5 overall %", t1(), { gst: true, overall: { type: "percent", value: "5" } }, ["365.00", "18.25", "346.75", "31.21", "377.96"]],
    ["T6 overall amount", t1(), { gst: true, overall: { type: "amount", value: "50" } }, ["365.00", "50.00", "315.00", "28.35", "343.35"]],
    ["T7 overall amount, GST off", t1(), { overall: { type: "amount", value: "50" } }, ["365.00", "50.00", "315.00", "0.00", "315.00"]],
    ["T8 rate edited to 8", t1(), { gst: true, rate: "8" }, ["365.00", "0.00", "365.00", "29.20", "394.20"]],
    ["T9 line rounding tie", [item("0.5", "0.25")], {}, ["0.13", "0.00", "0.13", "0.00", "0.13"]],
  ])("%s", (_, items, options, expected) => {
    expect(figures(invoiceOf(items, options))).toEqual(expected);
  });

  it("never treats an invoice as prices that include GST", () => {
    const invoice = invoiceOf(base(), { gst: true });
    expect(quoteTotals(invoice).inclusive).toBe(false);
  });
});

describe("the half-cent GST tie (criterion 2)", () => {
  it.each([
    ["0.50 at 9%", "0.50", "9", "0.05"],
    ["16.50 at 9%", "16.50", "9", "1.49"],
    ["0.05 at 9%", "0.05", "9", "0.00"],
    ["0.50 at 7%", "0.50", "7", "0.04"],
    ["H1 150.50 at 9%", "150.50", "9", "13.55"],
  ])("%s", (_, price, rate, gst) => {
    expect(formatCents(quoteTotals(invoiceOf([item("1", price)], { gst: true, rate })).gst)).toBe(gst);
  });

  it("H2 reaches the tie through a discount", () => {
    const t = quoteTotals(invoiceOf([item("1", "200")], { gst: true, overall: { type: "amount", value: "49.50" } }));
    expect([t.taxable, t.gst, t.total].map(formatCents)).toEqual(["150.50", "13.55", "164.05"]);
  });

  it("H3 works out GST once on the total, not per line", () => {
    const t = quoteTotals(invoiceOf([item("1", "10.50"), item("1", "10.50"), item("1", "10.50")], { gst: true }));
    expect([t.subtotal, t.gst, t.total].map(formatCents)).toEqual(["31.50", "2.84", "34.34"]);
  });

  it("rounds half up, and the three amounts always add up, for every amount to 200.00 at four rates", () => {
    for (const [rate, hundredths] of [["9", 900n], ["8", 800n], ["7", 700n], ["12.5", 1250n]]) {
      for (let cents = 0n; cents <= 20000n; cents += 1n) {
        const price = formatCents(cents).replace(/,/g, "");
        const t = quoteTotals(invoiceOf([item("1", price)], { gst: true, rate }));
        const expected = (2n * cents * hundredths + 10000n) / 20000n;
        if (t.gst !== expected) throw new Error(`${price} at ${rate}%: ${t.gst} not ${expected}`);
        if (t.taxable + t.gst !== t.total) throw new Error(`${price} at ${rate}% does not add up`);
      }
    }
  });

  it("adds up as printed: the amount before GST and the GST rows make the final line", () => {
    for (const invoice of [
      invoiceOf([item("1", "150.50")], { gst: true }),
      invoiceOf([item("3", "33.33", "percent", "15"), item("2", "0.10")], { gst: true, overall: { type: "percent", value: "2.5" } }),
    ]) {
      const t = quoteTotals(invoice);
      const { rows, final } = invoiceTotalsRows(invoice, t, COPY);
      const cents = (label) => BigInt(rows.find((row) => row.label.startsWith(label)).value.replace(/[,.]/g, ""));
      expect(cents("Amount before GST") + cents("GST (")).toBe(BigInt(final.value.replace(/[,.]/g, "")));
    }
  });
});

describe("no floating-point artefacts (criterion 3)", () => {
  it.each([
    ["0.10 + 0.20", [item("1", "0.10"), item("1", "0.20")], "0.30"],
    ["3 x 0.10", [item("3", "0.10")], "0.30"],
    ["19.99 x 3", [item("3", "19.99")], "59.97"],
    ["2.675 x 1", [item("1", "2.675")], "2.68"],
    ["quantity 0.333 of 10.00", [item("0.333", "10")], "3.33"],
  ])("%s", (_, items, total) => {
    const invoice = invoiceOf(items);
    const t = quoteTotals(invoice);
    expect(formatCents(t.total)).toBe(total);
    const { rows, final } = invoiceTotalsRows(invoice, t, COPY);
    for (const { value } of [...rows, final]) expect(value.replace(/^-/, "")).toMatch(MONEY);
  });

  it("F2 0.10 and 0.20 with GST 9%", () => {
    const t = quoteTotals(invoiceOf([item("1", "0.10"), item("1", "0.20")], { gst: true }));
    expect([t.subtotal, t.gst, t.total].map(formatCents)).toEqual(["0.30", "0.03", "0.33"]);
  });

  it("F3 a price typed as 1.005 shows 1.01 and totals 1.01", () => {
    expect(normaliseMoneyInput("1.005")).toBe("1.01");
    expect(formatCents(quoteTotals(invoiceOf([item("1", "1.005")])).total)).toBe("1.01");
  });

  it("F4 groups thousands", () => {
    expect(formatCents(quoteTotals(invoiceOf([item("1", "1035.5")])).total)).toBe("1,035.50");
  });
});
