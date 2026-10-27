/**
 * Which totals rows a quote shows, and what they say. The preview and the PDF
 * both loop over this, so the rules live in one place and the two documents
 * cannot drift apart.
 *
 * `rows` are the lines above the final total line, in order. `breakdown` are
 * muted lines printed below it, and `note` is a muted statement of how prices
 * are quoted. The final "Total" line itself stays in each renderer, because
 * the PDF styles it separately.
 *
 * Prices added to (exclusive): Subtotal, Discount, Total before GST (only with
 * a discount), GST, then the total. The note says GST is added at the rate shown.
 *
 * Prices include GST (`totals.inclusive`): the sum finishes first, Subtotal and
 * Discount then the total, so it never looks like an arithmetic mistake. The
 * split sits below it as `breakdown`: Total before GST, Includes GST. The note
 * says prices include GST.
 *
 * With GST off there is no breakdown and no note, whatever the stored choice.
 *
 * Pure: no React, no pdf-lib.
 */
import { formatCents, formatPercent } from "./calc.js";

/**
 * @param {object} quote the quote (reads `gst.on`)
 * @param {object} totals the result of `quoteTotals(quote)` (reads `inclusive`)
 * @param {object} copy the tool's copy (reads `copy.pdf`)
 * @returns {{ rows: {label: string, value: string}[], breakdown: {label: string, value: string}[], note: string | null }}
 */
export function totalsRows(quote, totals, copy) {
  const P = copy.pdf;
  const hasDiscount = totals.discount > 0n;
  const rows = [{ label: P.subtotal, value: formatCents(totals.subtotal) }];

  if (hasDiscount) rows.push({ label: P.discount, value: `-${formatCents(totals.discount)}` });
  if (!quote.gst.on) return { rows, breakdown: [], note: null };

  const rate = formatPercent(totals.gstRate);
  if (totals.inclusive) {
    return {
      rows,
      breakdown: [
        { label: P.taxable, value: formatCents(totals.taxable) },
        { label: P.gstIncluded(rate), value: formatCents(totals.gst) },
      ],
      note: P.pricesInclude,
    };
  }

  if (hasDiscount) rows.push({ label: P.taxable, value: formatCents(totals.taxable) });
  rows.push({ label: P.gst(rate), value: formatCents(totals.gst) });
  return { rows, breakdown: [], note: P.pricesExclude };
}
