/**
 * APP-005 Invoice builder: a clean invoice, made and kept in the browser.
 *
 * Form on the left and a live preview on the right (stacked on a phone, with
 * an Edit and Preview switch). Everything stays on the device: the only
 * request is the shared, anonymous usage counter, and pdf-lib is fetched only
 * when a PDF is wanted.
 *
 * The parts:
 *   - GstFields.jsx: the GST switch, rate and registration number.
 *   - `missingFields` (required.js) in `downloadPdf`, shown by MissingSummary:
 *     with GST on, the required-field check and its linked list.
 *   - FileActions.jsx and `openInvoice`: Save and Open, and replacing the whole
 *     invoice with one opened from a file.
 */
import React from "react";
import { Alert, Button, Dialog, Icon, Toast } from "../../ds.js";
import { ExportButtons } from "../_shared/ExportButtons.jsx";
import { saveBlob } from "../_shared/download.js";
import { trackUsage } from "../_shared/usage.js";
import { useToast } from "../_shared/useToast.js";
import { useFocusReturn } from "../_shared/focus.js";
import { quoteTotals } from "../quote-builder/calc.js";
import { readLogo, logoForPdf, rasteriseLogo } from "../quote-builder/logo.js";
import { unprintableIn } from "../quote-builder/winansi.js";
import { newInvoice, nextInvoice } from "./model.js";
import { forgetBusiness, loadBusiness, saveBusiness } from "./remember.js";
import { downloadInvoice, hasFigureErrors } from "./download.js";
import { missingFields } from "./required.js";
import { MissingSummary } from "./MissingSummary.jsx";
import { InvoiceForm } from "./InvoiceForm.jsx";
import { InvoicePreview } from "./InvoicePreview.jsx";
import { useInvoiceFiles } from "./FileActions.jsx";
import "../quote-builder/quote-builder.css";

// pdf-lib is only fetched when a PDF is wanted, and warmed up once the page
// is idle so the first download is quick.
const loadPdf = () => import("./pdf.js");

function rememberedStart() {
  const stored = loadBusiness();
  if (!stored) return { invoice: newInvoice(), remember: false, lastNumber: "" };
  const { business, gst, payment, lastNumber } = stored;
  return { invoice: newInvoice({ business, gst, payment, previous: lastNumber }), remember: true, lastNumber };
}

/** Everything the PDF prints, for the "can't go into the PDF" warning. */
function allText(invoice) {
  const b = invoice.business;
  const c = invoice.customer;
  return [
    b.name, b.address, b.uen, b.phone, b.email,
    c.company, c.contact, c.address, c.email,
    invoice.details.number, invoice.gst.on ? invoice.gst.regNo : "", invoice.payment, invoice.notes,
    ...invoice.items.flatMap((item) => [item.description, item.unit]),
  ];
}

/** Builds the PDF, redrawing a logo pdf-lib cannot embed as a plain PNG. */
async function buildPdf(invoice, totals, copy) {
  const { buildInvoicePdf } = await loadPdf();
  const logo = await logoForPdf(invoice.business.logo);
  try {
    return await buildInvoicePdf(invoice, totals, copy, { logo });
  } catch (error) {
    if (!logo) throw error;
    return buildInvoicePdf(invoice, totals, copy, { logo: await rasteriseLogo(invoice.business.logo) });
  }
}

