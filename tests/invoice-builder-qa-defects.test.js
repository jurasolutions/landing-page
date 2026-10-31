/**
 * Open defects found by QA run 01 (.scratch/invoice-builder/reviews/qa-01.md).
 *
 * Each test states the behaviour the spec or test strategy asks for, and is
 * marked `it.fails` while the defect is open, so the suite stays green. When
 * a defect is fixed its test starts failing: change `it.fails` to `it` in the
 * fixing commit. Defect 01 lives with the other wiring tests, in
 * tests/invoice-builder-files-wiring.test.js.
 */
import { describe, expect, it } from "vitest";

import { quoteTotals } from "../src/apps/quote-builder/calc.js";
import COPY from "../src/apps/invoice-builder/copy.js";
import { missingFields } from "../src/apps/invoice-builder/required.js";
import { downloadInvoice, hasFigureErrors } from "../src/apps/invoice-builder/download.js";
import { invoiceOf, item, sampleInvoice } from "../src/apps/invoice-builder/fixtures.js";

const keys = (invoice) => missingFields(invoice, quoteTotals(invoice)).map((m) => m.key);

/**
 * Defect 02 (major, fixed). With GST on, a required field typed only in
 * characters the PDF's font cannot print (Chinese, for example) passed the
 * required check, and "Download PDF" made a tax invoice with that IRAS item
 * left out. required.js now checks each field as it prints (`toPrintable`),
 * so such a field is listed as missing, as an empty one is.
 */
describe("DEFECT 02: a required field that prints as nothing on a tax invoice", () => {
  it("lists a Chinese-only customer name and address as missing, and makes no file", async () => {
    const invoice = sampleInvoice(2);
    invoice.customer = { ...invoice.customer, company: "陈氏贸易", address: "新加坡" };
    const totals = quoteTotals(invoice);
    expect(missingFields(invoice, totals)).toEqual([
      { key: "customerName", label: COPY.customer.company, target: "ib-customer-company" },
      { key: "customerAddress", label: COPY.customer.address, target: "ib-customer-address" },
    ]);
    let built = false;
    const result = await downloadInvoice(invoice, totals, {
      build: async () => {
        built = true;
        return { bytes: new Uint8Array() };
      },
      save: () => {},
      track: () => {},
      missingFields,
    });
    expect(result.missing.map((m) => m.key)).toEqual(["customerName", "customerAddress"]);
    expect(built).toBe(false);
  });

  it("still passes a field with some printable text", () => {
    const invoice = sampleInvoice(2);
    invoice.customer = { ...invoice.customer, company: "陈氏贸易 Tan Trading", address: "新加坡 Singapore 123456" };
    expect(keys(invoice)).toEqual([]);
  });

  const cases = [
    ["customerName", (inv) => (inv.customer.company = "陈氏贸易")],
    ["customerAddress", (inv) => (inv.customer.address = "新加坡")],
    ["businessName", (inv) => (inv.business.name = "陈氏空调")],
    ["businessAddress", (inv) => (inv.business.address = "新加坡")],
    ["gstRegNo", (inv) => (inv.gst.regNo = "二〇一九")],
    ["number", (inv) => (inv.details.number = "发票一")],
    ["item-item-0-description", (inv) => (inv.items[0].description = "空调保养")],
  ];
  it.each(cases)("lists %s as missing when it prints as nothing", (key, change) => {
    const invoice = sampleInvoice(2);
    change(invoice);
    expect(keys(invoice)).toContain(key);
  });
});

/**
 * Defect 03 (minor). An amount discount larger than what it comes off is
 * clamped to it with no error, so a typo such as 500 for 50.0 gives a total
 * of 0.00 that downloads without a word. test-strategy.md R1 asks for a
 * discount "over the subtotal" to be "clamped and flagged", as a percentage
 * over 100 already is. The maths is the shared calc.js, so the quote builder
 * behaves the same way.
 */
describe("DEFECT 03: an amount discount larger than what it comes off", () => {
  it("is the defect as it stands: clamped to the subtotal with no error", () => {
    const totals = quoteTotals(invoiceOf([item("1", "100")], { overall: { type: "amount", value: "500" } }));
    expect(totals.discount).toBe(10000n);
    expect(totals.total).toBe(0n);
    expect(totals.errors).toEqual({});
  });

  it("flags a percentage over 100, for comparison (passes today)", () => {
    const totals = quoteTotals(invoiceOf([item("1", "100")], { overall: { type: "percent", value: "150" } }));
    expect(hasFigureErrors(totals)).toBe(true);
  });

  it.fails("flags an overall amount discount over the subtotal", () => {
    const totals = quoteTotals(invoiceOf([item("1", "100")], { overall: { type: "amount", value: "500" } }));
    expect(hasFigureErrors(totals)).toBe(true);
  });

  it.fails("flags a line amount discount over the line's total", () => {
    const totals = quoteTotals(invoiceOf([item("1", "100", "amount", "500")]));
    expect(hasFigureErrors(totals)).toBe(true);
  });
});
