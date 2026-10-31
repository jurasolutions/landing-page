/**
 * Which totals rows an invoice shows, and what they say (decision D5,
 * technical.md §7). The preview and the PDF both loop over this, so they
 * cannot disagree about a row, or about "Total" against "Amount with GST".
 *
 * | Case                 | rows                                              | final           |
 * |----------------------|---------------------------------------------------|-----------------|
 * | GST off, no discount | (none)                                            | Total           |
 * | GST off, discount    | Subtotal, Discount                                | Total           |
 * | GST on, no discount  | Amount before GST, GST (r%)                       | Amount with GST |
 * | GST on, discount     | Subtotal, Discount, Amount before GST, GST (r%)   | Amount with GST |
 *
 * Subtotal and Discount show only with a discount, because without one the
 * subtotal is the line below it. With GST on, the amount before GST always
 * shows: a tax invoice states the amount excluding GST whether or not there is
 * a discount. With GST off, nothing here mentions GST.
 *
 * Pure: no React, no pdf-lib.
 */
import { formatCents, formatPercent, parsePercent } from "../quote-builder/calc.js";

/**
 * One line's discount cell in the items table: the rate for a percentage
 * ("12.5%"), the money taken off for an amount ("5.00"), or "" with no
 * discount. The preview and the PDF both use it.
 *
 * @param {object} item the line as typed
 * @param {object} line its figures, `quoteTotals(invoice).lines[i]`
 */
export function discountCell(item, line) {
  if (line.discount <= 0n) return "";
  if (item.discountType === "percent") return `${formatPercent(parsePercent(item.discountValue).value ?? 0n)}%`;
  return formatCents(line.discount);
}

/**
 * @param {object} invoice the invoice (reads `gst.on`)
 * @param {object} totals `quoteTotals(invoice)`
 * @param {object} copy the tool's copy (reads `copy.totals`)
 * @returns {{ rows: {label: string, value: string}[], final: {label: string, value: string} }}
 */
export function invoiceTotalsRows(invoice, totals, copy) {
  const T = copy.totals;
  const rows = [];
  if (totals.discount > 0n) {
    rows.push({ label: T.subtotal, value: formatCents(totals.subtotal) });
    rows.push({ label: T.discount, value: `-${formatCents(totals.discount)}` });
  }
  if (!invoice.gst.on) return { rows, final: { label: T.total, value: formatCents(totals.total) } };

  rows.push({ label: T.taxable, value: formatCents(totals.taxable) });
  rows.push({ label: T.gstAt(formatPercent(totals.gstRate)), value: formatCents(totals.gst) });
  return { rows, final: { label: T.withGst, value: formatCents(totals.total) } };
}
