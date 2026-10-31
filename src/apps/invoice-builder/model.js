/**
 * The invoice as the form holds it. As in the quote builder, every money and
 * quantity field is the string the visitor typed; the quote builder's calc.js
 * turns them into integer cents, so a saved file re-opens to exactly what was
 * on screen.
 *
 *   {
 *     business: { name, address, uen, phone, email, logo },
 *     customer: { company, contact, address, email },
 *     details:  { number, date, dueDate },       // dueDate "" when blank
 *     items:    [{ id, description, quantity, unit, unitPrice, discountType, discountValue }],
 *     overallDiscount: { type, value },
 *     gst:      { on, rate, regNo },              // no `inclusive`: GST is always added on top
 *     payment:  "",
 *     notes:    "",
 *   }
 *
 * Unlike the quote, nothing stands in for an empty field: the business name
 * never falls back to Jura's (decision D2), and the suggested number is real
 * text in the field (decision D3), so what the form holds is what prints.
 */
import { LIMITS, emptyBusiness, emptyItem, isoDate, nextNumber } from "../quote-builder/model.js";

/**
 * GST standard rate default, re-checked for the invoice builder.
 * Sources (PRD A-0002 §4):
 *   https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/basics-of-gst/current-gst-rates
 *   "The current GST rate in Singapore is 9%."
 *   https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/basics-of-gst/invoicing-price-display-and-record-keeping/invoicing-customers
 *   (what a tax invoice carries, and rounding the total GST to the nearest cent)
 * checked 2026-10-31 (PRD A-0002). The build had no web access, so the
 * build-day re-check of both pages is left to Ting Yu at the release gate
 * (decision D16). The field stays editable so nobody is stuck with a stale rate.
 */
export const DEFAULT_GST_RATE = "9";

/** The quote's limits, plus the payment details. */
export const INVOICE_LIMITS = { ...LIMITS, payment: 1000 };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The suggested number for an invoice dated `date`: INV-YYYYMMDD-01, or the
 * number after `previous` when that was a suggestion for the same date
 * (-01 becomes -02 after "New invoice"). Empty for a blank or malformed date.
 */
export function suggestNumber(date, previous = "") {
  const match = ISO.exec(date ?? "");
  if (!match) return "";
  const stem = `INV-${match[1]}${match[2]}${match[3]}-`;
  const prev = String(previous ?? "").trim();
  if (prev.startsWith(stem) && /^\d+$/.test(prev.slice(stem.length))) return nextNumber(prev);
  return `${stem}01`;
}

/** True when `number` is what suggestNumber gives for some date and this `previous`. */
function isSuggestion(number, previous) {
  const match = /^INV-(\d{4})(\d{2})(\d{2})-\d+$/.exec(number);
  return Boolean(match) && suggestNumber(`${match[1]}-${match[2]}-${match[3]}`, previous) === number;
}

/**
 * The invoice with a new date. While the number is still the suggestion, it
 * follows the date; once the visitor has typed or cleared it, it is theirs.
 */
export function setInvoiceDate(invoice, date, previous = "") {
  const details = { ...invoice.details, date };
  const suggested = suggestNumber(date, previous);
  if (suggested && isSuggestion(invoice.details.number, previous)) details.number = suggested;
  return { ...invoice, details };
}

function gstOf(gst) {
  if (!gst) return { on: false, rate: DEFAULT_GST_RATE, regNo: "" };
  return { on: gst.on === true, rate: gst.rate ?? DEFAULT_GST_RATE, regNo: gst.regNo ?? "" };
}

/**
 * A new invoice. `business`, `gst` and `payment` come from what was
 * remembered or the invoice before; `previous` is the last number used, so
 * a second invoice on the same day is suggested as -02.
 */
export function newInvoice({ business = emptyBusiness(), gst, payment = "", today = isoDate(), previous = "" } = {}) {
  return {
    business,
    customer: { company: "", contact: "", address: "", email: "" },
    details: { number: suggestNumber(today, previous), date: today, dueDate: "" },
    items: [emptyItem()],
    overallDiscount: { type: "none", value: "" },
    gst: gstOf(gst),
    payment,
    notes: "",
  };
}

/**
 * "New invoice" (decision D10): keeps the business, the GST setting and the
 * payment details, clears the customer, items, overall discount and notes,
 * resets the dates to today and suggests the next number.
 */
export function nextInvoice(current, { today = isoDate() } = {}) {
  return newInvoice({
    business: current.business,
    gst: current.gst,
    payment: current.payment,
    today,
    previous: current.details.number,
  });
}
