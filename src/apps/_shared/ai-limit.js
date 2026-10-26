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
