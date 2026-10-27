/** True when today's tries are used up, the visitor's or the site's. */
export const isOutOfTries = (limit) => Boolean(limit && (limit.capReached || limit.triesLeft <= 0));

/**
 * True when the tool shows the talk-to-us card under the out-of-tries notice
 * (APP-002 §5.1 step 7). Not when the AI tools are not ready: the page then
 * shows the not-ready alert, and the shell's own closing card stays.
 */
export const showsTalkCard = (limit, siteKey) => Boolean(limit?.ready && siteKey && isOutOfTries(limit));

/**
 * GET /api/apps/limit for an AI tool: the visitor's tries left today.
 * Resolves to { ready, triesLeft, capReached }, or { ready: false } when the
 * Functions are not there (the plain Vite dev server) or the call failed.
 */
export async function fetchLimit(tool) {
  try {
    const response = await fetch(`/api/apps/limit?tool=${tool}`, { credentials: "same-origin" });
    if (!response.headers.get("content-type")?.includes("application/json")) return { ready: false };
    const body = await response.json();
    return {
      ready: body.ready === true,
      triesLeft: Number(body.triesLeft) || 0,
      capReached: body.capReached === true,
    };
  } catch {
    return { ready: false };
  }
}
