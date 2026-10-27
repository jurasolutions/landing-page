import React from "react";
import { Icon, IconButton } from "../../ds.js";
import { fileMessage, photoNumbers } from "./files.js";

/**
 * The files added for the next read. A file that will be sent is labelled
 * "Photo n", the number its not-a-receipt card would use; a file that can't
 * be sent is labelled by its name, with why.
 */
export function FileList({ files, copy, sending, onRemove }) {
  const numbers = photoNumbers(files);
  return (
    <ul className="rr-files" aria-label={copy.uploadLabel}>
      {files.map((file, index) => {
        const n = numbers[index];
        return (
          <li key={file.id} className="rr-file">
            {file.previewUrl ? (
              <img src={file.previewUrl} alt="" className="rr-thumb" />
            ) : (
              <span className="rr-thumb rr-thumb--empty" aria-hidden="true">
                <Icon name={file.status === "error" ? "alert-circle" : "image"} size={20} />
              </span>
            )}
            <span className="rr-file-text">
              <span className="rr-file-name">{n === null ? file.name : copy.files.label(n)}</span>
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
              label={n === null ? copy.files.removeNamed(file.name) : copy.files.remove(n)}
              disabled={sending}
              onClick={() => onRemove(file.id)}
              icon={<Icon name="x" size={20} />}
            />
          </li>
        );
      })}
    </ul>
  );
}
