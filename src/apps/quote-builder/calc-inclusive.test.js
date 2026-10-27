import { describe, expect, it } from "vitest";
import { formatCents, parseCents, quoteTotals } from "./calc.js";

/**
 * Prices that include GST (APP-001b). The exclusive mode is covered by
 * calc.test.js, which is unchanged; the golden table below pins today's
 * figures from before the change, so "identical to the cent" is checked
 * against values the new code did not produce.
 */

const item = (quantity, unitPrice, discountType = "none", discountValue = "") => ({
  description: "Item",
  quantity,
  unit: "",
  unitPrice,
  discountType,
  discountValue,
});

const NO_DISCOUNT = { type: "none", value: "" };

const quote = (items, { overall = NO_DISCOUNT, gst } = {}) => ({
  items,
  overallDiscount: overall,
  gst,
});

const inclusive = (rate = "9") => ({ on: true, rate, inclusive: true });
const exclusive = (rate = "9") => ({ on: true, rate, inclusive: false });

/** A quote whose amount after discount is exactly `cents`. */
const totalOf = (cents, gst) => quote([item("1", formatCents(cents).replace(/,/g, ""))], { gst });

const money = (totals) => ({
  subtotal: formatCents(totals.subtotal),
  discount: formatCents(totals.discount),
  taxable: formatCents(totals.taxable),
  gst: formatCents(totals.gst),
  total: formatCents(totals.total),
});

describe("the effective mode", () => {
  it("is inclusive only while GST is on and the choice is true", () => {
    expect(quoteTotals(totalOf(10900n, inclusive())).inclusive).toBe(true);
    expect(quoteTotals(totalOf(10900n, exclusive())).inclusive).toBe(false);
    expect(quoteTotals(totalOf(10900n, { on: true, rate: "9" })).inclusive).toBe(false);
    expect(quoteTotals(totalOf(10900n, { on: false, rate: "9", inclusive: true })).inclusive).toBe(false);
    expect(quoteTotals(totalOf(10900n, undefined)).inclusive).toBe(false);
  });

  it("reads only the boolean true, never a truthy stand-in", () => {
    for (const stand of ["true", "yes", 1, [], {}]) {
      expect(quoteTotals(totalOf(10900n, { on: true, rate: "9", inclusive: stand })).inclusive).toBe(false);
    }
  });

  it("ignores a stored inclusive choice while GST is off", () => {
    const totals = quoteTotals(totalOf(10900n, { on: false, rate: "9", inclusive: true }));
    expect(money(totals)).toEqual({ subtotal: "109.00", discount: "0.00", taxable: "109.00", gst: "0.00", total: "109.00" });
  });
});

