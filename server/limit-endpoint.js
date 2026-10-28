/**
 * GET /api/apps/limit?tool=<slug>
 *
 *   200 { triesLeft, triesPerDay, capReached, ready, unlimited? }
 *   400 { error: "unknown_tool" }   not an AI tool in the registry
 *   404 { error: "not_found" }      a draft AI tool, unless AI_ALLOW_DRAFTS=1
 *
 * `ready` is false when the AI tools are not configured on this deployment
 * (no D1 binding, API key, Turnstile secret or visitor salt, or a binding only
 * that tool needs, such as the product photo studio's Workers AI), so the page can
 * say the tool is unavailable instead of failing on the first try. It also
 * makes this a health check: `curl https://jurasolutions.sg/api/apps/limit`.
 * The first call issues the visitor cookie.
 */
import { json } from "./http.js";
import { remaining, toolClosed } from "./limit.js";
import { aiReady, isAiTool, isServedAiTool, reply, visitorContext } from "./ai-tool.js";

export async function handleLimit({ request, env, registry, now }) {
  const tool = new URL(request.url).searchParams.get("tool");
  if (tool !== null && !isAiTool(tool, registry)) return json({ error: "unknown_tool" }, 400);
  if (tool !== null && !isServedAiTool(tool, env, registry)) return json({ error: "not_found" }, 404);

  if (!aiReady(env, tool)) {
    return json({ triesLeft: 0, triesPerDay: 0, capReached: false, ready: false });
  }

  const ctx = await visitorContext(request, env, tool ?? "*", now);
  try {
    const left = await remaining(ctx.db, ctx);
    // A tool closed on its own (server/limit.js closeToolForToday) reports
    // its cap reached; the others, and the health check, are unaffected.
    if (tool !== null && (await toolClosed(ctx.db, { tool, now }))) left.capReached = true;
    // `unlimited` appears only for an access code holder, so the page can say so.
    return reply(ctx, { ...left, triesPerDay: ctx.config.triesPerDay, ready: true, ...(ctx.promo ? { unlimited: true } : {}) });
  } catch (error) {
    console.error(JSON.stringify({ at: "limit", ok: false, error: String(error?.name ?? "error") }));
    return json({ triesLeft: 0, triesPerDay: 0, capReached: false, ready: false }, 503);
  }
}
