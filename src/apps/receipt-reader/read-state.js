/**
 * Whether the visitor can read receipts right now, and if not, why.
 *   limit  what GET /api/apps/limit returned, or null while it is loading
 */

/** True when today's tries are used up, the visitor's or the site's. */
export const isOutOfTries = (limit) => Boolean(limit && (limit.capReached || limit.triesLeft <= 0));

/**
 * True when the tool shows the talk-to-us card under the out-of-tries notice
 * (APP-002 §5.1 step 7). Not when the AI tools are not ready: the page then
 * shows the not-ready alert, and the shell's own closing card stays.
 */
export const showsTalkCard = (limit, siteKey) => Boolean(limit?.ready && siteKey && isOutOfTries(limit));

/**
 * Why "Read receipts" cannot be pressed yet, or null when it can. The first
 * thing in the way wins, in the order the visitor would meet them.
 *   siteKey     the Turnstile site key ("" when the build has none)
 *   readyCount  files prepared and ready to send
 */
export function readBlocker({ limit, siteKey, readyCount, preparing, sending }) {
  if (!limit) return "loading";
  if (!limit.ready || !siteKey) return "unavailable";
  if (isOutOfTries(limit)) return "outOfTries";
  if (sending) return "sending";
  if (preparing) return "preparing";
  if (readyCount <= 0) return "noFiles";
  return null;
}

/**
 * The hint shown under the disabled button. Empty where the page already
 * says why: the not-ready alert, the out-of-tries notice, or the button's
 * own "Reading" label.
 */
export function readBlockerText(reason, copy) {
  return copy.readWhy[reason] ?? "";
}

/**
 * What the page says after a read that did not return receipts (403, 413,
 * 415, 502, 503, or 0 when the network failed; 429 shows the out-of-tries
 * notice instead).
 *   body         the Function's answer: { error, triesLeft? }
 *   triesBefore  the tries left before this read
 *
 * "This try wasn't counted" is added only when it is true. The Function
 * answers 502 and 503 both for a try it gave back and for one it kept (a
 * refusal, or a second failure the same SGT day), so its `triesLeft` decides:
 * the try came back when the count did not drop. A 503 with no `triesLeft`
 * came before any try was taken. A failed network leaves it unknown, so the
 * page promises nothing.
 */
export function failureMessage({ status, body = {}, triesBefore }, copy) {
  if (status === 403) return copy.errors.botCheck;
  if (status === 413) return copy.tooBig;
  if (status === 415) return body.error === "heic" ? copy.heic : copy.badType;
  const words = status === 502 ? copy.errors.unreadable : copy.errors.unavailable;
  const known = typeof body.triesLeft === "number";
  const givenBack = known ? body.triesLeft >= triesBefore : status === 503;
  return givenBack ? `${words} ${copy.errors.notCounted}` : words;
}