describe("inclusive: the total stays as typed", () => {
  it("takes 9.00 of GST out of 109.00 and leaves 100.00 before GST", () => {
    expect(money(quoteTotals(totalOf(10900n, inclusive())))).toEqual({
      subtotal: "109.00",
      discount: "0.00",
      taxable: "100.00",
      gst: "9.00",
      total: "109.00",
    });
  });

  it("works GST out once on the whole, not on each line (three lines of 1.00)", () => {
    const totals = quoteTotals(quote([item("1", "1.00"), item("1", "1.00"), item("1", "1.00")], { gst: inclusive() }));
    expect(money(totals)).toMatchObject({ total: "3.00", gst: "0.25", taxable: "2.75" });
  });

  it("takes the whole-quote percent discount off first (3 x 19.99 and 2.5 x 80.00, 10% off)", () => {
    const totals = quoteTotals(
      quote([item("3", "19.99"), item("2.5", "80.00")], { overall: { type: "percent", value: "10" }, gst: inclusive() })
    );
    expect(money(totals)).toEqual({
      subtotal: "259.97",
      discount: "26.00",
      taxable: "214.65",
      gst: "19.32",
      total: "233.97",
    });
  });

  it("keeps the same quote exclusive at the figures it had before (21.06 and 255.03)", () => {
    const totals = quoteTotals(
      quote([item("3", "19.99"), item("2.5", "80.00")], { overall: { type: "percent", value: "10" }, gst: exclusive() })
    );
    expect(money(totals)).toMatchObject({ taxable: "233.97", gst: "21.06", total: "255.03" });
  });

  it("takes a line discount and then a whole-quote amount discount off before GST is found", () => {
    const totals = quoteTotals(
      quote([item("3", "33.33", "percent", "10")], { overall: { type: "amount", value: "10" }, gst: inclusive() })
    );
    // 3 x 33.33 less 10% = 89.99, less 10.00 = 79.99; GST = 79.99 x 9 / 109 = 6.6046 -> 6.60
    expect(money(totals)).toEqual({
      subtotal: "89.99",
      discount: "10.00",
      taxable: "73.39",
      gst: "6.60",
      total: "79.99",
    });
  });

  it("matches the worked example: 159.80 less 10% at 9%", () => {
    const totals = quoteTotals(
      quote([item("2", "59.90"), item("1", "40.00")], { overall: { type: "percent", value: "10" }, gst: inclusive() })
    );
    expect(money(totals)).toEqual({
      subtotal: "159.80",
      discount: "15.98",
      taxable: "131.94",
      gst: "11.88",
      total: "143.82",
    });
  });

  it.each([
    ["a whole-quote discount equal to the subtotal", { type: "amount", value: "259.97" }],
    ["a whole-quote amount discount larger than the subtotal", { type: "amount", value: "9999" }],
    ["a 100% whole-quote discount", { type: "percent", value: "100" }],
  ])("leaves nothing to tax with %s", (_, overall) => {
    const totals = quoteTotals(quote([item("3", "19.99"), item("2.5", "80.00")], { overall, gst: inclusive() }));
    expect(money(totals)).toMatchObject({ taxable: "0.00", gst: "0.00", total: "0.00" });
  });

  it("is all zero with no items, or only items with no quantity", () => {
    for (const items of [[], [item("0", "50.00")], [item("", "50.00")]]) {
      expect(money(quoteTotals(quote(items, { gst: inclusive() })))).toEqual({
        subtotal: "0.00",
        discount: "0.00",
        taxable: "0.00",
        gst: "0.00",
        total: "0.00",
      });
    }
  });
});

describe("inclusive: rounding, from independently worked values", () => {
  // [amount in cents, rate typed, GST, before GST]. Worked out by hand with BigInt
  // in a scratch script, not with the code under test.
  it.each([
    [10900n, "9", "9.00", "100.00"],
    [109n, "9", "0.09", "1.00"],
    [1n, "9", "0.00", "0.01"],
    [50n, "9", "0.04", "0.46"],
    [100n, "9", "0.08", "0.92"],
    [1n, "100", "0.01", "0.00"], // exact tie (0.5) rounds up
    [3n, "100", "0.02", "0.01"], // exact tie (1.5) rounds up, not to even
    [3n, "20", "0.01", "0.02"], // exact tie at a second rate
    [9n, "20", "0.02", "0.07"],
    [2n, "50", "0.01", "0.01"],
    [5n, "8", "0.00", "0.05"],
    [12345678n, "9", "10,193.68", "113,263.10"],
    [1000000000n, "9", "825,688.07", "9,174,311.93"],
    [101n, "100", "0.51", "0.50"], // exact tie at the maximum rate
    [10000n, "100", "50.00", "50.00"],
    [10000n, "0", "0.00", "100.00"],
    [1n, "0", "0.00", "0.01"],
  ])("%s cents at %s percent: GST %s, before GST %s", (cents, rate, gst, before) => {
    const totals = quoteTotals(totalOf(cents, inclusive(rate)));
    expect(formatCents(totals.gst)).toBe(gst);
    expect(formatCents(totals.taxable)).toBe(before);
    expect(totals.total).toBe(cents);
  });

  it("takes GST of 0.00 at a rate of 0", () => {
    const totals = quoteTotals(totalOf(12345n, inclusive("0")));
    expect(totals.gst).toBe(0n);
    expect(totals.taxable).toBe(12345n);
  });
});

