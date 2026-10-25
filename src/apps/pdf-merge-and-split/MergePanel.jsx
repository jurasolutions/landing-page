import React from "react";
import { Alert, Button, Field, Icon, IconButton, Input } from "../../ds.js";
import { FileDrop } from "../_shared/FileDrop.jsx";
import { saveBlob } from "../_shared/download.js";
import { trackUsage } from "../_shared/usage.js";
import { TAP_INPUT } from "../_shared/controls.js";
import { focusAction, useFocusReturn } from "../_shared/focus.js";
import { admitFiles, problemMessage } from "./files.js";
import { moveDown, moveItem, moveUp } from "./order.js";
import { pdfFileName } from "./names.js";
import { Outcome, focusFirstButton, nextPaint } from "./Outcome.jsx";

let counter = 0;
const nextId = () => `pm-file-${(counter += 1)}`;

/**
 * Shown above "Merge and download" while any file has a problem, so a
 * visitor is never handed a merged file that is quietly short of one.
 */
export function LeftOutNote({ files, copy }) {
  if (!files.some((file) => file.status === "problem")) return null;
  return (
    <Alert tone="warning" icon={<Icon name="alert-circle" size={18} />}>
      {copy.merge.leftOut}
    </Alert>
  );
}

/**
 * Merge: up to 20 PDFs, reordered by drag or by each file's Move up and Move
 * down buttons (the keyboard and touch equivalent of dragging), merged into
 * one download.
 *
 * Each file is { id, name, size, status: "checking" | "ready" | "problem",
 * reason, bytes, pageCount }. A file that can't be used keeps its place and
 * its message, holds no bytes, and is left out of the merge; the others are
 * untouched.
 */
