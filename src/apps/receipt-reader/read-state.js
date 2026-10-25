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
