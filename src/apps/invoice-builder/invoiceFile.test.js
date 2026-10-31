/**
 * The invoice file and starting an invoice from a quote file (PRD §2 criteria
 * 6 and 7; decisions D6 to D9; test-strategy.md C6 and C7). Quote files are
 * written by the quote builder's real serialiseQuote, never copied by hand.
 */
import { describe, expect, it, vi } from "vitest";

import { quoteTotals } from "../quote-builder/calc.js";
import { newQuote, DEFAULT_BUSINESS_NAME } from "../quote-builder/model.js";
import QUOTE_COPY from "../quote-builder/copy.js";
import { serialiseQuote, FILE_FORMAT as QUOTE_FORMAT } from "../quote-builder/quoteFile.js";
import { solidPng } from "../../../tests/helpers/png.js";
import COPY from "./copy.js";
import { buildInvoicePdf } from "./pdf.js";
import { newInvoice, setInvoiceDate } from "./model.js";
import { sampleInvoice } from "./fixtures.js";
import {
  FILE_FORMAT,
  FILE_MAX_BYTES,
  FILE_VERSION,
  invoiceFromQuote,
  openAnyFile,
  openPickedFile,
  parseInvoiceFile,
  serialiseInvoice,
} from "./invoiceFile.js";

const pngUrl = (w, h) => `data:image/png;base64,${Buffer.from(solidPng(w, h)).toString("base64")}`;
const withoutIds = (invoice) => ({ ...invoice, items: invoice.items.map(({ id, ...rest }) => rest) });
const textsOf = async (invoice) =>
  (await buildInvoicePdf(invoice, quoteTotals(invoice), COPY)).ops.map((op) => op.text);

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** C7's invoice: six lines, a PNG logo, every discount kind, rate 8, a due date, payment, notes, a typed number. */
function fullInvoice() {
  const invoice = sampleInvoice(6);
  invoice.business.logo = { dataUrl: pngUrl(40, 20), width: 40, height: 20 };
  invoice.items[0].description = "Chemical overhaul\nincluding coil cleaning";
  invoice.overallDiscount = { type: "amount", value: "12.50" };
  invoice.gst = { on: true, rate: "8", regNo: "M90312345A" };
  invoice.details = { number: "TB/2026/117", date: "2026-10-31", dueDate: "2026-11-30" };
  return invoice;
}

/** The invoice already on the page when a file is opened over it. */
function pageInvoice() {
  const invoice = newInvoice({ today: "2026-10-31" });
  invoice.business = {
    name: "Lim Renovation",
    address: "",
    uen: "",
    phone: "+65 6999 0000",
    email: "",
    logo: { dataUrl: pngUrl(30, 30), width: 30, height: 30 },
  };
  invoice.customer = { company: "Someone else", contact: "", address: "Old address", email: "" };
  invoice.details = { number: "INV-20261031-01", date: "2026-10-31", dueDate: "2026-11-14" };
  invoice.payment = "PayNow 91234567";
  invoice.notes = "Old notes";
  invoice.gst = { on: false, rate: "9", regNo: "" };
  return invoice;
}

function sampleQuote({ inclusive = false } = {}) {
  const quote = newQuote({ today: "2026-10-24" });
  quote.business = {
    name: "Tan Brothers Aircon Pte Ltd",
    address: "10 Ubi Crescent\nSingapore 408564",
    uen: "201912345K",
    phone: "+65 6123 4567",
    email: "hello@tanbrothers.example",
    logo: { dataUrl: pngUrl(40, 20), width: 40, height: 20 },
  };
  quote.customer = { company: "Harbourfront Dental", contact: "Dr Lim", address: "1 Maritime Square", email: "admin@harbourfront.example" };
  quote.details.number = "Q-0042";
  quote.items = [
    { id: "a", description: "Aircon servicing", quantity: "3", unit: "units", unitPrice: "45.50", discountType: "none", discountValue: "" },
    { id: "b", description: "Gas top-up", quantity: "2", unit: "", unitPrice: "80", discountType: "percent", discountValue: "10" },
    { id: "c", description: "Drain flush", quantity: "1", unit: "", unitPrice: "60", discountType: "amount", discountValue: "5" },
  ];
  quote.overallDiscount = { type: "percent", value: "2.5" };
  quote.gst = { on: true, rate: "9", regNo: "M90312345A", inclusive };
  quote.notes = "Work to start within a week.";
  return quote;
}

