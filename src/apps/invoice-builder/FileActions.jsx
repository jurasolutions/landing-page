/**
 * "Save invoice file", "Open invoice file" and "Open quote file" (ticket 04).
 *
 * Both Open buttons click the same hidden file picker, because both accept
 * both kinds of file (decision D8). An opened file replaces the invoice
 * straight away (D9). A bad file shows the PRD's message and changes nothing.
 * A quote whose prices included GST shows a warning that stays until the next
 * file or "New invoice" (D6).
 */
import React from "react";
import { Alert, Icon } from "../../ds.js";
import { safeFilename, saveBlob } from "../_shared/download.js";
import { openPickedFile, serialiseInvoice } from "./invoiceFile.js";

/** The message a file leaves in the live region: "bad", "inclusive" or null. */
export function FileNotice({ notice, copy }) {
  if (notice === "bad") {
    return (
      <Alert tone="danger" icon={<Icon name="alert-circle" size={18} />}>
        {copy.badFile}
      </Alert>
    );
  }
  if (notice === "inclusive") {
    return (
      <Alert tone="warning" icon={<Icon name="alert-circle" size={18} />}>
        {copy.quoteIncludedGst}
      </Alert>
    );
  }
  return null;
}

/**
 * The file buttons for `ExportButtons`, the hidden picker, and the file
 * message. `onOpen(result)` receives a good file's result from openAnyFile.
 */
export function useInvoiceFiles({ invoice, copy, onOpen, setToast }) {
  const [notice, setNotice] = React.useState(null);
  const pickerRef = React.useRef(null);

  const save = () => {
    const name = `${safeFilename(invoice.details.number, "invoice")}.invoice.json`;
    saveBlob(new Blob([serialiseInvoice(invoice)], { type: "application/json" }), name);
  };

  const open = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice(null);
    const result = await openPickedFile(file, invoice);
    if (!result.ok) {
      setNotice("bad");
      return;
    }
    onOpen(result);
    if (result.pricesIncludedGst) setNotice("inclusive");
    setToast(result.kind === "quote" ? copy.quoteOpened : copy.opened);
  };

  const pick = () => pickerRef.current?.click();

  return {
    actions: [
      { key: "save", icon: "save", label: copy.buttons.saveFile, onClick: save },
      { key: "open", icon: "folder-open", label: copy.buttons.openFile, onClick: pick },
      { key: "open-quote", icon: "folder-open", label: copy.buttons.openQuote, onClick: pick },
    ],
    picker: (
      <input
        ref={pickerRef}
        type="file"
        accept=".json,application/json"
        className="tb-visually-hidden"
        tabIndex={-1}
        aria-label={copy.buttons.openFile}
        onChange={open}
      />
    ),
    notice: <FileNotice notice={notice} copy={copy} />,
    clear: () => setNotice(null),
  };
}
