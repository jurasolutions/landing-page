import { describe, expect, it } from "vitest";
import fs from "node:fs";

import { LIMITS } from "../quote-builder/model.js";
import {
  DEFAULT_GST_RATE,
  INVOICE_LIMITS,
  newInvoice,
  nextInvoice,
  setInvoiceDate,
  suggestNumber,
} from "./model.js";
import { sampleInvoice } from "./fixtures.js";

describe("a new invoice", () => {
  it("has GST off at the default rate, no due date, empty payment details and notes", () => {
    const invoice = newInvoice({ today: "2026-10-31" });
    expect(invoice.gst).toEqual({ on: false, rate: "9", regNo: "" });
    expect(invoice.details).toEqual({ number: "INV-20261031-01", date: "2026-10-31", dueDate: "" });
    expect(invoice.payment).toBe("");
    expect(invoice.notes).toBe("");
    expect(invoice.items).toHaveLength(1);
    expect(invoice.overallDiscount).toEqual({ type: "none", value: "" });
  });

  it("starts with an empty business name: never Jura's (decision D2)", () => {
    const invoice = newInvoice({ today: "2026-10-31" });
    expect(invoice.business.name).toBe("");
    expect(JSON.stringify(invoice)).not.toMatch(/jura/i);
  });

  it("has no prices-include-GST setting, so GST is always added on top", () => {
    expect(newInvoice({ gst: { on: true, rate: "9", regNo: "X", inclusive: true } }).gst).toEqual({ on: true, rate: "9", regNo: "X" });
  });

  it("keeps the IRAS default rate, with both sources and the date checked beside it (decision D16)", () => {
    expect(DEFAULT_GST_RATE).toBe("9");
    const source = fs.readFileSync(new URL("./model.js", import.meta.url), "utf8");
    expect(source).toContain("https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/basics-of-gst/current-gst-rates");
    expect(source).toContain(
      "https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/basics-of-gst/invoicing-price-display-and-record-keeping/invoicing-customers"
    );
    expect(source).toContain("checked 2026-10-31 (PRD A-0002)");
  });

  it("takes the quote's limits and adds payment details", () => {
    expect(INVOICE_LIMITS).toMatchObject({ ...LIMITS, payment: 1000 });
  });
});

describe("the suggested invoice number (decision D3)", () => {
  it("is INV-YYYYMMDD-01 from the invoice date", () => {
    expect(suggestNumber("2026-10-31")).toBe("INV-20261031-01");
    expect(suggestNumber("2026-10-31", "")).toBe("INV-20261031-01");
  });

  it("follows on from a number of the same date", () => {
    expect(suggestNumber("2026-10-31", "INV-20261031-01")).toBe("INV-20261031-02");
    expect(suggestNumber("2026-10-31", "INV-20261031-09")).toBe("INV-20261031-10");
    expect(suggestNumber("2026-11-01", "INV-20261031-02")).toBe("INV-20261101-01");
    expect(suggestNumber("2026-10-31", "my own")).toBe("INV-20261031-01");
  });

  it("is empty for a blank or malformed date", () => {
    expect(suggestNumber("")).toBe("");
    expect(suggestNumber("31/10/2026")).toBe("");
  });

  it("follows the invoice date until the visitor edits the number", () => {
    const invoice = newInvoice({ today: "2026-10-31" });
    const moved = setInvoiceDate(invoice, "2026-11-02");
    expect(moved.details).toMatchObject({ date: "2026-11-02", number: "INV-20261102-01" });

    const typed = { ...moved, details: { ...moved.details, number: "A-77" } };
    expect(setInvoiceDate(typed, "2026-11-05").details).toMatchObject({ date: "2026-11-05", number: "A-77" });
  });

  it("keeps following across a date cleared and typed again", () => {
    const cleared = setInvoiceDate(newInvoice({ today: "2026-10-31" }), "");
    expect(cleared.details.number).toBe("INV-20261031-01");
    expect(setInvoiceDate(cleared, "2026-12-01").details.number).toBe("INV-20261201-01");
  });

  it("leaves a number the visitor cleared empty", () => {
    const invoice = newInvoice({ today: "2026-10-31" });
    invoice.details.number = "";
    expect(setInvoiceDate(invoice, "2026-11-02").details.number).toBe("");
  });

  it("follows the date with the running number after New invoice", () => {
    const second = newInvoice({ today: "2026-10-31", previous: "INV-20261031-01" });
    expect(second.details.number).toBe("INV-20261031-02");
    const other = setInvoiceDate(second, "2026-11-01", "INV-20261031-01");
    expect(other.details.number).toBe("INV-20261101-01");
    expect(setInvoiceDate(other, "2026-10-31", "INV-20261031-01").details.number).toBe("INV-20261031-02");
  });
});

describe("New invoice (decision D10)", () => {
  it("keeps the business, GST setting and payment details, and clears the rest", () => {
    const current = sampleInvoice(3, { overallDiscount: { type: "percent", value: "5" } });
    current.business.logo = { dataUrl: "data:image/png;base64,AAAA", width: 1, height: 1 };
    const next = nextInvoice(current, { today: "2026-10-31" });
    expect(next.business).toEqual(current.business);
    expect(next.gst).toEqual(current.gst);
    expect(next.payment).toBe(current.payment);
    expect(next.customer).toEqual({ company: "", contact: "", address: "", email: "" });
    expect(next.items).toHaveLength(1);
    expect(next.items[0].description).toBe("");
    expect(next.overallDiscount).toEqual({ type: "none", value: "" });
    expect(next.notes).toBe("");
    expect(next.details).toEqual({ number: "INV-20261031-02", date: "2026-10-31", dueDate: "" });
  });

  it("runs -02, -03 on the same date", () => {
    const first = newInvoice({ today: "2026-10-31" });
    const second = nextInvoice(first, { today: "2026-10-31" });
    const third = nextInvoice(second, { today: "2026-10-31" });
    expect([first, second, third].map((i) => i.details.number)).toEqual([
      "INV-20261031-01",
      "INV-20261031-02",
      "INV-20261031-03",
    ]);
  });

  it("starts again at -01 on a new day", () => {
    expect(nextInvoice(newInvoice({ today: "2026-10-31" }), { today: "2026-11-01" }).details.number).toBe("INV-20261101-01");
  });
});
