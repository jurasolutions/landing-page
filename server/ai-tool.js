/**
 * What every AI tool's Function shares: configuration checks, the visitor's
 * identity, and the response for each refusal. A tool's own Function adds
 * its input checks and its model call between `takeTry` and the response.
 */
import { json, sgtDay } from "./http.js";
import { hashIp, identifyVisitor } from "./visitor.js";
import { limitConfig, limitKey } from "./limit.js";
import { findEntry } from "./registry.js";
import { isServed } from "./drafts.js";

/**
 * What a tool needs on top of what every AI tool needs, keyed by slug. Kept
 * on the server: the registry ships in the browser bundle.
 */
const TOOL_NEEDS = {
  // The pictures: a Workers AI binding.
  "food-post-maker": (env) => typeof env.AI?.run === "function",
};

/**
 * Everything an AI tool needs from the environment before it does anything.
 * With a `tool`, that tool's own needs too; without one (the health check),
 * only what they all share.
 */
export function aiReady(env, tool = null) {
  const shared = Boolean(env.DB && env.ANTHROPIC_API_KEY && env.TURNSTILE_SECRET && env.VISITOR_SALT);
  return shared && (TOOL_NEEDS[tool]?.(env) ?? true);
}

export function isAiTool(slug, registry) {
  return findEntry(slug, registry)?.tier === "ai";
}

/** An AI tool this deployment serves: live, or a draft where AI_ALLOW_DRAFTS=1. */
export function isServedAiTool(slug, env, registry) {
  return isAiTool(slug, registry) && isServed(findEntry(slug, registry), env);
}

export async function visitorContext(request, env, tool, now) {
  const config = limitConfig(env);
  const visitor = await identifyVisitor(request, env.VISITOR_SALT);
  return {
    db: env.DB,
    day: sgtDay(now),
    visitorHash: visitor.hash,
    ipHash: await hashIp(request, env.VISITOR_SALT),
    setCookie: visitor.setCookie,
    key: limitKey(config, tool),
    config,
  };
}

/** A JSON response that also issues the visitor cookie when it is new. */
export function reply(ctx, body, status = 200) {
  return json(body, status, ctx?.setCookie ? { "Set-Cookie": ctx.setCookie } : {});
}

/** One log line per call: day, tool, outcome, counts, tokens, latency. Never content. */
export function logCall(fields) {
  console.log(JSON.stringify({ at: "ai-tool", ...fields }));
}
