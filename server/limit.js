/**
 * The AI try limiter (app factory PRD §5.4).
 *
 * - Each visitor gets AI_TRIES_PER_DAY tries (default 2) per SGT day. With
 *   AI_LIMIT_SCOPE=all (default) that is across every AI tool; with
 *   AI_LIMIT_SCOPE=per-tool, each tool has its own count. A visitor is a
 *   salted hash of the IP and a random cookie (server/visitor.js).
 * - Each IP gets AI_TRIES_PER_IP tries (default 6) per SGT day on top of
 *   that, counted against a salted hash of the IP alone, so a fresh cookie
 *   (a private window, cleared cookies) does not mean fresh tries. Six lets a
 *   shared office in three people's worth. Its rows sit in app_tries with
 *   `tool` '#ip' (or '#ip:<slug>' per tool), so no extra table is needed.
 * - The whole site makes at most AI_SITE_CAP AI calls a day (default 200).
 *   Every request sent to the API counts, a repair request included, and a
 *   counted call is never given back, so the cap holds whatever the API or
 *   the model answers. Only the visitor's try is ever refunded.
 * - A try is refunded after a failure on our side, at most once per visitor
 *   per SGT day (and at most three times per IP by default), recorded in
 *   app_tries rows with `tool` '#refund' (or '#refund:<slug>' per tool).
 *   Slugs are [a-z0-9-] only, so a reserved '#' key never meets a tool.
 *
 * All three counters (visitor, IP and site) and the refund rows live in D1,
 * not KV: KV is eventually consistent, so quick repeated clicks could slip
 * past a limit of 2. Each counter is taken with a
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
    triesPerIp: positiveInt(env.AI_TRIES_PER_IP, 6),
    siteCap: positiveInt(env.AI_SITE_CAP, 200),
    scope: env.AI_LIMIT_SCOPE === "per-tool" ? "per-tool" : "all",
  };
}

/** The `tool` column value: '*' when the limit is shared across tools. */
export const limitKey = (config, tool) => (config.scope === "per-tool" ? tool : "*");

/**
 * The `tool` column value for the per-IP ceiling's rows, which share
 * app_tries with the visitor rows: '#ip', or '#ip:<slug>' per tool.
 */
export const ipKey = (key) => (key === "*" ? "#ip" : `#ip:${key}`);

function countOf(db, { day, hash, key }) {
  return db
    .prepare("SELECT count FROM app_tries WHERE day = ?1 AND visitor_hash = ?2 AND tool = ?3")
    .bind(day, hash, key)
    .first("count");
}

export async function remaining(db, { day, visitorHash, ipHash, key, config }) {
  const tries = await countOf(db, { day, hash: visitorHash, key });
  const ipTries = await countOf(db, { day, hash: ipHash, key: ipKey(key) });
  const calls = await db.prepare("SELECT count FROM app_calls WHERE day = ?1").bind(day).first("count");
  return {
    triesLeft: Math.max(0, Math.min(config.triesPerDay - (tries ?? 0), config.triesPerIp - (ipTries ?? 0))),
    capReached: (calls ?? 0) >= config.siteCap,
  };
}

/** Increments a visitor counter while it is under `limit`; null at the limit. */
function takeFrom(db, { day, hash, key, limit }) {
  return db
    .prepare(
      `INSERT INTO app_tries (day, visitor_hash, tool, count) VALUES (?1, ?2, ?3, 1)
       ON CONFLICT (day, visitor_hash, tool) DO UPDATE SET count = count + 1 WHERE count < ?4
       RETURNING count`
    )
    .bind(day, hash, key, limit)
    .first("count");
}

function giveBack(db, { day, hash, key }) {
  return db
    .prepare("UPDATE app_tries SET count = count - 1 WHERE day = ?1 AND visitor_hash = ?2 AND tool = ?3 AND count > 0")
    .bind(day, hash, key)
    .run();
}

/**
 * Gives back each row in `rows`, one at a time. A give-back that throws is
 * skipped rather than retried: the row keeps its count until midnight SGT,
 * which costs the visitor a try and never lets a call through uncounted.
 */