/** A version 1 quote file: written by today's quote builder, then taken back to v1 (no `inclusive`). */
function quoteFileV1(quote = sampleQuote()) {
  const data = JSON.parse(serialiseQuote(quote));
  data.version = 1;
  delete data.quote.gst.inclusive;
  return JSON.stringify(data);
}

describe("the saved invoice file", () => {
  it("carries its own format marker and version", () => {
    const data = JSON.parse(serialiseInvoice(fullInvoice(), new Date("2026-10-31T09:00:00Z")));
    expect(data).toMatchObject({ format: "jura-invoice-builder", version: 1, savedAt: "2026-10-31T09:00:00.000Z" });
    expect(FILE_FORMAT).toBe("jura-invoice-builder");
    expect(FILE_VERSION).toBe(1);
    expect(data.invoice.items[0]).not.toHaveProperty("id");
  });

  it("re-opens to an identical invoice, with equal totals and the same PDF text", async () => {
    const invoice = fullInvoice();
    const opened = parseInvoiceFile(serialiseInvoice(invoice));
    expect(opened.ok).toBe(true);
    expect(withoutIds(opened.invoice)).toEqual(withoutIds(invoice));
    expect(quoteTotals(opened.invoice)).toEqual(quoteTotals(invoice));
    expect(await textsOf(opened.invoice)).toEqual(await textsOf(invoice));
  });

  it("re-opens an invoice with GST off and no due date", () => {
    const invoice = sampleInvoice(2);
    invoice.gst = { on: false, rate: "9", regNo: "" };
    invoice.details.dueDate = "";
    expect(withoutIds(parseInvoiceFile(serialiseInvoice(invoice)).invoice)).toEqual(withoutIds(invoice));
  });

  it("drops fields it does not know, and keeps GST off unless `on` is exactly true", () => {
    const data = JSON.parse(serialiseInvoice(fullInvoice()));
    data.invoice.script = "alert(1)";
    data.invoice.gst.on = "yes";
    data.invoice.gst.inclusive = true;
    data.invoice.madeWith = true;
    const opened = parseInvoiceFile(JSON.stringify(data));
    expect(opened.ok).toBe(true);
    expect(opened.invoice).not.toHaveProperty("script");
    expect(opened.invoice).not.toHaveProperty("madeWith");
    expect(opened.invoice.gst).toEqual({ on: false, rate: "8", regNo: "M90312345A" });
  });

  const file = (invoice, extra = {}) => JSON.stringify({ format: FILE_FORMAT, version: 1, invoice: { items: [], ...invoice }, ...extra });

  it.each([
    ["an empty file", ""],
    ["not JSON", "hello"],
    ["a PDF's bytes", "%PDF-1.7\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj"],
    ["another app's JSON", JSON.stringify({ invoices: [] })],
    ["the wrong format marker", JSON.stringify({ format: "something-else", version: 1, invoice: { items: [] } })],
    ["a newer version", file({}, { version: 2 })],
    ["version 0", file({}, { version: 0 })],
    ["a version that is not a whole number", file({}, { version: "1" })],
    ["no invoice in it", JSON.stringify({ format: FILE_FORMAT, version: 1 })],
    ["items that are not a list", file({ items: "x" })],
    ["more items than an invoice can hold", file({ items: Array.from({ length: 201 }, () => ({})) })],
    ["a field far too long", file({ notes: "x".repeat(5000) })],
    ["payment details far too long", file({ payment: "x".repeat(1001) })],
    ["a date that is not a date", file({ details: { date: "31/10/2026" } })],
    ["a due date that is not a date", file({ details: { dueDate: "soon" } })],
    ["a discount type it does not know", file({ overallDiscount: { type: "half", value: "" } })],
    ["a logo that is not an image", file({ business: { logo: { dataUrl: "data:text/html;base64,PHNjcmlwdD4=", width: 1, height: 1 } } })],
    [
      "a logo over 1 MB",
      file({ business: { logo: { dataUrl: `data:image/png;base64,${"A".repeat(Math.ceil(((1024 * 1024 + 1) * 4) / 3) + 4)}`, width: 1, height: 1 } } }),
    ],
  ])("refuses %s", (_, contents) => {
    expect(parseInvoiceFile(contents)).toEqual({ ok: false });
  });
});