describe("inclusive: a bad rate", () => {
  it.each([
    ["blank", "", "invalid", "0.00"],
    ["not a number", "nine", "invalid", "0.00"],
    ["above 100", "150", "percent", "50.00"], // clamps to 100%, so half of 100.00
  ])("is %s: the field error stays and the figures stay finite", (_, rate, error, gst) => {
    const totals = quoteTotals(totalOf(10000n, inclusive(rate)));
    expect(totals.errors.gstRate).toBe(error);
    expect(formatCents(totals.gst)).toBe(gst);
    expect(totals.total).toBe(10000n);
    expect(totals.taxable + totals.gst).toBe(totals.total);
  });
});

describe("exclusive: figures from before the change, to the cent", () => {
  // Captured from the unmodified calc.js on main before this change.
  const ITEMSETS = {
    a: [item("1", "100.00")],
    b: [item("3", "19.99"), item("2.5", "80.00")],
    c: [item("3", "33.33", "percent", "10")],
    d: [item("2", "59.90"), item("1", "40.00")],
    e: [item("1", "1.00"), item("1", "1.00"), item("1", "1.00")],
    f: [item("1", "0.01")],
    g: [item("1", "10000000.00")],
    h: [],
    i: [item("0", "50.00")],
    j: [item("1", "123456.78")],
  };
  const OVERALLS = {
    none: { type: "none", value: "" },
    pct10: { type: "percent", value: "10" },
    amt5: { type: "amount", value: "5" },
    amtHuge: { type: "amount", value: "99999999" },
  };
  // [items, overall, rate, subtotal, discount, taxable, gst, total]
  const GOLDEN = [
    ["a", "none", "9", "100.00", "0.00", "100.00", "9.00", "109.00"],
    ["a", "none", "100", "100.00", "0.00", "100.00", "100.00", "200.00"],
    ["a", "pct10", "12.5", "100.00", "10.00", "90.00", "11.25", "101.25"],
    ["a", "amt5", "0", "100.00", "5.00", "95.00", "0.00", "95.00"],
    ["a", "amtHuge", "8", "100.00", "100.00", "0.00", "0.00", "0.00"],
    ["b", "none", "9", "259.97", "0.00", "259.97", "23.40", "283.37"],
    ["b", "none", "100", "259.97", "0.00", "259.97", "259.97", "519.94"],
    ["b", "pct10", "12.5", "259.97", "26.00", "233.97", "29.25", "263.22"],
    ["b", "amt5", "0", "259.97", "5.00", "254.97", "0.00", "254.97"],
    ["b", "amtHuge", "8", "259.97", "259.97", "0.00", "0.00", "0.00"],
    ["c", "none", "9", "89.99", "0.00", "89.99", "8.10", "98.09"],
    ["c", "none", "100", "89.99", "0.00", "89.99", "89.99", "179.98"],
    ["c", "pct10", "12.5", "89.99", "9.00", "80.99", "10.12", "91.11"],
    ["c", "amt5", "0", "89.99", "5.00", "84.99", "0.00", "84.99"],
    ["c", "amtHuge", "8", "89.99", "89.99", "0.00", "0.00", "0.00"],
    ["d", "none", "9", "159.80", "0.00", "159.80", "14.38", "174.18"],
    ["d", "none", "100", "159.80", "0.00", "159.80", "159.80", "319.60"],
    ["d", "pct10", "12.5", "159.80", "15.98", "143.82", "17.98", "161.80"],
    ["d", "amt5", "0", "159.80", "5.00", "154.80", "0.00", "154.80"],
    ["d", "amtHuge", "8", "159.80", "159.80", "0.00", "0.00", "0.00"],
    ["e", "none", "9", "3.00", "0.00", "3.00", "0.27", "3.27"],
    ["e", "none", "100", "3.00", "0.00", "3.00", "3.00", "6.00"],
    ["e", "pct10", "12.5", "3.00", "0.30", "2.70", "0.34", "3.04"],
    ["e", "amt5", "0", "3.00", "3.00", "0.00", "0.00", "0.00"],
    ["e", "amtHuge", "8", "3.00", "3.00", "0.00", "0.00", "0.00"],
    ["f", "none", "9", "0.01", "0.00", "0.01", "0.00", "0.01"],
    ["f", "none", "100", "0.01", "0.00", "0.01", "0.01", "0.02"],
    ["f", "pct10", "12.5", "0.01", "0.00", "0.01", "0.00", "0.01"],
    ["f", "amt5", "0", "0.01", "0.01", "0.00", "0.00", "0.00"],
    ["f", "amtHuge", "8", "0.01", "0.01", "0.00", "0.00", "0.00"],
    ["g", "none", "9", "10,000,000.00", "0.00", "10,000,000.00", "900,000.00", "10,900,000.00"],
    ["g", "none", "100", "10,000,000.00", "0.00", "10,000,000.00", "10,000,000.00", "20,000,000.00"],
    ["g", "pct10", "12.5", "10,000,000.00", "1,000,000.00", "9,000,000.00", "1,125,000.00", "10,125,000.00"],
    ["g", "amt5", "0", "10,000,000.00", "5.00", "9,999,995.00", "0.00", "9,999,995.00"],
    ["g", "amtHuge", "8", "10,000,000.00", "10,000,000.00", "0.00", "0.00", "0.00"],
    ["h", "none", "9", "0.00", "0.00", "0.00", "0.00", "0.00"],
    ["h", "none", "100", "0.00", "0.00", "0.00", "0.00", "0.00"],
    ["h", "pct10", "12.5", "0.00", "0.00", "0.00", "0.00", "0.00"],
    ["h", "amt5", "0", "0.00", "0.00", "0.00", "0.00", "0.00"],
    ["h", "amtHuge", "8", "0.00", "0.00", "0.00", "0.00", "0.00"],
    ["i", "none", "9", "0.00", "0.00", "0.00", "0.00", "0.00"],
    ["i", "none", "100", "0.00", "0.00", "0.00", "0.00", "0.00"],
    ["i", "pct10", "12.5", "0.00", "0.00", "0.00", "0.00", "0.00"],
    ["i", "amt5", "0", "0.00", "0.00", "0.00", "0.00", "0.00"],
    ["i", "amtHuge", "8", "0.00", "0.00", "0.00", "0.00", "0.00"],
    ["j", "none", "9", "123,456.78", "0.00", "123,456.78", "11,111.11", "134,567.89"],
    ["j", "none", "100", "123,456.78", "0.00", "123,456.78", "123,456.78", "246,913.56"],
    ["j", "pct10", "12.5", "123,456.78", "12,345.68", "111,111.10", "13,888.89", "124,999.99"],
    ["j", "amt5", "0", "123,456.78", "5.00", "123,451.78", "0.00", "123,451.78"],
    ["j", "amtHuge", "8", "123,456.78", "123,456.78", "0.00", "0.00", "0.00"],
  ];

  it("has not moved, with the choice absent, false, or true while GST is off", () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(30);
    for (const [set, overall, rate, subtotal, discount, taxable, gst, total] of GOLDEN) {
      const expected = { subtotal, discount, taxable, gst, total };
      const label = `${set} ${overall} ${rate}%`;
      const absent = quoteTotals(quote(ITEMSETS[set], { overall: OVERALLS[overall], gst: { on: true, rate } }));
      const off = quoteTotals(quote(ITEMSETS[set], { overall: OVERALLS[overall], gst: exclusive(rate) }));
      expect(money(absent), label).toEqual(expected);
      expect(money(off), label).toEqual(expected);
      expect(absent.inclusive, label).toBe(false);
    }
  });
});

