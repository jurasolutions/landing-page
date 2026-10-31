/**
 * "Remember my business details on this device" (decision D11).
 *
 * Kept on this device under the invoice builder's own key, through the
 * shared storage helpers, which never throw: blocked storage only means
 * nothing is remembered. What is kept is the business's own: the "Your
 * business" section with its logo, the GST setting, the payment details and
 * the last invoice number. Never the customer, items, dates or notes.
 *
 * What is read back is checked field by field, because anyone can edit it.
 */
import { readStored, removeStored, writeStored } from "../_shared/storage.js";
import { readBusiness } from "../quote-builder/quoteFile.js";
import { readGst } from "../quote-builder/model.js";
import { INVOICE_LIMITS } from "./model.js";

export const REMEMBER_KEY = "jura.invoice-builder.business.v1";

const textOf = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");

/** { business, gst, payment, lastNumber }, or null when nothing usable is stored. */
export function loadBusiness() {
  const stored = readStored(REMEMBER_KEY);
  const business = stored ? readBusiness(stored.business) : null;
  if (!business) return null;
  const gst = readGst(stored.gst);
  return {
    business,
    gst: gst ? { on: gst.on, rate: gst.rate, regNo: gst.regNo } : undefined,
    payment: textOf(stored.payment, INVOICE_LIMITS.payment),
    lastNumber: textOf(stored.lastNumber, INVOICE_LIMITS.number),
  };
}

/**
 * Stores the details. A large logo can fill the browser's quota, so the
 * words are kept without it then. Returns false when nothing could be stored.
 */
export function saveBusiness({ business, gst, payment = "", lastNumber = "" }) {
  const value = { business, gst: { on: gst.on, rate: gst.rate, regNo: gst.regNo }, payment, lastNumber };
  return writeStored(REMEMBER_KEY, value) || writeStored(REMEMBER_KEY, { ...value, business: { ...business, logo: null } });
}

export function forgetBusiness() {
  removeStored(REMEMBER_KEY);
}
