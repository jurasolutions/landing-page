/**
 * The saved invoice file, and starting an invoice from a saved quote file
 * (decisions D6 to D9, ADR 0005).
 *
 *   { "format": "jura-invoice-builder", "version": 1, "savedAt": "...", "invoice": { ... } }
 *
 * Opening a file never trusts it. Every field is checked with the quote
 * file's own readers, under the same limits, and unknown fields are dropped.
 * Both "Open" buttons accept both kinds of file, and anything else changes
 * nothing.
 */
import { DEFAULT_BUSINESS_NAME, LIMITS, newItemId } from "../quote-builder/model.js";
import QUOTE_COPY from "../quote-builder/copy.js";
import {
  BadFile,
  date,
  parseQuoteFile,
  readBusinessFields,
  readCustomer,
  readItems,
  readOverallDiscount,
  text,
} from "../quote-builder/quoteFile.js";
import { INVOICE_LIMITS } from "./model.js";

export const FILE_FORMAT = "jura-invoice-builder";
// Rises when a new field can change a printed figure (ADR 0004, ADR 0005).
export const FILE_VERSION = 1;
// Files over this are refused before they are read, as the quote builder does.
export const FILE_MAX_BYTES = 3 * 1024 * 1024;

export function serialiseInvoice(invoice, now = new Date()) {
  const items = invoice.items.map(({ id, ...rest }) => rest);
  return JSON.stringify(
    { format: FILE_FORMAT, version: FILE_VERSION, savedAt: now.toISOString(), invoice: { ...invoice, items } },
    null,
    2
  );
}

function readInvoice(raw) {
  if (!raw || typeof raw !== "object") throw new BadFile("invoice");
  const d = raw.details ?? {};
  const g = raw.gst ?? {};
  const items = readItems(raw.items);
  return {
    business: readBusinessFields(raw.business),
    customer: readCustomer(raw.customer),
    details: { number: text(d.number, LIMITS.number), date: date(d.date), dueDate: date(d.dueDate) },
    items,
    overallDiscount: readOverallDiscount(raw.overallDiscount),
    // Only the boolean true switches GST on, so a damaged value opens as an invoice, not a tax invoice.
    gst: { on: g.on === true, rate: text(g.rate, LIMITS.amount), regNo: text(g.regNo, LIMITS.short) },
    payment: text(raw.payment, INVOICE_LIMITS.payment),
    notes: text(raw.notes, LIMITS.notes),
  };
}

/** Returns { ok: true, invoice } or { ok: false } for anything that is not one of our invoice files. */
export function parseInvoiceFile(contents) {
  try {
    const data = JSON.parse(contents);
    if (!data || data.format !== FILE_FORMAT) return { ok: false };
    if (!Number.isInteger(data.version) || data.version < 1 || data.version > FILE_VERSION) return { ok: false };
    return { ok: true, invoice: readInvoice(data.invoice) };
  } catch {
    return { ok: false };
  }
}

const BUSINESS_TEXT = ["name", "address", "uen", "phone", "email"];
const blank = (value) => !String(value ?? "").trim();

/**
 * The page's business details, with only the empty ones filled from the
 * quote's (decision D7). A quote saved with no business name carries the
 * quote builder's stand-in, Jura's name, which never goes on an invoice (D2).
 */
function fillBusiness(page, quote) {
  const business = { ...page };
  for (const key of BUSINESS_TEXT) {
    const theirs = quote[key] ?? "";
    if (key === "name" && theirs === DEFAULT_BUSINESS_NAME) continue;
    if (blank(page[key]) && !blank(theirs)) business[key] = theirs;
  }
  if (!page.logo && quote.logo) business.logo = quote.logo;
  return business;
}

/**
 * An invoice started from a quote (decision D7), over the invoice on the page.
 * The quote brings the customer, items, overall discount, notes and GST
 * setting; the page keeps its number, dates, payment details and business
 * details. `pricesIncludedGst` is true for a quote whose prices include GST:
 * the invoice keeps the prices as typed and adds GST on top, so the page
 * warns the visitor (decision D6).
 */
export function invoiceFromQuote(quote, current) {
  const notes = quote.notes.trim() === QUOTE_COPY.defaultNotes.trim() ? "" : quote.notes;
  const invoice = {
    ...current,
    business: fillBusiness(current.business, quote.business),
    customer: { ...quote.customer },
    items: quote.items.map(({ description, quantity, unit, unitPrice, discountType, discountValue }) => ({
      id: newItemId(),
      description,
      quantity,
      unit,
      unitPrice,
      discountType,
      discountValue,
    })),
    overallDiscount: { ...quote.overallDiscount },
    gst: {
      on: quote.gst.on === true,
      rate: quote.gst.rate,
      regNo: blank(current.gst.regNo) ? quote.gst.regNo : current.gst.regNo,
    },
    notes,
  };
  return { invoice, pricesIncludedGst: quote.gst.on === true && quote.gst.inclusive === true };
}

/**
 * Either kind of file, over the invoice on the page:
 *   { ok: true, kind: "invoice" | "quote", invoice, pricesIncludedGst, previousNumber }
 * or { ok: false }, with `current` untouched. An opened invoice's number is
 * the visitor's own, so `previousNumber` is that number: passed to
 * setInvoiceDate, it stops a new date from renumbering the invoice.
 */
export function openAnyFile(contents, current) {
  if (typeof contents !== "string" || contents.length > FILE_MAX_BYTES) return { ok: false };
  const saved = parseInvoiceFile(contents);
  if (saved.ok) {
    return { ok: true, kind: "invoice", invoice: saved.invoice, pricesIncludedGst: false, previousNumber: saved.invoice.details.number };
  }
  const quote = parseQuoteFile(contents);
  if (!quote.ok) return { ok: false };
  return { ok: true, kind: "quote", ...invoiceFromQuote(quote.quote, current) };
}

/** A file the visitor picked. One over 3 MB is refused before it is read. */
export async function openPickedFile(file, current) {
  if (!file || file.size > FILE_MAX_BYTES) return { ok: false };
  try {
    return openAnyFile(await file.text(), current);
  } catch {
    return { ok: false };
  }
}