async function giveBackAll(db, rows) {
  for (const row of rows) {
    try {
      await giveBack(db, row);
    } catch {
      // Fails closed; see above.
    }
  }
}

/**
 * Takes one try for the visitor (IP and cookie), one from their IP's ceiling,
 * and one call from the site's daily cap. If a later one is refused, the
 * earlier ones are given back. If a statement throws part-way, whatever was
 * already taken is given back and the error is rethrown.
 * Returns { ok: true, triesLeft } or { ok: false, reason: "limit" | "cap" }.
 */
export async function takeTry(db, { day, visitorHash, ipHash, key, config }) {
  if (config.triesPerDay <= 0 || config.triesPerIp <= 0) return { ok: false, reason: "limit" };
  const visitor = { day, hash: visitorHash, key };
  const ip = { day, hash: ipHash, key: ipKey(key) };

  const taken = [];
  let count;
  let ipCount;
  let called = false;
  try {
    count = await takeFrom(db, { ...visitor, limit: config.triesPerDay });
    if (count == null) return { ok: false, reason: "limit" };
    taken.push(visitor);
    ipCount = await takeFrom(db, { ...ip, limit: config.triesPerIp });
    if (ipCount != null) {
      taken.push(ip);
      called = await takeCall(db, { day, config });
    }
  } catch (error) {
    await giveBackAll(db, taken);
    throw error;
  }

  if (ipCount == null) {
    // Another cookie on this IP has used the IP's tries for today.
    await giveBackAll(db, taken);
    return { ok: false, reason: "limit" };
  }
  if (!called) {
    // The site is at its cap. Give the visitor their try back.
    await giveBackAll(db, taken);
    return { ok: false, reason: "cap" };
  }

  return { ok: true, triesLeft: Math.max(0, Math.min(config.triesPerDay - count, config.triesPerIp - ipCount)) };
}

/**
 * Takes one call from the site's daily cap. Every request actually sent to
 * the API takes one first, the repair request included. Returns false at the
 * cap, in which case the request must not be sent.
 */
export async function takeCall(db, { day, config }) {
  if (config.siteCap <= 0) return false;
  const calls = await db
    .prepare(
      `INSERT INTO app_calls (day, count) VALUES (?1, 1)
       ON CONFLICT (day) DO UPDATE SET count = count + 1 WHERE count < ?2
       RETURNING count`
    )
    .bind(day, config.siteCap)
    .first("count");
  return calls != null;
}

/**
 * The `tool` column value for the refund rows: '#refund', or
 * '#refund:<slug>' per tool. Each visitor and each IP has one, counting the
 * refunds given today.
 */
export const refundKey = (key) => (key === "*" ? "#refund" : `#refund:${key}`);

/** Refunds an IP may have a day: one per visitor its ceiling lets in. */
const refundsPerIp = (config) => Math.max(1, Math.ceil(config.triesPerIp / Math.max(1, config.triesPerDay)));

/**
 * Gives the visitor their try back after a failure on our side, at most once
 * per visitor per SGT day, and at most once per visitor the IP's ceiling lets
 * in (three by default), so fresh cookies do not bring fresh refunds. A
 * second failure keeps the try used, so one visitor cannot spend the site's
 * cap on failures. Resolves to true when the try came back.
 *
 * The refund is recorded before the try is given back: if a statement throws
 * in between, the visitor loses a try rather than gaining one.
 *
 * The site's call count is left alone: the cap counts calls made, and a call
 * that was sent was paid for.
 */
export async function refundTry(db, { day, visitorHash, ipHash, key, config }) {
  const visitorRefund = { day, hash: visitorHash, key: refundKey(key) };
  if ((await takeFrom(db, { ...visitorRefund, limit: 1 })) == null) return false;
  if ((await takeFrom(db, { day, hash: ipHash, key: refundKey(key), limit: refundsPerIp(config) })) == null) {
    await giveBackAll(db, [visitorRefund]);
    return false;
  }
  await giveBack(db, { day, hash: visitorHash, key });
  await giveBack(db, { day, hash: ipHash, key: ipKey(key) });
  return true;
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
