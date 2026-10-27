import React from "react";
import { Alert, Button, Icon, IconButton, Toast } from "../../ds.js";
import { FileDrop } from "../_shared/FileDrop.jsx";
import { ExportButtons } from "../_shared/ExportButtons.jsx";
import { LimitArea } from "../_shared/LimitArea.jsx";
import { useOwnTalkCard } from "../_shared/AppShell.jsx";
import { saveBlob } from "../_shared/download.js";
import { trackUsage } from "../_shared/usage.js";
import { useToast } from "../_shared/useToast.js";
import { MAX_FILES_CLIENT, fileMessage } from "./files.js";
import { failureMessage, isOutOfTries, readBlocker, readBlockerText, showsTalkCard } from "./read-state.js";
import { prepareFile } from "./prepare.js";
import { SITE_KEY, createTurnstile } from "../_shared/turnstile.js";
import { fetchLimit, sendReceipts } from "./api.js";
import { fromApi, releasable } from "./model.js";
import { receiptTable, toCsv, toTsv, toXlsx } from "./exports.js";
import { ReceiptResults } from "./ReceiptResults.jsx";
import "./receipt-reader.css";

let fileCounter = 0;

export default function ReceiptReader({ app, copy }) {
  const [limit, setLimit] = React.useState(null);
  const [files, setFiles] = React.useState([]);
  const [notice, setNotice] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [receipts, setReceipts] = React.useState([]);
  const [toast, setToast] = useToast();
  const widgetRef = React.useRef(null);
  const turnstile = React.useRef(null);
  const resultsRef = React.useRef(null);

  React.useEffect(() => {
    let live = true;
    fetchLimit().then((value) => live && setLimit(value));
    return () => {
      live = false;
    };
  }, []);

  React.useEffect(() => {
    if (!SITE_KEY || !widgetRef.current) return undefined;
    let cancelled = false;
    createTurnstile(widgetRef.current, () => cancelled)
      .then((widget) => {
        if (cancelled) widget.remove();
        else turnstile.current = widget;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      turnstile.current?.remove();
      turnstile.current = null;
    };
  }, []);

  // Object URLs for previews are released when files go, and when a
  // not-a-receipt card that shows one goes.
  const filesRef = React.useRef(files);
  filesRef.current = files;
  const receiptsRef = React.useRef(receipts);
  receiptsRef.current = receipts;
  React.useEffect(
    () => () => {
      filesRef.current.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
      receiptsRef.current.forEach((r) => r.previewUrl && URL.revokeObjectURL(r.previewUrl));
    },
    []
  );

  const addFiles = async (incoming) => {
    setNotice("");
    setError("");
    const room = MAX_FILES_CLIENT - files.length;
    if (incoming.length > room) setNotice(copy.tooMany);
    const taken = incoming.slice(0, Math.max(0, room));
    const entries = taken.map((file) => ({ id: `f-${(fileCounter += 1)}`, name: file.name, status: "preparing" }));
    setFiles((current) => [...current, ...entries]);
    await Promise.all(
      taken.map(async (file, i) => {
        const result = await prepareFile(file);
        setFiles((current) =>
          current.map((entry) =>
            entry.id === entries[i].id
              ? result.ok
                ? { ...entry, status: "ready", blob: result.blob, previewUrl: result.previewUrl, fromPdf: result.fromPdf }
                : { ...entry, status: "error", reason: result.reason }
              : entry
          )
        );
      })
    );
  };

  const removeFile = (id) =>
    setFiles((current) => {
      const gone = current.find((f) => f.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return current.filter((f) => f.id !== id);
    });

  const ready = files.filter((f) => f.status === "ready");
  const preparing = files.some((f) => f.status === "preparing");
  const outOfTries = isOutOfTries(limit);
  useOwnTalkCard(showsTalkCard(limit, SITE_KEY));
  const blocker = readBlocker({ limit, siteKey: SITE_KEY, readyCount: ready.length, preparing, sending });
  const canRead = blocker === null;
  const whyNot = readBlockerText(blocker, copy);

  const read = async () => {
    if (!canRead) return;
    const triesBefore = limit.triesLeft;
    setSending(true);
    setError("");
    let token;
    try {
      token = await turnstile.current.token();
    } catch {
      setSending(false);
      setError(copy.errors.botCheck);
      return;
    }
    const { status, body } = await sendReceipts(ready.map((f) => f.blob), token);
    setSending(false);

    if (status === 200 && Array.isArray(body.receipts)) {
      // A not-a-receipt card keeps the photo it came from; the rest go.
      const previews = ready.map((f) => f.previewUrl);
      const fresh = body.receipts.map((receipt) => fromApi(receipt, previews));
      setReceipts((current) => [...current, ...fresh]);
      setLimit((current) => ({ ...current, triesLeft: body.triesLeft ?? 0 }));
      releasable(
        files.map((f) => f.previewUrl),
        fresh
      ).forEach((url) => URL.revokeObjectURL(url));
      setFiles([]);
      trackUsage(app.slug, "complete");
      requestAnimationFrame(() => resultsRef.current?.focus());
      return;
    }
    if (status === 429) {
      setLimit((current) => ({ ...current, triesLeft: 0, capReached: body.error === "cap" }));
      return;
    }
    if (typeof body.triesLeft === "number") setLimit((current) => ({ ...current, triesLeft: body.triesLeft }));
    setError(failureMessage({ status, body, triesBefore }, copy));
  };

  const table = () => receiptTable(receipts, copy);
  const exports = [
    {
      key: "csv",
      icon: "file-down",
      label: copy.exports.csv,
      onClick: () => saveBlob(new Blob([toCsv(table())], { type: "text/csv;charset=utf-8" }), `${copy.exports.fileName}.csv`),
    },
    {
      key: "xlsx",
      icon: "file-spreadsheet",
      label: copy.exports.xlsx,
      onClick: async () => saveBlob(await toXlsx(receipts, copy), `${copy.exports.fileName}.xlsx`),
    },
    {
      key: "copy",
      icon: "copy",
      label: copy.exports.copy,
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(toTsv(table()));
          setToast(copy.exports.copied);
        } catch {
          setToast(copy.exports.copyFailed);
        }
      },
    },
  ];

  return (
    <div className="rr stack-6">
      <div className="rr-upload stack-4">
        <LimitArea limit={limit} slug={app.slug} copy={copy} />

        {!outOfTries && (
          <>
            <FileDrop
              id="rr-files"
              label={copy.uploadLabel}
              hint={copy.uploadHint}
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf"
              multiple
              camera
              disabled={files.length >= MAX_FILES_CLIENT || sending}
              onFiles={addFiles}
            />

            {notice && (
              <Alert tone="info" icon={<Icon name="info" size={18} />}>
                {notice}
              </Alert>
            )}

            {files.length > 0 && (
              <ul className="rr-files" aria-label={copy.uploadLabel}>
                {files.map((file, index) => (
                  <li key={file.id} className="rr-file">
                    {file.previewUrl ? (
                      <img src={file.previewUrl} alt="" className="rr-thumb" />
                    ) : (
                      <span className="rr-thumb rr-thumb--empty" aria-hidden="true">
                        <Icon name={file.status === "error" ? "alert-circle" : "image"} size={20} />
                      </span>
                    )}
                    <span className="rr-file-text">
                      <span className="rr-file-name">{copy.files.label(index + 1)}</span>
                      <span className={`rr-file-status${file.status === "error" ? " rr-file-status--error" : ""}`}>
                        {file.status === "preparing"
                          ? copy.preparing
                          : file.status === "error"
                            ? fileMessage(file.reason, copy)
                            : file.fromPdf
                              ? copy.files.pdf
                              : file.name}
                      </span>
                    </span>
                    <IconButton
                      type="button"
                      size="lg"
                      variant="ghost"
                      label={copy.files.remove(index + 1)}
                      disabled={sending}
                      onClick={() => removeFile(file.id)}
                      icon={<Icon name="x" size={20} />}
                    />
                  </li>
                ))}
              </ul>
            )}

            <div className="rr-send stack-3">
              <div>
                <Button
                  type="button"
                  size="lg"
                  disabled={!canRead}
                  aria-describedby={whyNot ? "rr-read-why rr-one-try" : "rr-one-try"}
                  onClick={read}
                  iconLeft={<Icon name={sending ? "loader" : "scan-text"} size={20} />}
                >
                  {sending ? copy.reading : copy.read}
                </Button>
              </div>
              {whyNot && (
                <p className="rr-hint" id="rr-read-why">
                  {whyNot}
                </p>
              )}
              <p className="rr-hint" id="rr-one-try">
                {copy.oneTry}
              </p>
              <div ref={widgetRef} className="rr-turnstile" />
            </div>
          </>
        )}

        <div aria-live="polite">
          {error && (
            <Alert tone="danger" icon={<Icon name="alert-circle" size={18} />}>
              {error}
            </Alert>
          )}
        </div>
      </div>

      {receipts.length > 0 && (
        <section className="rr-results stack-5" aria-labelledby="rr-results-heading">
          <div className="stack-3">
            <h2 id="rr-results-heading" ref={resultsRef} tabIndex={-1} className="rr-results-heading">
              {copy.results.heading}
            </h2>
            <p className="rr-hint">{copy.results.hint}</p>
          </div>
          <ExportButtons label={copy.exports.group} actions={exports} />
          <ReceiptResults receipts={receipts} setReceipts={setReceipts} copy={copy} />
        </section>
      )}

      <div className="rr-toast" aria-live="polite">
        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