export default function InvoiceBuilder({ app, copy }) {
  const start = React.useMemo(rememberedStart, []);
  const [invoice, setInvoice] = React.useState(start.invoice);
  const [remember, setRemember] = React.useState(start.remember);
  // `lastNumber` is the number before this invoice's, which the suggestion
  // follows on from. `usedNumber` is the last number downloaded or moved
  // past, which "Remember" keeps for next time.
  const [lastNumber, setLastNumber] = React.useState(start.lastNumber);
  const [usedNumber, setUsedNumber] = React.useState(start.lastNumber);
  const [rememberBlocked, setRememberBlocked] = React.useState(false);
  const [view, setView] = React.useState("edit");
  const [logoError, setLogoError] = React.useState("");
  const [pdfState, setPdfState] = React.useState("idle"); // idle | working | failed | figures | missing
  // Counts the downloads that found fields missing, to focus the list's heading each time.
  const [missingAsked, setMissingAsked] = React.useState(0);
  const [toast, setToast] = useToast();
  const [confirmNew, setConfirmNew] = React.useState(false);
  const newRef = React.useRef(null);
  // "Download PDF" is disabled while the PDF is made; focus goes back to it.
  const holdFocus = useFocusReturn(pdfState === "working");

  const totals = React.useMemo(() => quoteTotals(invoice), [invoice]);
  const unsupported = React.useMemo(() => unprintableIn(allText(invoice)), [invoice]);

  // With GST on, the missing-fields list follows the form as it is filled in,
  // and goes once nothing is missing or GST is off (missingFields is empty then).
  const missing = React.useMemo(() => (pdfState === "missing" ? missingFields(invoice, totals) : []), [pdfState, invoice, totals]);
  React.useEffect(() => {
    if (pdfState === "missing" && missing.length === 0) setPdfState("idle");
  }, [pdfState, missing]);
  // `actions` renders twice with one copy hidden by CSS: focus the visible heading.
  React.useEffect(() => {
    if (!missingAsked) return;
    const headings = [...document.querySelectorAll("[data-missing-heading]")];
    headings.find((heading) => heading.getClientRects().length > 0)?.focus();
  }, [missingAsked]);
  // A link in the list: back to the form on a phone, then to the input.
  const followMissing = (target) => {
    setView("edit");
    requestAnimationFrame(() => document.getElementById(target)?.focus());
  };

  React.useEffect(() => {
    const warm = () => loadPdf().catch(() => {});
    const handle = "requestIdleCallback" in window ? window.requestIdleCallback(warm) : setTimeout(warm, 1500);
    return () => ("cancelIdleCallback" in window ? window.cancelIdleCallback(handle) : clearTimeout(handle));
  }, []);

  // The business's own details are kept on this device only while
  // "Remember" is ticked (decision D11). Unticking forgets them; editing with
  // it unticked leaves storage alone.
  React.useEffect(() => {
    if (!remember) return undefined;
    const timer = setTimeout(() => {
      const saved = saveBusiness({ business: invoice.business, gst: invoice.gst, payment: invoice.payment, lastNumber: usedNumber });
      setRememberBlocked(!saved);
    }, 300);
    return () => clearTimeout(timer);
  }, [remember, invoice.business, invoice.gst, invoice.payment, usedNumber]);

  const onRemember = (next) => {
    setRemember(next);
    if (!next) {
      forgetBusiness();
      setRememberBlocked(false);
    }
  };

  const onLogo = async (file) => {
    setLogoError("");
    const result = await readLogo(file);
    if (!result.ok) {
      setLogoError(result.reason === "tooBig" ? copy.logoTooBig : copy.business.logoUnreadable);
      return;
    }
    setInvoice((current) => ({ ...current, business: { ...current.business, logo: result.logo } }));
  };

  const downloadPdf = async () => {
    if (pdfState === "working") return;
    holdFocus();
    setPdfState("working");
    try {
      const result = await downloadInvoice(invoice, totals, {
        build: (shown, figures) => buildPdf(shown, figures, copy),
        save: saveBlob,
        track: (event) => trackUsage(app.slug, event),
        missingFields,
      });
      if (result.missing) {
        setPdfState("missing");
        setMissingAsked((count) => count + 1);
        return;
      }
      if (result.figuresToFix) {
        setPdfState("figures");
        return;
      }
      if (result.ok) setUsedNumber(invoice.details.number);
      setPdfState("idle");
    } catch (error) {
      console.error("Invoice PDF failed", error);
      setPdfState("failed");
    }
  };

  /**
   * Replaces the whole invoice with one from a file. Clears what belonged to
   * the invoice before, and returns the phone to the form. An opened
   * invoice's number is the visitor's, so a new date does not renumber it.
   */
  const openInvoice = ({ invoice: next, previousNumber }) => {
    setInvoice(next);
    if (previousNumber !== undefined) setLastNumber(previousNumber);
    setLogoError("");
    setPdfState("idle");
    setView("edit");
  };

  const startNew = () => {
    setLastNumber(invoice.details.number);
    setUsedNumber(invoice.details.number);
    setInvoice((current) => nextInvoice(current));
    setConfirmNew(false);
    setPdfState("idle");
    setLogoError("");
    files.clear();
    setView("edit");
    requestAnimationFrame(() => document.getElementById("ib-customer-company")?.focus());
  };

  const closeDialog = () => {
    setConfirmNew(false);
    requestAnimationFrame(() => newRef.current?.querySelector("button")?.focus());
  };

  // Save invoice file, Open invoice file and Open quote file, their picker and message.
  const files = useInvoiceFiles({ invoice, copy, onOpen: openInvoice, setToast });
  const fileActions = files.actions;

  // `actions` renders in two places, beside the preview and under the form on
  // a phone. CSS shows one at a time, and a hidden live region is silent, so
  // each message is announced once.
  const actions = (
    <div className="qb-actions stack-3">
      <div className="tb-live stack-3" aria-live="polite">
        {pdfState === "failed" && (
          <Alert tone="danger" icon={<Icon name="alert-circle" size={18} />}>
            {copy.pdfFailed}
          </Alert>
        )}
        {pdfState === "figures" && hasFigureErrors(totals) && (
          <Alert tone="danger" icon={<Icon name="alert-circle" size={18} />}>
            {copy.figuresToFix}
          </Alert>
        )}
        {unsupported.length > 0 && (
          <Alert tone="warning" icon={<Icon name="alert-circle" size={18} />}>
            {copy.unsupported(unsupported.join(" "))}
          </Alert>
        )}
        <MissingSummary missing={missing} copy={copy} onFollow={followMissing} />
        {files.notice}
      </div>
      <ExportButtons
        label={copy.sections.output}
        actions={[
          {
            key: "pdf",
            primary: true,
            icon: "file-down",
            label: pdfState === "working" ? copy.working : copy.buttons.downloadPdf,
            disabled: pdfState === "working",
            onClick: downloadPdf,
          },
          ...fileActions,
        ]}
      />
      <span ref={newRef}>
        <Button type="button" variant="ghost" size="lg" onClick={() => setConfirmNew(true)} iconLeft={<Icon name="file-plus" size={20} />}>
          {copy.buttons.newInvoice}
        </Button>
      </span>
    </div>
  );

  return (
    <div className="qb">
      {files.picker}

      {/* Two toggle buttons rather than Tabs: both views stay in the page
          (side by side on a wide screen), so there is no tab panel. */}
      <div className="qb-switch">
        <div className="qb-views" role="group" aria-label={copy.view.label}>
          {["edit", "preview"].map((id) => (
            <button key={id} type="button" className="qb-view" aria-pressed={view === id} onClick={() => setView(id)}>
              {copy.view[id]}
            </button>
          ))}
        </div>
      </div>

      <div className={`qb-grid qb-grid--${view}`}>
        <div className="qb-col-form stack-6">
          <InvoiceForm
            invoice={invoice}
            setInvoice={setInvoice}
            totals={totals}
            copy={copy}
            remember={remember}
            onRemember={onRemember}
            rememberBlocked={rememberBlocked}
            onLogo={onLogo}
            logoError={logoError}
            previousNumber={lastNumber}
          />
        </div>
        <div className="qb-col-preview">
          <div className="qb-sticky stack-5">
            <InvoicePreview invoice={invoice} totals={totals} copy={copy} />
            {actions}
          </div>
        </div>
      </div>

      <div className="qb-actions-mobile">{view === "edit" && actions}</div>

      <Dialog
        open={confirmNew}
        onClose={closeDialog}
        title={copy.newInvoiceDialog.title}
        description={copy.newInvoiceDialog.body}
        footer={
          <>
            <Button type="button" variant="secondary" size="lg" onClick={closeDialog}>
              {copy.newInvoiceDialog.cancel}
            </Button>
            <Button type="button" size="lg" autoFocus onClick={startNew}>
              {copy.newInvoiceDialog.confirm}
            </Button>
          </>
        }
      />

      <div className="qb-toast" aria-live="polite">
        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
