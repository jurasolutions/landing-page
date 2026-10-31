/**
 * The "Download PDF" step (decisions D13, D14, D15): no file while a figure
 * shows an error or a required field is missing, and one "complete" counted
 * per PDF actually saved.
 */
import { describe, expect, it, vi } from "vitest";

import { quoteTotals } from "../quote-builder/calc.js";
import { downloadInvoice, pdfFilename } from "./download.js";
import { sampleInvoice } from "./fixtures.js";

const steps = (overrides = {}) => ({
  build: vi.fn(async () => ({ bytes: new Uint8Array([37, 80, 68, 70]) })),
  save: vi.fn(),
  track: vi.fn(),
  ...overrides,
});

describe("downloadInvoice", () => {
  it("builds, saves and counts one completion when nothing is missing", async () => {
    const invoice = sampleInvoice(3);
    const totals = quoteTotals(invoice);
    const s = steps();
    expect(await downloadInvoice(invoice, totals, s)).toEqual({ ok: true });
    expect(s.build).toHaveBeenCalledOnce();
    expect(s.build).toHaveBeenCalledWith(invoice, totals);
    expect(s.save).toHaveBeenCalledOnce();
    expect(s.save.mock.calls[0][1]).toBe("INV-20261031-01.pdf");
    expect(s.track).toHaveBeenCalledOnce();
    expect(s.track).toHaveBeenCalledWith("complete");
  });

  it("makes no file and counts nothing while required fields are missing", async () => {
    const invoice = sampleInvoice(3);
    const missing = [{ key: "businessName", label: "Business name", target: "ib-business-name" }];
    const s = steps({ missingFields: vi.fn(() => missing) });
    expect(await downloadInvoice(invoice, quoteTotals(invoice), s)).toEqual({ missing });
    expect(s.missingFields).toHaveBeenCalledWith(invoice, expect.any(Object));
    expect(s.build).not.toHaveBeenCalled();
    expect(s.save).not.toHaveBeenCalled();
    expect(s.track).not.toHaveBeenCalled();
  });

  it.each([
    ["a quantity", (i) => (i.items[0].quantity = "two")],
    ["a unit price", (i) => (i.items[0].unitPrice = "abc")],
    ["a line discount over 100%", (i) => Object.assign(i.items[0], { discountType: "percent", discountValue: "150" })],
    ["the overall discount", (i) => (i.overallDiscount = { type: "amount", value: "lots" })],
  ])("makes no file while %s shows an error", async (_, spoil) => {
    const invoice = sampleInvoice(3);
    spoil(invoice);
    const s = steps();
    expect(await downloadInvoice(invoice, quoteTotals(invoice), s)).toEqual({ figuresToFix: true });
    expect(s.build).not.toHaveBeenCalled();
    expect(s.save).not.toHaveBeenCalled();
    expect(s.track).not.toHaveBeenCalled();
  });

  it("counts nothing when the PDF cannot be made", async () => {
    const invoice = sampleInvoice(3);
    const s = steps({ build: vi.fn(async () => Promise.reject(new Error("bad logo"))) });
    await expect(downloadInvoice(invoice, quoteTotals(invoice), s)).rejects.toThrow("bad logo");
    expect(s.save).not.toHaveBeenCalled();
    expect(s.track).not.toHaveBeenCalled();
  });

  it("lists missing fields before figure errors, so a bad GST rate is linked to its field", async () => {
    const invoice = sampleInvoice(3);
    invoice.items[0].quantity = "two";
    const missing = [{ key: "gstRate", label: "GST rate (%)", target: "ib-gst-rate" }];
    expect(await downloadInvoice(invoice, quoteTotals(invoice), steps({ missingFields: () => missing }))).toEqual({ missing });
  });

  it("checks no required fields by default: that list is ticket 03's", async () => {
    const invoice = sampleInvoice(1, { business: { name: "", address: "", uen: "", phone: "", email: "", logo: null } });
    expect(await downloadInvoice(invoice, quoteTotals(invoice), steps())).toEqual({ ok: true });
  });
});

describe("pdfFilename", () => {
  it("names the file after the invoice number, made safe", () => {
    expect(pdfFilename({ details: { number: "INV/2026 10" } })).toBe("INV-2026-10.pdf");
    expect(pdfFilename({ details: { number: "" } })).toBe("invoice.pdf");
  });
});
