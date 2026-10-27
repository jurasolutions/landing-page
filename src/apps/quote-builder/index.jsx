import React from "react";
import { Alert, Button, Dialog, Icon, Toast } from "../../ds.js";
import { ExportButtons } from "../_shared/ExportButtons.jsx";
import { readStored, removeStored, writeStored } from "../_shared/storage.js";
import { safeFilename, saveBlob } from "../_shared/download.js";
import { trackUsage } from "../_shared/usage.js";
import { useToast } from "../_shared/useToast.js";
import { useFocusReturn } from "../_shared/focus.js";
import { quoteTotals } from "./calc.js";
import { LIMITS, effectiveQuote, newQuote, nextNumber, readGst } from "./model.js";
import { parseQuoteFile, readBusiness, serialiseQuote } from "./quoteFile.js";
import { readLogo, logoForPdf, rasteriseLogo } from "./logo.js";
import { unprintableIn } from "./winansi.js";
import { QuoteForm } from "./QuoteForm.jsx";
import { QuotePreview } from "./QuotePreview.jsx";
import { AiDraft } from "./AiDraft.jsx";
import { applyDraft } from "./draft.js";
import "./quote-builder.css";

const STORE_KEY = "jura.quote-builder.business.v1";

// pdf-lib is only fetched when a PDF is wanted, and warmed up once the page
// is idle so the first download is quick.
const loadPdf = () => import("./pdf.js");

/** The last quote number used on this device, kept with the business details. */
function storedNumber(stored) {
  return typeof stored?.lastNumber === "string" ? stored.lastNumber.slice(0, LIMITS.number) : "";
}

function rememberedStart() {
  const stored = readStored(STORE_KEY);
  const business = stored ? readBusiness(stored.business) : null;
  if (!business) return { quote: newQuote(), remember: false, lastNumber: "" };
  const gst = readGst(stored.gst);
  return { quote: newQuote({ business, gst }), remember: true, lastNumber: storedNumber(stored) };
}

function allText(quote) {
  const b = quote.business;
  const c = quote.customer;
  return [
    b.name, b.address, b.uen, b.phone, b.email,
    c.company, c.contact, c.address, c.email,
    quote.details.number, quote.gst.on ? quote.gst.regNo : "", quote.notes,
    ...quote.items.flatMap((item) => [item.description, item.unit]),
  ];
}

