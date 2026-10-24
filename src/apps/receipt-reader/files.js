/** Upload rules the page applies before anything is sent. */
export const MAX_FILES_CLIENT = 3;

export function fileMessage(reason, copy) {
  return (
    {
      heic: copy.heic,
      type: copy.badType,
      tooBig: copy.tooBig,
      unopenable: copy.unopenable,
    }[reason] ?? copy.unopenable
  );
}

/**
 * Why "Read receipts" cannot be pressed yet, or null when it can. The first
 * thing in the way wins, in the order the visitor would meet them.
 *   limit       what GET /api/apps/limit returned, or null while loading
 *   siteKey     the Turnstile site key ("" when the build has none)
 *   readyCount  files prepared and ready to send
 */
export function readBlocker({ limit, siteKey, readyCount, preparing, sending }) {
  if (!limit) return "loading";
  if (!limit.ready || !siteKey) return "unavailable";
  if (limit.capReached || limit.triesLeft <= 0) return "outOfTries";
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
