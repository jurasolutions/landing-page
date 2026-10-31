/**
 * What a tax invoice still needs before "Download PDF" makes a file
 * (decision D4, technical.md §5). Checked only while GST is on; with GST off
 * nothing is required.
 *
 * In the order of the form: business name, address, GST registration number,
 * customer name, customer address, invoice number, invoice date, GST rate,
 * then the items. Whitespace-only counts as missing, and so does text that
 * prints as nothing (characters the PDF's font can't print). "Counted" items follow
 * calc.js: a line counts when it has a quantity above zero and a description
 * or a price.
 *
 * Each entry is `{ key, label, target }`: `label` is the PRD's field label,
 * shown as "Please add: {label}", and `target` is the id of the input the
 * entry links to. The ids are the form's (InvoiceForm.jsx, ItemEditor).
 *
 * Pure: no React.
 */
import { toPrintable } from "../quote-builder/winansi.js";
import COPY from "./copy.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Blank as it prints: pdf.js prints `toPrintable(value)`, so a field typed
// only in characters the PDF's font can't print (Chinese, for example) would
// leave the IRAS item off the invoice. The page's "Some characters can't go
// into the PDF" warning already says why (QA defect 02).
const blank = (value) => !toPrintable(String(value ?? "")).trim();
const itemId = (item, field) => `qb-item-${item.id}-${field}`;

/**
 * @param {object} invoice the invoice as it prints (model.js)
 * @param {object} totals `quoteTotals(invoice)`
 * @param {object} copy the tool's copy (reads business, customer, details, gst, missing)
 * @returns {{ key: string, label: string, target: string }[]}
 */
export function missingFields(invoice, totals, copy = COPY) {
  if (invoice.gst?.on !== true) return [];

  const { business, customer, details, gst, items } = invoice;
  const missing = [];
  const need = (key, label, target, isMissing) => {
    if (isMissing) missing.push({ key, label, target });
  };

  need("businessName", copy.business.name, "ib-business-name", blank(business.name));
  need("businessAddress", copy.business.address, "ib-business-address", blank(business.address));
  need("gstRegNo", copy.gst.regNo, "ib-gst-reg", blank(gst.regNo));
  need("customerName", copy.customer.company, "ib-customer-company", blank(customer.company));
  need("customerAddress", copy.customer.address, "ib-customer-address", blank(customer.address));
  need("number", copy.details.number, "ib-number", blank(details.number));
  need("date", copy.details.date, "ib-date", !ISO_DATE.test(details.date ?? ""));
  // calc.js flags a rate that is empty, not a number, or above 100.
  need("gstRate", copy.gst.rate, "ib-gst-rate", Boolean(totals.errors.gstRate));

  const counted = items.filter((_, index) => totals.lines[index]?.included);
  if (counted.length === 0) {
    const first = items[0];
    let target = "ib-add-item";
    if (first) target = blank(first.description) ? itemId(first, "description") : itemId(first, "quantity");
    need("items", copy.missing.items, target, true);
  }
  items.forEach((item, index) => {
    if (!totals.lines[index]?.included) return;
    need(`item-${item.id}-description`, copy.missing.itemDescription(index + 1), itemId(item, "description"), blank(item.description));
  });

  return missing;
}