describe("the invariants, in both modes", () => {
  // A small seeded generator, so a failure reproduces exactly.
  const mulberry32 = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const RATES = ["0", "1", "8", "9", "12.5", "20", "50", "100"];
  const scaled = (rate) => parseCents(rate).value; // hundredths of a percent, 9 -> 900

  /** The checks every case must pass, in either mode. */
  function checkInvariants(totals, rateScaled, isInclusive, label) {
    const { gst, taxable, total } = totals;
    // P1 and P3
    if (taxable + gst !== total) throw new Error(`${label}: before GST plus GST is not the total`);
    if (gst < 0n || gst > total) throw new Error(`${label}: GST out of range`);
    if (isInclusive) {
      // P2: nothing is added on top
      if (total !== totals.subtotal - totals.discount) throw new Error(`${label}: total moved`);
      // P4: within half a cent of the exact value, by cross-multiplying (no division)
      const d = 10000n + rateScaled;
      const gap = gst * d - total * rateScaled;
      if (2n * (gap < 0n ? -gap : gap) > d) throw new Error(`${label}: GST is more than half a cent out`);
    } else if (total !== totals.subtotal - totals.discount + gst) {
      throw new Error(`${label}: exclusive total is not the amount after discount plus GST`);
    }
  }

  it("holds for every total from 0.00 to 300.00 at eight rates, in both modes", () => {
    let cases = 0;
    for (const rate of RATES) {
      const r = scaled(rate);
      let previous = -1n;
      for (let cents = 0n; cents <= 30000n; cents += 1n) {
        const inc = quoteTotals(totalOf(cents, inclusive(rate)));
        checkInvariants(inc, r, true, `inclusive ${cents} at ${rate}%`);
        // P5: GST never goes down as the total goes up by a cent
        if (inc.gst < previous) throw new Error(`GST fell at ${cents} at ${rate}%`);
        previous = inc.gst;
        cases += 1;
      }
      for (let cents = 0n; cents <= 30000n; cents += 100n) {
        checkInvariants(quoteTotals(totalOf(cents, exclusive(rate))), r, false, `exclusive ${cents} at ${rate}%`);
        cases += 1;
      }
    }
    expect(cases).toBeGreaterThanOrEqual(240000);
  });

  it("holds for 6,000 seeded random quotes with line and overall discounts", () => {
    const random = mulberry32(20261027);
    const pick = (list) => list[Math.floor(random() * list.length)];
    const digits = (n) => Math.floor(random() * 10 ** n);
    const decimal = (whole, places) => `${digits(whole)}.${String(digits(places)).padStart(places, "0")}`;

    for (let n = 0; n < 6000; n += 1) {
      const items = Array.from({ length: 1 + Math.floor(random() * 6) }, () => {
        const type = pick(["none", "percent", "amount"]);
        return item(
          decimal(3, 3),
          decimal(7, 2),
          type,
          type === "percent" ? decimal(2, 2) : type === "amount" ? decimal(4, 2) : ""
        );
      });
      const overallType = pick(["none", "percent", "amount"]);
      const overall = {
        type: overallType,
        value: overallType === "percent" ? decimal(2, 2) : overallType === "amount" ? decimal(5, 2) : "",
      };
      const rate = random() < 0.5 ? pick(RATES) : decimal(2, 2);
      for (const gst of [inclusive(rate), exclusive(rate)]) {
        const totals = quoteTotals(quote(items, { overall, gst }));
        checkInvariants(totals, totals.gstRate, gst.inclusive, `random ${n} ${JSON.stringify(gst)}`);
        expect(totals.inclusive).toBe(gst.inclusive);
        // P6: the formatted strings agree as well as the integers
        const sum = parseCents(formatCents(totals.taxable)).value + parseCents(formatCents(totals.gst)).value;
        expect(sum).toBe(totals.total);
      }
    }
  });

  it("gives the same result when the choice is absent as when it is false", () => {
    const items = [item("2", "59.90"), item("1", "40.00")];
    const overall = { type: "percent", value: "10" };
    const absent = quoteTotals(quote(items, { overall, gst: { on: true, rate: "9" } }));
    const off = quoteTotals(quote(items, { overall, gst: exclusive("9") }));
    expect(off).toEqual(absent);
  });
});
