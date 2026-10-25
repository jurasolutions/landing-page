/**
 * Anonymous usage counts: how often each tool is opened and completed per
 * SGT day. No visitor identity, no content, no IP.
 */
import { empty, json, readText, sgtDay } from "./http.js";
import { findEntry } from "./registry.js";
import { isServed } from "./drafts.js";

const EVENTS = { open: "opens", complete: "completions" };

export async function recordUsage(db, { day, slug, event }) {
  const opens = event === "open" ? 1 : 0;
  const completions = event === "complete" ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO app_usage (day, app_slug, opens, completions) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (day, app_slug) DO UPDATE SET
         opens = opens + excluded.opens,
         completions = completions + excluded.completions`
    )
    .bind(day, slug, opens, completions)
    .run();
}

/**
 * POST /api/apps/usage with `{ slug, event: "open" | "complete" }`.
 * The body may arrive as text/plain (navigator.sendBeacon), so the content
 * type is not checked.
 */
export async function handleUsage({ request, env, registry, now }) {
  const body = await readText(request, 1024);
  if (body.tooLarge) return json({ error: "too_large" }, 413);

  let payload;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const slug = payload?.slug;
  const event = payload?.event;
  // Only tools the site serves are counted, so the numbers the scout picks
  // tools by cannot be padded with a draft slug.
  if (!isServed(findEntry(slug, registry), env) || !Object.hasOwn(EVENTS, event ?? "")) {
    return json({ error: "bad_event" }, 400);
  }

  if (!env.DB) return json({ error: "not_configured" }, 503);

  try {
    await recordUsage(env.DB, { day: sgtDay(now), slug, event });
  } catch (error) {
    console.error(JSON.stringify({ at: "usage", ok: false, message: String(error?.message ?? error) }));
    return json({ error: "store_failed" }, 503);
  }
  return empty(204);
}
