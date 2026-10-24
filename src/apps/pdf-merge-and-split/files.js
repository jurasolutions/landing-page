/**
 * What the tool will take, checked from each file's size alone, before a
 * single byte is read (PRD §3: up to 20 PDFs, up to 50 MB in total).
 *
 * A batch that would pass either limit is refused whole, so the list never
 * ends up holding an arbitrary part of what the visitor dropped.
 */
export const MAX_FILES = 20;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

/**
 * `current` is what is already in the list ({ size } each), `incoming` the
 * new File objects. Returns { ok: true } or { ok: false, reason: "tooMany" |
 * "tooLarge" }.
 */
export function admitFiles(current, incoming) {
  if (current.length + incoming.length > MAX_FILES) return { ok: false, reason: "tooMany" };
  const total = [...current, ...incoming].reduce((sum, file) => sum + (file.size ?? 0), 0);
  if (total > MAX_TOTAL_BYTES) return { ok: false, reason: "tooLarge" };
  return { ok: true };
}

/** The visitor's message for a file readPdf could not use. */
export function problemMessage(reason, copy) {
  return { encrypted: copy.errors.encrypted, notPdf: copy.errors.notPdf }[reason] ?? copy.errors.damaged;
}