describe("starting an invoice from a quote file", () => {
  for (const [name, contents] of [
    ["version 2", () => serialiseQuote(sampleQuote())],
    ["version 1", () => quoteFileV1()],
  ]) {
    it(`brings in the customer, items, discounts, notes and GST from a ${name} quote, keeping the page's own details`, () => {
      const current = deepFreeze(pageInvoice());
      const result = openAnyFile(contents(), current);
      expect(result.ok).toBe(true);
      expect(result.kind).toBe("quote");
      expect(result.pricesIncludedGst).toBe(false);
      const quote = sampleQuote();
      const { invoice } = result;

      expect(invoice.customer).toEqual(quote.customer);
      expect(withoutIds(invoice).items).toEqual(withoutIds(quote).items);
      expect(new Set(invoice.items.map((i) => i.id)).size).toBe(3);
      expect(invoice.overallDiscount).toEqual(quote.overallDiscount);
      expect(invoice.notes).toBe("Work to start within a week.");
      expect(invoice.gst).toEqual({ on: true, rate: "9", regNo: "M90312345A" });

      // The page's number, dates and payment details stay.
      expect(invoice.details).toEqual(current.details);
      expect(invoice.payment).toBe("PayNow 91234567");
      // Its business details stay; only the empty ones are filled from the quote (D7).
      expect(invoice.business).toEqual({
        name: "Lim Renovation",
        address: "10 Ubi Crescent\nSingapore 408564",
        uen: "201912345K",
        phone: "+65 6999 0000",
        email: "hello@tanbrothers.example",
        logo: current.business.logo,
      });
      expect(Object.keys(invoice).sort()).toEqual(Object.keys(current).sort());
      expect(quoteTotals(invoice)).toEqual(quoteTotals(quote));
    });
  }

  it("fills an empty page's business details and logo from the quote", () => {
    const { invoice } = invoiceFromQuote(sampleQuote(), newInvoice({ today: "2026-10-31" }));
    expect(invoice.business).toEqual(sampleQuote().business);
  });

  it("keeps the page's registration number when it has one", () => {
    const current = pageInvoice();
    current.gst = { on: false, rate: "9", regNo: "200012345M" };
    expect(invoiceFromQuote(sampleQuote(), current).invoice.gst).toEqual({ on: true, rate: "9", regNo: "200012345M" });
  });

  it("brings GST off and the quote's rate when the quote had GST off", () => {
    const quote = sampleQuote();
    quote.gst = { on: false, rate: "8", regNo: "", inclusive: false };
    expect(invoiceFromQuote(quote, pageInvoice()).invoice.gst).toEqual({ on: false, rate: "8", regNo: "" });
  });

  it("never takes Jura's name, which a quote with no business name was saved with", () => {
    const quote = sampleQuote();
    quote.business.name = DEFAULT_BUSINESS_NAME;
    const { invoice } = invoiceFromQuote(quote, newInvoice({ today: "2026-10-31" }));
    expect(invoice.business.name).toBe("");
  });

  it("leaves the quote builder's own default note behind, so an invoice never says 'this quote'", () => {
    const quote = sampleQuote();
    quote.notes = QUOTE_COPY.defaultNotes;
    expect(invoiceFromQuote(quote, pageInvoice()).invoice.notes).toBe("");
  });

  it("opens a quote saved with prices that include GST as typed, with GST on top, and says so (D6)", () => {
    const result = openAnyFile(serialiseQuote(sampleQuote({ inclusive: true })), pageInvoice());
    expect(result).toMatchObject({ ok: true, kind: "quote", pricesIncludedGst: true });
    expect(result.invoice.gst).not.toHaveProperty("inclusive");
    expect(result.invoice.items.map((i) => i.unitPrice)).toEqual(["45.50", "80", "60"]);
    const totals = quoteTotals(result.invoice);
    expect(totals.inclusive).toBe(false);
    expect(totals.total).toBe(totals.taxable + totals.gst);
  });

  it("gives no GST warning for an inclusive quote whose GST was off", () => {
    const quote = sampleQuote({ inclusive: true });
    quote.gst.on = false;
    expect(invoiceFromQuote(quote, pageInvoice()).pricesIncludedGst).toBe(false);
  });
});