export function MergePanel({ app, copy, loadPdf }) {
  const [files, setFiles] = React.useState([]);
  const [notice, setNotice] = React.useState("");
  const [name, setName] = React.useState("");
  const [state, setState] = React.useState("idle"); // idle | working | done | failed
  const [announcement, setAnnouncement] = React.useState("");
  const [dragging, setDragging] = React.useState(null);
  const [dropAt, setDropAt] = React.useState(null);
  const panelRef = React.useRef(null);
  const listRef = React.useRef(null);
  const focusNext = React.useRef(null);

  const working = state === "working";
  const holdFocus = useFocusReturn(working);
  const ready = files.filter((file) => file.status === "ready");
  const checking = files.some((file) => file.status === "checking");

  // After a move or removal, put focus back where the visitor was working.
  React.useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    const row = listRef.current?.querySelector(`[data-file="${target.id}"]`);
    if (!focusAction(row, target.action)) focusFirstButton(panelRef.current);
  }, [files]);

  const changed = () => {
    if (state !== "working") setState("idle");
  };

  const addFiles = async (incoming) => {
    if (working) return;
    const verdict = admitFiles(files, incoming);
    if (!verdict.ok) {
      setNotice(copy.errors[verdict.reason]);
      return;
    }
    setNotice("");
    changed();
    const entries = incoming.map((file) => ({ id: nextId(), name: file.name, size: file.size, status: "checking" }));
    setFiles((current) => [...current, ...entries]);

    const { readPdf } = await loadPdf();
    await Promise.all(
      incoming.map(async (file, i) => {
        let update;
        try {
          const bytes = await file.arrayBuffer();
          const result = await readPdf(bytes);
          update = result.ok
            ? { status: "ready", bytes, pageCount: result.pageCount }
            : { status: "problem", reason: result.reason };
        } catch {
          update = { status: "problem", reason: "damaged" };
        }
        setFiles((current) => current.map((entry) => (entry.id === entries[i].id ? { ...entry, ...update } : entry)));
      })
    );
  };

  const reorder = (next, id, action, position) => {
    changed();
    setFiles(next);
    focusNext.current = id && action ? { id, action } : null;
    const moved = next.find((file) => file.id === id);
    if (moved) setAnnouncement(copy.merge.moved(moved.name, position + 1, next.length));
  };

  const remove = (index) => {
    changed();
    const next = files.filter((_, i) => i !== index);
    const neighbour = next[index] ?? next[index - 1];
    focusNext.current = neighbour ? { id: neighbour.id, action: "remove" } : { id: null };
    setFiles(next);
    setNotice("");
  };

  const merge = async () => {
    if (working || ready.length === 0 || checking) return;
    holdFocus();
    setState("working");
    await nextPaint();
    try {
      const { mergePdfs } = await loadPdf();
      const bytes = await mergePdfs(ready.map((file) => ({ bytes: file.bytes })));
      saveBlob(new Blob([bytes], { type: "application/pdf" }), pdfFileName(name, copy.files.merged));
      trackUsage(app.slug, "complete");
      setState("done");
    } catch (error) {
      if (Number.isInteger(error?.index) && ready[error.index]) {
        const bad = ready[error.index].id;
        setFiles((current) =>
          current.map((file) => (file.id === bad ? { ...file, status: "problem", reason: error.reason, bytes: null } : file))
        );
        setState("idle");
      } else {
        console.error("PDF merge failed", error);
        setState("failed");
      }
    }
  };

  const startAgain = () => {
    setFiles([]);
    setName("");
    setNotice("");
    setAnnouncement("");
    setState("idle");
    focusFirstButton(panelRef.current);
  };

  // Native drag and drop between rows. Files dropped from the computer onto
  // the list are added, as on the drop area.
  const onListDragOver = (event) => {
    event.preventDefault();
    if (dragging === null) event.dataTransfer.dropEffect = "copy";
  };
  const onListDrop = (event) => {
    event.preventDefault();
    if (dragging === null && event.dataTransfer.files?.length) addFiles(Array.from(event.dataTransfer.files));
  };
  const endDrag = () => {
    setDragging(null);
    setDropAt(null);
  };

  const status = (file) => {
    if (file.status === "checking") return copy.checking;
    if (file.status === "problem") return problemMessage(file.reason, copy);
    return copy.pageCount(file.pageCount);
  };

  return (
    <div ref={panelRef} className="pm-panel stack-5">
      <FileDrop
        id="pm-merge-files"
        label={copy.merge.dropLabel}
        hint={copy.merge.helper}
        accept="application/pdf,.pdf"
        multiple
        dropNote={false}
        chooseLabel={copy.buttons.choose}
        disabled={working}
        onFiles={addFiles}
      />

      <div className="pm-live" aria-live="polite">
        {notice && (
          <Alert tone="warning" icon={<Icon name="alert-circle" size={18} />}>
            {notice}
          </Alert>
        )}
      </div>

      {files.length === 0 ? (
        <p className="pm-empty">{copy.empty}</p>
      ) : (
        <ol
          ref={listRef}
          className="pm-files"
          aria-label={copy.merge.listLabel}
          onDragOver={onListDragOver}
          onDrop={onListDrop}
        >
          {files.map((file, index) => {
            const nameId = `${file.id}-name`;
            const classes = [
              "pm-file",
              dragging === index ? "pm-file--dragging" : "",
              dropAt === index && dragging !== null && dragging !== index ? "pm-file--target" : "",
            ].join(" ");
            return (
              <li
                key={file.id}
                data-file={file.id}
                className={classes}
                draggable={!working && files.length > 1}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", file.name);
                  setDragging(index);
                }}
                onDragOver={(event) => {
                  if (dragging === null) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropAt(index);
                }}
                onDrop={(event) => {
                  if (dragging === null) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const dragged = files[dragging];
                  if (dragged && dragging !== index) reorder(moveItem(files, dragging, index), dragged.id, null, index);
                  endDrag();
                }}
                onDragEnd={endDrag}
              >
                <span className="pm-grip" aria-hidden="true">
                  <Icon name="grip-vertical" size={20} />
                </span>
                <span className="pm-file-text">
                  <span className="pm-file-name" id={nameId}>
                    {file.name}
                  </span>
                  {/* Present from "Checking the file…" on, so the result is announced. */}
                  <span
                    className={`pm-file-status${file.status === "problem" ? " pm-file-status--problem" : ""}`}
                    aria-live="polite"
                  >
                    {status(file)}
                  </span>
                </span>
                <span className="pm-file-tools">
                  <IconButton
                    type="button"
                    size="lg"
                    variant="ghost"
                    label={copy.buttons.moveUp}
                    aria-describedby={nameId}
                    data-action="up"
                    disabled={working || index === 0}
                    onClick={() => reorder(moveUp(files, index), file.id, "up", index - 1)}
                    icon={<Icon name="arrow-up" size={20} />}
                  />
                  <IconButton
                    type="button"
                    size="lg"
                    variant="ghost"
                    label={copy.buttons.moveDown}
                    aria-describedby={nameId}
                    data-action="down"
                    disabled={working || index === files.length - 1}
                    onClick={() => reorder(moveDown(files, index), file.id, "down", index + 1)}
                    icon={<Icon name="arrow-down" size={20} />}
                  />
                  <IconButton
                    type="button"
                    size="lg"
                    variant="ghost"
                    label={copy.buttons.remove}
                    aria-describedby={nameId}
                    data-action="remove"
                    disabled={working}
                    onClick={() => remove(index)}
                    icon={<Icon name="x" size={20} />}
                  />
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="tb-visually-hidden pm-live" aria-live="polite">
        {announcement}
      </p>

      {files.length > 0 && (
        <div className="pm-finish stack-4">
          <Field label={copy.merge.nameLabel} htmlFor="pm-merge-name">
            <Input
              id="pm-merge-name"
              name="fileName"
              style={TAP_INPUT}
              value={name}
              autoComplete="off"
              maxLength={120}
              placeholder={copy.files.merged}
              disabled={working}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <LeftOutNote files={files} copy={copy} />
          <div>
            <Button
              type="button"
              size="lg"
              disabled={working || checking || ready.length === 0}
              onClick={merge}
              iconLeft={<Icon name={working ? "loader" : "file-down"} size={20} />}
            >
              {working ? copy.working : copy.buttons.merge}
            </Button>
          </div>
        </div>
      )}

      <Outcome state={state} copy={copy} onStartAgain={startAgain} />
    </div>
  );
}
