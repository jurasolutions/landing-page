/**
 * Reads the "Pages to keep" box: page numbers and runs of pages, separated by
 * commas, for example "1-3, 5, 8-10". Spaces are ignored, and the en and em
 * dashes a phone or word processor swaps in count as dashes.
 *
 * The kept pages come back once each, in the file's own order: "Pages to
 * keep" picks pages, it does not rearrange them.
 *
 * Returns { ok: true, pages } with zero-based page indices, or
 * { ok: false, error } where error is one of:
 *   "empty"     nothing typed
 *   "format"    something other than numbers, commas and dashes
 *   "zero"      page 0, which no file has
 *   "reversed"  a run written high to low, such as 5-3
 *   "outside"   a page past the last page of the file
 * The first problem from the left is the one reported.
 */
const SINGLE = /^(\d+)$/;
const RUN = /^(\d+)\s*-\s*(\d+)$/;

export function parseRanges(text, pageCount) {
  const parts = String(text ?? "")
    .replace(/[‒-―−]/g, "-")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "empty" };

  const kept = new Set();
  for (const part of parts) {
    const match = part.match(RUN) ?? part.match(SINGLE);
    if (!match) return { ok: false, error: "format" };
    const from = Number(match[1]);
    const to = Number(match[2] ?? match[1]);
    if (from === 0 || to === 0) return { ok: false, error: "zero" };
    if (from > to) return { ok: false, error: "reversed" };
    if (to > pageCount) return { ok: false, error: "outside" };
    for (let page = from; page <= to; page += 1) kept.add(page - 1);
  }
  return { ok: true, pages: [...kept].sort((a, b) => a - b) };
}

/** The visitor's message for a parseRanges error. Page 0 is not in any file. */
export function rangeMessage(error, pageCount, copy) {
  if (error === "reversed") return copy.errors.rangeReversed;
  if (error === "format") return copy.errors.rangeFormat;
  if (error === "empty") return copy.errors.rangeEmpty;
  return copy.errors.badRange(pageCount);
}
