/**
 * GET /api/apps/limit?tool=<slug>
 *
 *   200 { triesLeft, triesPerDay, capReached, ready }
 *
 * `ready` is false when the AI tools are not configured on this deployment
 * (no D1 binding, API key, Turnstile secret or visitor salt), so the page can
 * say the tool is unavailable instead of failing on the first try. It also
 * makes this a health check: `curl https://jurasolutions.sg/api/apps/limit`.
 * The first call issues the visitor cookie.
 */
import { json } from "./http.js";
import { remaining } from "./limit.js";
import { aiReady, isAiTool, reply, visitorContext } from "./ai-tool.js";

export async function handleLimit({ request, env, registry, now }) {
  const tool = new URL(request.url).searchParams.get("tool");
  if (tool !== null && !isAiTool(tool, registry)) return json({ error: "unknown_tool" }, 400);

  if (!aiReady(env)) {
    return json({ triesLeft: 0, triesPerDay: 0, capReached: false, ready: false });
  }

  const ctx = await visitorContext(request, env, tool ?? "*", now);
  try {
    const left = await remaining(ctx.db, ctx);
    return reply(ctx, { ...left, triesPerDay: ctx.config.triesPerDay, ready: true });
  } catch (error) {
    console.error(JSON.stringify({ at: "limit", ok: false, error: String(error?.name ?? "error") }));
    return json({ triesLeft: 0, triesPerDay: 0, capReached: false, ready: false }, 503);
  }
}
