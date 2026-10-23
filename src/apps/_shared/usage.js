/**
 * Anonymous usage counter. Fire and forget: a failure here must never touch
 * the tool, so every error is swallowed.
 *
 * The body goes as text/plain because sendBeacon with a JSON content type is
 * refused by some browsers. The Function parses the JSON either way.
 */
export const USAGE_ENDPOINT = "/api/apps/usage";

export function trackUsage(slug, event) {
  try {
    const body = JSON.stringify({ slug, event });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const queued = navigator.sendBeacon(USAGE_ENDPOINT, new Blob([body], { type: "text/plain" }));
      if (queued) return;
    }
    fetch(USAGE_ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "Content-Type": "text/plain" },
    }).catch(() => {});
  } catch {
    // Counting is a nice-to-have. Never let it surface.
  }
}
