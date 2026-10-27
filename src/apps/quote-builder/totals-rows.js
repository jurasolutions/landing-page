/**
 * Which totals rows a quote shows, and what they say. The preview and the PDF
 * both loop over this, so the rules live in one place and the two documents
 * cannot drift apart.
 *
 * `rows` are the lines above the final total line, in order. `breakdown` are
 * muted lines printed below it, and `note` is a statement line. The final
 * "Total" line itself stays in each renderer, because the PDF styles it
 * separately.
 *
 * Pure: no React, no pdf-lib.
 */
import { formatCents, formatPercent } from "./calc.js";

/**
 * @param {object} quote the quote (reads `gst.on`)
 * @param {object} totals the result of `quoteTotals(quote)`
 * @param {object} copy the tool's copy (reads `copy.pdf`)
 * @returns {{ rows: {label: string, value: string}[], breakdown: {label: string, value: string}[], note: string | null }}
 */
export function totalsRows(quote, totals, copy) {
  const P = copy.pdf;
  const hasDiscount = totals.discount > 0n;
  const rows = [{ label: P.subtotal, value: formatCents(totals.subtotal) }];

  if (hasDiscount) rows.push({ label: P.discount, value: `-${formatCents(totals.discount)}` });
  if (quote.gst.on) {
    if (hasDiscount) rows.push({ label: P.taxable, value: formatCents(totals.taxable) });
    rows.push({ label: P.gst(formatPercent(totals.gstRate)), value: formatCents(totals.gst) });
  }

  return { rows, breakdown: [], note: null };
}
