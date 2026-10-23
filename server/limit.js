/**
 * The AI try limiter (app factory PRD §5.4).
 *
 * - Each visitor gets AI_TRIES_PER_DAY tries (default 2) per SGT day. With
 *   AI_LIMIT_SCOPE=all (default) that is across every AI tool; with
 *   AI_LIMIT_SCOPE=per-tool, each tool has its own count.
 * - The whole site makes at most AI_SITE_CAP AI calls a day (default 200).
 *
 * Both counters live in D1, not KV: KV is eventually consistent, so quick
 * repeated clicks could slip past a limit of 2. Each counter is taken with a
 * single upsert that only increments while under the limit and returns the
 * new count (`... DO UPDATE SET count = count + 1 WHERE count < ? RETURNING
 * count`). D1 runs writes one at a time, so two clicks a millisecond apart
 * cannot both pass, and the stored count never goes past the limit.
 */

const positiveInt = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function limitConfig(env) {
  return {
    triesPerDay: positiveInt(env.AI_TRIES_PER_DAY, 2),
    siteCap: positiveInt(env.AI_SITE_CAP, 200),
    scope: env.AI_LIMIT_SCOPE === "per-tool" ? "per-tool" : "all",
  };
}

/** The `tool` column value: '*' when the limit is shared across tools. */
export const limitKey = (config, tool) => (config.scope === "per-tool" ? tool : "*");

export async function remaining(db, { day, visitorHash, key, config }) {
  const tries = await db
    .prepare("SELECT count FROM app_tries WHERE day = ?1 AND visitor_hash = ?2 AND tool = ?3")
    .bind(day, visitorHash, key)
    .first("count");
  const calls = await db.prepare("SELECT count FROM app_calls WHERE day = ?1").bind(day).first("count");
  return {
    triesLeft: Math.max(0, config.triesPerDay - (tries ?? 0)),
    capReached: (calls ?? 0) >= config.siteCap,
  };
}

/**
 * Takes one try for the visitor and one call from the site's daily cap.
 * Returns { ok: true, triesLeft } or { ok: false, reason: "limit" | "cap" }.
 */
export async function takeTry(db, { day, visitorHash, key, config }) {
  if (config.triesPerDay <= 0) return { ok: false, reason: "limit" };

  const count = await db
    .prepare(
      `INSERT INTO app_tries (day, visitor_hash, tool, count) VALUES (?1, ?2, ?3, 1)
       ON CONFLICT (day, visitor_hash, tool) DO UPDATE SET count = count + 1 WHERE count < ?4
       RETURNING count`
    )
    .bind(day, visitorHash, key, config.triesPerDay)
    .first("count");
  if (count == null) return { ok: false, reason: "limit" };

  const calls =
    config.siteCap <= 0
      ? null
      : await db
          .prepare(
            `INSERT INTO app_calls (day, count) VALUES (?1, 1)
             ON CONFLICT (day) DO UPDATE SET count = count + 1 WHERE count < ?2
             RETURNING count`
          )
          .bind(day, config.siteCap)
          .first("count");
  if (calls == null) {
    // The site is at its cap. Give the visitor their try back.
    await refundVisitor(db, { day, visitorHash, key });
    return { ok: false, reason: "cap" };
  }

  return { ok: true, triesLeft: Math.max(0, config.triesPerDay - count) };
}

async function refundVisitor(db, { day, visitorHash, key }) {
  await db
    .prepare(
      "UPDATE app_tries SET count = count - 1 WHERE day = ?1 AND visitor_hash = ?2 AND tool = ?3 AND count > 0"
    )
    .bind(day, visitorHash, key)
    .run();
}

/** Gives back a try and a site call after a failure on our side. */
export async function refundTry(db, { day, visitorHash, key }) {
  await refundVisitor(db, { day, visitorHash, key });
  await db.prepare("UPDATE app_calls SET count = count - 1 WHERE day = ?1 AND count > 0").bind(day).run();
}

/**
 * Closes the AI tools for the rest of the day by filling the site cap. Used
 * when the API reports a billing problem (the spend limit is reached), so the
 * site stops calling an API that will refuse it until the limit resets.
 */
export async function closeForToday(db, { day, config }) {
  await db
    .prepare(
      `INSERT INTO app_calls (day, count) VALUES (?1, ?2)
       ON CONFLICT (day) DO UPDATE SET count = MAX(count, excluded.count)`
    )
    .bind(day, config.siteCap)
    .run();
}
