/**
 * Seam for ticket 03 (the tax invoice): the GST fields, in two places so the
 * form keeps the order of the required-field list (decision D4).
 *
 *   part="business"  under the business's email: "GST registration number",
 *                    shown while GST is on (id `ib-gst-reg`)
 *   part="details"   under the invoice dates: the "Charge GST" switch with its
 *                    helper, then "GST rate (%)" with its helper (id `ib-gst-rate`)
 *
 * Props: { part, invoice, setInvoice, totals, copy }. The words are in
 * copy.gst. The model, the totals rows and the PDF already follow
 * `invoice.gst`; until ticket 03 fills this in, GST stays off.
 */
export function GstFields() {
  return null;
}
