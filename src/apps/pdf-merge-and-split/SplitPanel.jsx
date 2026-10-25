import React from "react";
import { Alert, Button, Field, Icon, IconButton, Input } from "../../ds.js";
import { FileDrop } from "../_shared/FileDrop.jsx";
import { saveBlob } from "../_shared/download.js";
import { trackUsage } from "../_shared/usage.js";
import { useFocusReturn } from "../_shared/focus.js";
import { MAX_TOTAL_BYTES, problemMessage } from "./files.js";
import { parseRanges, rangeMessage } from "./ranges.js";
import { baseName } from "./names.js";
import { Outcome, focusFirstButton, nextPaint } from "./Outcome.jsx";
import { Thumbnails } from "./Thumbnails.jsx";

// The design system's Input is 42px; tool pages lift every control to 44px.
const TAP = { minHeight: "var(--tap-min)" };

/**
 * Split: one PDF, its page count and thumbnails, then either the pages typed
 * into "Pages to keep" as one new PDF, or every page as its own PDF in a ZIP.
 */
export function SplitPanel({ app, copy, loadPdf }) {
  const [file, setFile] = React.useState(null); // { name, bytes, pageCount, pages }
  const [checking, setChecking] = React.useState(false);
  const [problem, setProblem] = React.useState("");
  const [range, setRange] = React.useState("");
  const [rangeError, setRangeError] = React.useState("");
  const [state, setState] = React.useState("idle"); // idle | working | done | failed
  const [busy, setBusy] = React.useState(null); // "selected" | "all"
  const panelRef = React.useRef(null);

  const working = state === "working";
  // The buttons and "Pages to keep" are disabled while working; focus goes
  // back to whichever started the work.
  const holdFocus = useFocusReturn(working);

  const addFile = async ([picked]) => {
    if (!picked || working) return;
    setState("idle");
    if (picked.size > MAX_TOTAL_BYTES) {
      setProblem(copy.errors.tooLargeOne);
      return;
    }
    setProblem("");
    setChecking(true);
    try {
      const bytes = await picked.arrayBuffer();
      const { readPdf } = await loadPdf();
      const result = await readPdf(bytes);
      if (result.ok) setFile({ name: picked.name, bytes, pageCount: result.pageCount, pages: result.pages });
      else setProblem(problemMessage(result.reason, copy));
    } catch {
      setProblem(copy.errors.damaged);
    } finally {
      setChecking(false);
    }
  };

  const clear = () => {
    setFile(null);
    setRange("");
    setRangeError("");
    setProblem("");
    setState("idle");
    focusFirstButton(panelRef.current);
  };

  // pdf.js asked for a password that pdf-lib didn't: refuse the file all the same.
  const onPassword = React.useCallback(() => {
    setFile(null);
    setProblem(copy.errors.encrypted);
  }, [copy]);

  const run = async (kind, make) => {
    if (working || !file) return;
    holdFocus();
    setBusy(kind);
    setState("working");
    await nextPaint();
    try {
      const pdf = await loadPdf();
      const { blob, name } = await make(pdf);
      saveBlob(blob, name);
      trackUsage(app.slug, "complete");
      setState("done");
    } catch (error) {
      if (error?.reason) {
        setFile(null);
        setProblem(problemMessage(error.reason, copy));
        setState("idle");
      } else {
        console.error("PDF split failed", error);
        setState("failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const downloadSelected = () => {
    const parsed = parseRanges(range, file.pageCount);
    if (!parsed.ok) {
      setRangeError(rangeMessage(parsed.error, file.pageCount, copy));
      // The design system's Input takes no ref, so find it by id.
      document.getElementById("pm-split-range")?.focus();
      return;
    }
    setRangeError("");
    run("selected", async ({ extractPages }) => ({
      blob: new Blob([await extractPages(file.bytes, parsed.pages)], { type: "application/pdf" }),
      name: `${baseName(file.name)}-${copy.files.selected}.pdf`,
    }));
  };

  const splitAll = () =>
    run("all", async ({ splitPages }) => {
      const base = baseName(file.name);
      return {
        blob: new Blob([await splitPages(file.bytes, base)], { type: "application/zip" }),
        name: `${base}-${copy.files.pages}.zip`,
      };
    });

  return (
    <div ref={panelRef} className="pm-panel stack-5">
      {!file && (
        <FileDrop
          id="pm-split-file"
          label={copy.split.dropLabel}
          accept="application/pdf,.pdf"
          dropNote={false}
          disabled={checking}
          onFiles={addFile}
        />
      )}

      <div className="pm-live" aria-live="polite">
        {problem && (
          <Alert tone="danger" icon={<Icon name="alert-circle" size={18} />}>
            {problem}
          </Alert>
        )}
        {checking && <p className="pm-empty">{copy.checking}</p>}
      </div>

      {!file && !checking && <p className="pm-empty">{copy.empty}</p>}

      {file && (
        <>
          <div className="pm-file pm-file--single">
            <span className="pm-grip" aria-hidden="true">
              <Icon name="file-text" size={20} />
            </span>
            <span className="pm-file-text">
              <span className="pm-file-name" id="pm-split-name">
                {file.name}
              </span>
              <span className="pm-file-status">{copy.pageCount(file.pageCount)}</span>
            </span>
            <span className="pm-file-tools">
              <IconButton
                type="button"
                size="lg"
                variant="ghost"
                label={copy.buttons.remove}
                aria-describedby="pm-split-name"
                disabled={working}
                onClick={clear}
                icon={<Icon name="x" size={20} />}
              />
            </span>
          </div>

          <Thumbnails buffer={file.bytes} pages={file.pages} copy={copy} onPassword={onPassword} />

          <div className="pm-finish stack-4">
            <Field label={copy.split.rangeLabel} hint={copy.split.rangeHelper} error={rangeError} htmlFor="pm-split-range">
              <Input
                id="pm-split-range"
                name="pagesToKeep"
                style={TAP}
                value={range}
                invalid={Boolean(rangeError)}
                autoComplete="off"
                spellCheck={false}
                placeholder={copy.split.rangePlaceholder}
                aria-describedby="pm-split-range-note"
                disabled={working}
                onChange={(event) => {
                  setRange(event.target.value);
                  if (rangeError) setRangeError("");
                  if (state === "done" || state === "failed") setState("idle");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") downloadSelected();
                }}
              />
            </Field>
            {/* The Field shows the helper or the error on screen; this copy is
                what the input is described by (Field gives its text no id).
                aria-hidden keeps it from being read twice when browsing. */}
            <span id="pm-split-range-note" className="tb-visually-hidden" aria-hidden="true">
              {rangeError || copy.split.rangeHelper}
            </span>
            <div className="tb-actions">
              <Button
                type="button"
                size="lg"
                disabled={working}
                onClick={downloadSelected}
                iconLeft={<Icon name={busy === "selected" ? "loader" : "file-down"} size={20} />}
              >
                {busy === "selected" ? copy.working : copy.buttons.downloadSelected}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={working}
                onClick={splitAll}
                iconLeft={<Icon name={busy === "all" ? "loader" : "scissors"} size={20} />}
              >
                {busy === "all" ? copy.working : copy.buttons.splitAll}
              </Button>
            </div>
          </div>
        </>
      )}

      <Outcome state={state} copy={copy} onStartAgain={clear} />
    </div>
  );
}
