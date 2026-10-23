/**
 * Shared helpers for the Pages Functions.
 *
 * This folder is outside `functions/` on purpose. Pages turns any file in
 * `functions/` that exports an `onRequest*` handler into a public route, and
 * an underscore prefix means nothing to it except for `_middleware`. Shared
 * code lives here so it can never become a route by accident.
 */

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function empty(status = 204, headers = {}) {
  return new Response(null, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** The Singapore (UTC+8) calendar date, YYYY-MM-DD. SGT has no daylight saving. */
export function sgtDay(now = Date.now()) {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Reads a request body as text, refusing anything over `max` bytes. */
export async function readText(request, max) {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > max) return { tooLarge: true };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > max) return { tooLarge: true };
  return { text };
}
