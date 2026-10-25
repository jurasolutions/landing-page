import React from "react";
import { Alert, Button, Dialog, Icon, Toast } from "../../ds.js";
import { ExportButtons } from "../_shared/ExportButtons.jsx";
import { readStored, removeStored, writeStored } from "../_shared/storage.js";
import { safeFilename, saveBlob } from "../_shared/download.js";
import { trackUsage } from "../_shared/usage.js";
import { useToast } from "../_shared/useToast.js";
import { quoteTotals } from "./calc.js";
import { newQuote } from "./model.js";
import { parseQuoteFile, readBusiness, serialiseQuote } from "./quoteFile.js";
import { readLogo, logoForPdf, rasteriseLogo } from "./logo.js";
import { unprintableIn } from "./winansi.js";
import { QuoteForm } from "./QuoteForm.jsx";
import { QuotePreview } from "./QuotePreview.jsx";
import "./quote-builder.css";

const STORE_KEY = "jura.quote-builder.business.v1";

// pdf-lib is only fetched when a PDF is wanted, and warmed up once the page
// is idle so the first download is quick.
const loadPdf = () => import("./pdf.js");

function rememberedStart() {
  const stored = readStored(STORE_KEY);
  const business = stored ? readBusiness(stored.business) : null;
  if (!business) return { quote: newQuote(), remember: false };
  const gst = stored.gst && typeof stored.gst === "object"
    ? {
        on: stored.gst.on === true,
        rate: typeof stored.gst.rate === "string" ? stored.gst.rate.slice(0, 20) : newQuote().gst.rate,
        regNo: typeof stored.gst.regNo === "string" ? stored.gst.regNo.slice(0, 120) : "",
      }
    : undefined;
  return { quote: newQuote({ business, gst }), remember: true };
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
  const [rememberBlocked, setRememberBlocked] = React.useState(false);
  const [view, setView] = React.useState("edit");
  const [logoError, setLogoError] = React.useState("");
  const [fileError, setFileError] = React.useState("");
  const [pdfState, setPdfState] = React.useState("idle"); // idle | working | failed
  const [toast, setToast] = useToast();
  const [confirmNew, setConfirmNew] = React.useState(false);
  const openRef = React.useRef(null);
  const newRef = React.useRef(null);

  const totals = React.useMemo(() => quoteTotals(quote), [quote]);
  const unsupported = React.useMemo(() => unprintableIn(allText(quote)), [quote]);

  React.useEffect(() => {
    const warm = () => loadPdf().catch(() => {});
    const handle = "requestIdleCallback" in window ? window.requestIdleCallback(warm) : setTimeout(warm, 1500);
    return () => ("cancelIdleCallback" in window ? window.cancelIdleCallback(handle) : clearTimeout(handle));
  }, []);

  // Business details (and the GST setting that goes with them) are kept on
  // this device only while "Remember" is ticked. Unticking forgets them.
  React.useEffect(() => {
    if (!remember) {
      removeStored(STORE_KEY);
      setRememberBlocked(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      const saved =
        writeStored(STORE_KEY, { business: quote.business, gst: quote.gst }) ||
        // A large logo can fill the browser's quota; keep the words at least.
        writeStored(STORE_KEY, { business: { ...quote.business, logo: null }, gst: quote.gst });
      setRememberBlocked(!saved);
    }, 300);
    return () => clearTimeout(timer);
  }, [remember, quote.business, quote.gst]);

  const onLogo = async (file) => {
    setLogoError("");
    const result = await readLogo(file);
    if (!result.ok) {
      setLogoError(result.reason === "tooBig" ? copy.logoTooBig : copy.business.logoUnreadable);
      return;
    }
    setQuote((current) => ({ ...current, business: { ...current.business, logo: result.logo } }));
  };

  const fileBase = safeFilename(quote.details.number, "quote");

  const downloadPdf = async () => {
    if (pdfState === "working") return;
    setPdfState("working");
    try {
      const { buildQuotePdf } = await loadPdf();
      let logo = await logoForPdf(quote.business.logo);
      let result;
      try {
        result = await buildQuotePdf(quote, totals, copy, { logo });
      } catch (error) {
        if (!logo) throw error;
        // An unusual PNG or JPG that pdf-lib cannot embed: redraw it as a plain PNG.
        logo = await rasteriseLogo(quote.business.logo);
        result = await buildQuotePdf(quote, totals, copy, { logo });
      }
      saveBlob(new Blob([result.bytes], { type: "application/pdf" }), `${fileBase}.pdf`);
      trackUsage(app.slug, "complete");
      setPdfState("idle");
    } catch (error) {
      console.error("Quote PDF failed", error);
      setPdfState("failed");
    }
  };

  const saveFile = () => {
    saveBlob(new Blob([serialiseQuote(quote)], { type: "application/json" }), `${fileBase}.quote.json`);
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
    // A new quote keeps the business, its GST setting and the Made with choice.
    setQuote((current) => ({
      ...newQuote({ business: current.business, gst: current.gst, previousNumber: current.details.number }),
      madeWith: current.madeWith,
    }));
    setConfirmNew(false);
    setFileError("");
    setPdfState("idle");
    setView("edit");
    requestAnimationFrame(() => document.getElementById("qb-customer-company")?.focus());
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
        <div className="qb-col-form">
          <QuoteForm
            quote={quote}
            setQuote={setQuote}
            totals={totals}
            copy={copy}
            remember={remember}
            onRemember={setRemember}
            rememberBlocked={rememberBlocked}
            onLogo={onLogo}
            logoError={logoError}
          />
        </div>
        <div className="qb-col-preview">
          <div className="qb-sticky stack-5">
            <QuotePreview quote={quote} totals={totals} copy={copy} />
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
