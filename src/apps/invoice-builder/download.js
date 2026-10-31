/**
 * The "Download PDF" step, apart from the page so a test can reach it
 * (decisions D13, D14, D15).
 *
 * In order: no file while a required field is missing (the check is passed
 * in: ticket 03's `missingFields`, which applies only with GST on and lists
 * a bad GST rate with a link to it); no file while a figure in the form shows
 * an error; otherwise build the PDF, save it and count one "complete". A build that throws is passed on to the
 * page, and nothing is counted.
 *
 * Returns { ok: true }, { figuresToFix: true } or { missing: [...] }.
 */
import { safeFilename } from "../_shared/download.js";

/** True when any figure the totals read has an error showing in the form. */
export function hasFigureErrors(totals) {
  return Object.keys(totals.errors).length > 0 || totals.lines.some((line) => Object.keys(line.errors).length > 0);
}

export function pdfFilename(invoice) {
  return `${safeFilename(invoice.details.number, "invoice")}.pdf`;
}

/**
 * @param {object} invoice the invoice as it prints
 * @param {object} totals `quoteTotals(invoice)`
 * @param {object} steps
 *   build(invoice, totals) -> Promise<{ bytes }>, the lazy-loaded PDF builder
 *   save(blob, filename), usually `saveBlob`
 *   track(event), usually `(event) => trackUsage(slug, event)`
 *   missingFields(invoice, totals) -> [{ key, label, target }], optional
 */
export async function downloadInvoice(invoice, totals, { build, save, track, missingFields = () => [] }) {
  const missing = missingFields(invoice, totals);
  if (missing.length) return { missing };
  if (hasFigureErrors(totals)) return { figuresToFix: true };
  const { bytes } = await build(invoice, totals);
  save(new Blob([bytes], { type: "application/pdf" }), pdfFilename(invoice));
  track("complete");
  return { ok: true };
}
