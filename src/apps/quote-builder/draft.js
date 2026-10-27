/**
 * Draft with AI (APP-001a): the call to the Function, and how its draft
 * lands in the quote.
 */
import { emptyItem } from "./model.js";

export const TOOL = "quote-builder";

/** Returns { status, body }; status 0 when the network failed. */
export async function sendDraftRequest(prompt, token) {
  try {
    const response = await fetch(`/api/apps/${TOOL}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, prompt }),
      credentials: "same-origin",
    });
    const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : {};
    return { status: response.status, body };
  } catch {
    return { status: 0, body: {} };
  }
}

/** 350 -> "350", 99.5 -> "99.50": how the money fields show an amount. */
const money = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

/**
 * The quote with the draft applied. The items are replaced. A customer field
 * the draft names is filled; the rest are left as the visitor had them. The
 * draft's one-line scope goes at the top of the notes, replacing the scope an
 * earlier draft put there.
 */
export function applyDraft(quote, draft, copy) {
  const items = draft.items.map((item) => ({
    ...emptyItem(),
    description: item.description,
    quantity: item.quantity === null ? "1" : String(item.quantity),
    unit: item.unit ?? "",
    unitPrice: item.unit_price === null ? "" : money(item.unit_price),
  }));

  const customer = { ...quote.customer };
  for (const key of ["company", "contact", "address", "email"]) {
    if (draft.customer?.[key]) customer[key] = draft.customer[key];
  }

  const prefix = copy.ai.scope("");
  const rest = quote.notes.startsWith(prefix) ? quote.notes.split(/\n\n/).slice(1).join("\n\n") : quote.notes;
  const notes = draft.summary ? [copy.ai.scope(draft.summary), rest].filter(Boolean).join("\n\n") : rest;

  return { ...quote, customer, items, notes };
}

/**
 * What the page says after a draft that did not come back (403, 413, 400,
 * 502, 503, or 0 when the network failed; 429 shows the out-of-tries notice
 * instead). "This try wasn't counted" is added only when it is true: the try
 * came back when the count did not drop, and a 503 with no count came before
 * any try was taken.
 */
export function draftFailure({ status, body = {}, triesBefore }, copy) {
  const E = copy.ai.errors;
  if (status === 403) return E.botCheck;
  if (status === 413 || status === 400) return E.tooLong;
  if (status === 0) return E.offline;
  // Output the model could not get right reads as "couldn't draft from that",
  // as it did before it became a 503 with reason bad_output.
  const words =
    status === 502 || body.reason === "bad_output" ? E.unreadable : body.error === "busy" ? E.busy : E.unavailable;
  const known = typeof body.triesLeft === "number";
  // The server says whether the try was counted; the counts are only a fallback
  // (two counts can come from different buckets on a first visit).
  const givenBack =
    typeof body.counted === "boolean" ? !body.counted : known ? body.triesLeft >= triesBefore : status === 503;
  return givenBack ? `${words} ${E.notCounted}` : words;
}