describe("opening any file", () => {
  it("opens an invoice file in place of the page's invoice", () => {
    const invoice = fullInvoice();
    const result = openAnyFile(serialiseInvoice(invoice), deepFreeze(pageInvoice()));
    expect(result).toMatchObject({ ok: true, kind: "invoice", pricesIncludedGst: false });
    expect(withoutIds(result.invoice)).toEqual(withoutIds(invoice));
  });

  it("opens either kind through either button: both read the same way", () => {
    expect(openAnyFile(serialiseInvoice(fullInvoice()), pageInvoice()).kind).toBe("invoice");
    expect(openAnyFile(serialiseQuote(sampleQuote()), pageInvoice()).kind).toBe("quote");
  });

  const tooBig = JSON.stringify({ format: FILE_FORMAT, version: 1, invoice: { items: [], notes: "" }, pad: "x".repeat(5 * 1024 * 1024) });

  it.each([
    ["an empty file", ""],
    ["not JSON", "hello"],
    ["a PDF's bytes", "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj"],
    ["a newer invoice file", JSON.stringify({ format: FILE_FORMAT, version: 2, invoice: { items: [] } })],
    ["a newer quote file", JSON.stringify({ format: QUOTE_FORMAT, version: 3, quote: { items: [] } })],
    ["a damaged quote file", JSON.stringify({ format: QUOTE_FORMAT, version: 2, quote: { items: "x" } })],
    ["a 5 MB file", tooBig],
  ])("refuses %s and leaves the invoice unchanged", (_, contents) => {
    const current = pageInvoice();
    const before = structuredClone(current);
    deepFreeze(current);
    expect(openAnyFile(contents, current)).toEqual({ ok: false });
    expect(current).toEqual(before);
  });

  it("refuses a picked file over 3 MB without reading it", async () => {
    let read = false;
    const file = { size: FILE_MAX_BYTES + 1, text: async () => ((read = true), serialiseInvoice(fullInvoice())) };
    expect(await openPickedFile(file, pageInvoice())).toEqual({ ok: false });
    expect(read).toBe(false);
  });

  it("reads a picked file of a good size", async () => {
    const file = { size: 2000, text: async () => serialiseQuote(sampleQuote()) };
    expect(await openPickedFile(file, pageInvoice())).toMatchObject({ ok: true, kind: "quote" });
  });

  it("treats an opened invoice's number as the visitor's: a new date does not renumber it", () => {
    const invoice = fullInvoice();
    invoice.details.number = "INV-20261031-01";
    const { invoice: opened, previousNumber } = openAnyFile(serialiseInvoice(invoice), pageInvoice());
    expect(setInvoiceDate(opened, "2026-11-02", previousNumber).details.number).toBe("INV-20261031-01");
  });
});

describe("files stay on the device", () => {
  it("saves and opens both kinds of file without a single request", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("no requests");
    });
    vi.stubGlobal("fetch", fetchSpy);
    openAnyFile(serialiseInvoice(fullInvoice()), pageInvoice());
    openAnyFile(serialiseQuote(sampleQuote()), pageInvoice());
    await openPickedFile({ size: 10, text: async () => "hello" }, pageInvoice());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