export default function QuoteBuilder({ app, copy }) {
  const start = React.useMemo(rememberedStart, []);
  const [quote, setQuote] = React.useState(start.quote);
  const [remember, setRemember] = React.useState(start.remember);
  // The running number: the next quote's number follows `lastNumber`, the
  // number of the quote before this one. `usedNumber` is the last number
  // downloaded or moved past, which is what "Remember" keeps for next time.
  const [lastNumber, setLastNumber] = React.useState(start.lastNumber);
  const [usedNumber, setUsedNumber] = React.useState(start.lastNumber);
  const [rememberBlocked, setRememberBlocked] = React.useState(false);
  const [view, setView] = React.useState("edit");
  const [logoError, setLogoError] = React.useState("");
  const [fileError, setFileError] = React.useState("");
  const [pdfState, setPdfState] = React.useState("idle"); // idle | working | failed
  const [toast, setToast] = useToast();
  const [confirmNew, setConfirmNew] = React.useState(false);
  const openRef = React.useRef(null);
  const newRef = React.useRef(null);
  // "Download PDF" is disabled while the PDF is made; focus goes back to it.
  const holdFocus = useFocusReturn(pdfState === "working");

  const suggestedNumber = nextNumber(lastNumber);
  // What prints: placeholders stand in for an empty business name and number.
  const shown = React.useMemo(() => effectiveQuote(quote, suggestedNumber), [quote, suggestedNumber]);
  const totals = React.useMemo(() => quoteTotals(quote), [quote]);
  const unsupported = React.useMemo(() => unprintableIn(allText(shown)), [shown]);

  React.useEffect(() => {
    const warm = () => loadPdf().catch(() => {});
    const handle = "requestIdleCallback" in window ? window.requestIdleCallback(warm) : setTimeout(warm, 1500);
    return () => ("cancelIdleCallback" in window ? window.cancelIdleCallback(handle) : clearTimeout(handle));
  }, []);

  // Business details (and the GST setting that goes with them) are kept on
  // this device only while "Remember" is ticked. Unticking forgets them
  // (onRemember below). Editing with Remember unticked leaves storage alone,
  // so a second tab that never ticked it cannot erase what this one saved.
  React.useEffect(() => {
    if (!remember) return undefined;
    const timer = setTimeout(() => {
      const saved =
        writeStored(STORE_KEY, { business: quote.business, gst: quote.gst, lastNumber: usedNumber }) ||
        // A large logo can fill the browser's quota; keep the words at least.
        writeStored(STORE_KEY, { business: { ...quote.business, logo: null }, gst: quote.gst, lastNumber: usedNumber });
      setRememberBlocked(!saved);
    }, 300);
    return () => clearTimeout(timer);
  }, [remember, quote.business, quote.gst, usedNumber]);

  const onRemember = (next) => {
    setRemember(next);
    if (!next) {
      removeStored(STORE_KEY);
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
    setQuote((current) => ({ ...current, business: { ...current.business, logo: result.logo } }));
  };

  const fileBase = safeFilename(shown.details.number, "quote");

  const downloadPdf = async () => {
    if (pdfState === "working") return;
    holdFocus();
    setPdfState("working");
    try {
      const { buildQuotePdf } = await loadPdf();
      let logo = await logoForPdf(shown.business.logo);
      let result;
      try {
        result = await buildQuotePdf(shown, totals, copy, { logo });
      } catch (error) {
        if (!logo) throw error;
        // An unusual PNG or JPG that pdf-lib cannot embed: redraw it as a plain PNG.
        logo = await rasteriseLogo(shown.business.logo);
        result = await buildQuotePdf(shown, totals, copy, { logo });
      }
      saveBlob(new Blob([result.bytes], { type: "application/pdf" }), `${fileBase}.pdf`);
      trackUsage(app.slug, "complete");
      setUsedNumber(shown.details.number);
      setPdfState("idle");
    } catch (error) {
      console.error("Quote PDF failed", error);
      setPdfState("failed");
    }
  };

  const saveFile = () => {
    saveBlob(new Blob([serialiseQuote(shown)], { type: "application/json" }), `${fileBase}.quote.json`);
  };

  const openFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileError("");
    const result = file.size > 3 * 1024 * 1024 ? { ok: false } : parseQuoteFile(await file.text());
    if (!result.ok) {
      setFileError(copy.badFile);
      return;
    }
    setQuote(result.quote);
    setToast(copy.opened);
  };

  const startNew = () => {
    // A new quote keeps the business, its GST setting and the Made with
    // choice, and takes the next running number.
    setLastNumber(shown.details.number);
    setUsedNumber(shown.details.number);
    setQuote((current) => ({
      ...newQuote({ business: current.business, gst: current.gst }),
      madeWith: current.madeWith,
    }));
    setConfirmNew(false);
    setFileError("");
    setPdfState("idle");
    setView("edit");
    requestAnimationFrame(() => document.getElementById("qb-customer-company")?.focus());
  };

  const onDraft = (draft) => {
    setQuote((current) => applyDraft(current, draft, copy));
    setToast(copy.ai.done);
  };

  const closeDialog = () => {
    setConfirmNew(false);
    requestAnimationFrame(() => newRef.current?.querySelector("button")?.focus());
  };

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
        {fileError && (
          <Alert tone="danger" icon={<Icon name="alert-circle" size={18} />}>
            {fileError}
          </Alert>
        )}
        {unsupported.length > 0 && (
          <Alert tone="warning" icon={<Icon name="alert-circle" size={18} />}>
            {copy.unsupported(unsupported.join(" "))}
          </Alert>
        )}
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
          { key: "save", icon: "save", label: copy.buttons.saveFile, onClick: saveFile },
          { key: "open", icon: "folder-open", label: copy.buttons.openFile, onClick: () => openRef.current?.click() },
        ]}
      />
      <span ref={newRef}>
        <Button type="button" variant="ghost" size="lg" onClick={() => setConfirmNew(true)} iconLeft={<Icon name="file-plus" size={20} />}>
          {copy.buttons.newQuote}
        </Button>
      </span>
    </div>
  );

  return (
    <div className="qb">
      <input
        ref={openRef}
        type="file"
        accept=".json,application/json"
        className="tb-visually-hidden"
        tabIndex={-1}
        aria-label={copy.buttons.openFile}
        onChange={openFile}
      />

      {/* Two toggle buttons rather than Tabs: both views stay in the page
          (side by side on a wide screen), so there is no tab panel. */}
      <div className="qb-switch">
        <div className="qb-views" role="group" aria-label={copy.view.label}>
          {["edit", "preview"].map((id) => (
            <button
              key={id}
              type="button"
              className="qb-view"
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {copy.view[id]}
            </button>
          ))}
        </div>
      </div>

      <div className={`qb-grid qb-grid--${view}`}>
        <div className="qb-col-form stack-6">
          <AiDraft copy={copy} onDraft={onDraft} />
          <QuoteForm
            quote={quote}
            setQuote={setQuote}
            totals={totals}
            copy={copy}
            remember={remember}
            onRemember={onRemember}
            rememberBlocked={rememberBlocked}
            onLogo={onLogo}
            logoError={logoError}
            numberPlaceholder={suggestedNumber}
          />
        </div>
        <div className="qb-col-preview">
          <div className="qb-sticky stack-5">
            <QuotePreview quote={shown} totals={totals} copy={copy} />
            {actions}
          </div>
        </div>
      </div>

      <div className="qb-actions-mobile">{view === "edit" && actions}</div>

      <Dialog
        open={confirmNew}
        onClose={closeDialog}
        title={copy.newQuoteDialog.title}
        description={copy.newQuoteDialog.body}
        footer={
          <>
            <Button type="button" variant="secondary" size="lg" onClick={closeDialog}>
              {copy.newQuoteDialog.cancel}
            </Button>
            <Button type="button" size="lg" autoFocus onClick={startNew}>
              {copy.newQuoteDialog.confirm}
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
