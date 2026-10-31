/**
 * The GST fields, in two places so the form keeps the order of the
 * required-field list (decision D4):
 *
 *   part="business"  under the business's email: "GST registration number",
 *                    shown while GST is on (id `ib-gst-reg`)
 *   part="details"   under the invoice dates: the "Charge GST" switch with its
 *                    helper (id `ib-gst-on`), then, while GST is on,
 *                    "GST rate (%)" with its helper (id `ib-gst-rate`)
 *
 * Switching GST off hides the rate and the registration number but keeps what
 * was typed, so switching it back on brings them back. The PDF and the
 * preview never show them while GST is off.
 *
 * Props: { part, invoice, setInvoice, totals, copy }. The words are in copy.gst.
 */
import React from "react";
import { Switch } from "../../ds.js";
import { NumberField, TextField, errorText } from "../quote-builder/form-parts.jsx";
import { INVOICE_LIMITS as LIMITS } from "./model.js";

export function GstFields({ part, invoice, setInvoice, totals, copy }) {
  const G = copy.gst;
  const gst = invoice.gst;
  const set = (key) => (value) => setInvoice((current) => ({ ...current, gst: { ...current.gst, [key]: value } }));

  if (part === "business") {
    if (!gst.on) return null;
    return <TextField id="ib-gst-reg" label={G.regNo} value={gst.regNo} onChange={set("regNo")} maxLength={LIMITS.short} spellCheck={false} />;
  }

  return (
    <>
      <div>
        <Switch
          id="ib-gst-on"
          label={G.switch}
          checked={gst.on}
          onChange={(event) => set("on")(event.target.checked)}
          aria-describedby="ib-gst-on-help"
        />
        <p className="qb-hint" id="ib-gst-on-help">
          {G.helper}
        </p>
      </div>
      {gst.on && (
        <NumberField
          id="ib-gst-rate"
          label={G.rate}
          hint={G.rateHelper}
          value={gst.rate}
          onChange={set("rate")}
          error={errorText(totals.errors.gstRate, copy)}
        />
      )}
    </>
  );
}
