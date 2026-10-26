/**
 * The AI try limiter (app factory PRD §5.4, with Ting Yu's 2026-10-25
 * change: 5 tries a person, and a US$5 daily budget for the whole site).
 *
 * - Each visitor gets AI_TRIES_PER_DAY tries (default 5) per SGT day. With
 *   AI_LIMIT_SCOPE=all (default) that is across every AI tool, so a read in
 *   one tool and a draft in another both count; with AI_LIMIT_SCOPE=per-tool,
 *   each tool has its own count. A visitor is a salted hash of the IP and a
 *   random cookie (server/visitor.js).
 * - Each IP gets AI_TRIES_PER_IP tries (default 15) per SGT day on top of
 *   that, counted against a salted hash of the IP alone, so a fresh cookie
 *   (a private window, cleared cookies) does not mean fresh tries. Fifteen
 *   lets a shared office in three people's worth. Its rows sit in app_tries
 *   with `tool` '#ip' (or '#ip:<slug>' per tool), so no extra table is needed.
 * - The whole site spends at most AI_DAILY_BUDGET_USD (default US$5) on the
 *   Claude API per SGT day. Before any request is sent, its worst-case cost is
 *   reserved from the day's budget (server/anthropic.js reservationNano); if
 *   that would go past the budget, the request is not sent and every AI tool
 *   shows its "used up for today" message until midnight SGT. When the
 *   request returns, the reservation is settled to its real cost, from the
 *   API's token counts. An error answer from the API is not billed, so its
 *   reservation is released; a dropped connection keeps it.
 * - AI_SITE_CAP, if set, also caps the number of AI calls a day. It is off by
 *   default: the budget is the site-wide limit. Every request sent counts, a
 *   repair request included, and a counted call is never given back.
 * - A try is refunded after a failure on our side, at most once per visitor
 *   per SGT day (and at most three times per IP by default), recorded in
 *   app_tries rows with `tool` '#refund' (or '#refund:<slug>' per tool).
 *   Slugs are [a-z0-9-] only, so a reserved '#' key never meets a tool. Money
 *   that was spent is never refunded to the budget.
 *
 * Every counter (visitor, IP, calls, spend) and the refund rows live in D1,
 * not KV: KV is eventually consistent, so quick repeated clicks could slip
 * past a limit. Each is taken with a single upsert that only increments while
 * under its limit and returns the new value (`... DO UPDATE SET count =
 * count + 1 WHERE count < ? RETURNING count`). D1 runs writes one at a time,
 * so two clicks a millisecond apart cannot both pass, and the stored value
 * never goes past the limit.
 */

const positiveInt = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** US dollars to nano-dollars; anything that is not a number of dollars gives the fallback. */
const budgetNano = (value, fallbackUsd) => {
  const usd = Number.parseFloat(String(value ?? ""));
  return Math.round((Number.isFinite(usd) && usd >= 0 ? usd : fallbackUsd) * 1e9);
};

export function limitConfig(env) {
  return {
    triesPerDay: positiveInt(env.AI_TRIES_PER_DAY, 5),
    triesPerIp: positiveInt(env.AI_TRIES_PER_IP, 15),
    budgetNano: budgetNano(env.AI_DAILY_BUDGET_USD, 5),
    // null: no cap on the number of calls, only the budget.
    siteCap: positiveInt(env.AI_SITE_CAP, null),
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
  const spent = await db.prepare("SELECT nano_usd FROM app_spend WHERE day = ?1").bind(day).first("nano_usd");
  return {
    triesLeft: Math.max(0, Math.min(config.triesPerDay - (tries ?? 0), config.triesPerIp - (ipTries ?? 0))),
    capReached: (spent ?? 0) >= config.budgetNano || (config.siteCap !== null && (calls ?? 0) >= config.siteCap),
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
 * and the first call: `reserve` nano-dollars from the daily budget (and one
 * call from AI_SITE_CAP when it is set). If a later one is refused, the
 * earlier ones are given back. If a statement throws part-way, whatever was
 * already taken is given back and the error is rethrown.
 * Returns { ok: true, triesLeft } or { ok: false, reason: "limit" | "cap" }.
 */
export async function takeTry(db, { day, visitorHash, ipHash, key, config, reserve }) {
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
      called = await takeCall(db, { day, config }, reserve);
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
    // The site has spent its budget (or reached its call cap). Give the
    // visitor their try back for tomorrow.
    await giveBackAll(db, taken);
    return { ok: false, reason: "cap" };
  }

  return { ok: true, triesLeft: Math.max(0, Math.min(config.triesPerDay - count, config.triesPerIp - ipCount)) };
}

/**
 * Reserves `nano` nano-dollars from the day's budget for one request, and
 * takes one call from AI_SITE_CAP when it is set. Every request actually sent
 * to the API comes through here first, the repair request included. Returns
 * false when the request must not be sent: the reservation would take the
 * day past its budget, or the call cap is reached.
 */
export async function takeCall(db, { day, config }, nano = 0) {
  if (!(await reserveSpend(db, { day, config }, nano))) return false;
  let counted;
  try {
    counted = await countCall(db, { day, config });
  } catch (error) {
    await releaseQuietly(db, { day }, nano);
    throw error;
  }
  if (!counted) {
    // Not sent, so not spent.
    await releaseQuietly(db, { day }, nano);
    return false;
  }
  return true;
}

/** Counts a call; while AI_SITE_CAP is set, only under the cap. */
async function countCall(db, { day, config }) {
  if (config.siteCap !== null && config.siteCap <= 0) return false;
  const calls = await db
    .prepare(
      `INSERT INTO app_calls (day, count) VALUES (?1, 1)
       ON CONFLICT (day) DO UPDATE SET count = count + 1 WHERE count < ?2
       RETURNING count`
    )
    .bind(day, config.siteCap ?? Number.MAX_SAFE_INTEGER)
    .first("count");
  return calls != null;
}

/** Adds `nano` to the day's spend if it stays within the budget. */
async function reserveSpend(db, { day, config }, nano) {
  if (!Number.isInteger(nano) || nano < 0 || nano > config.budgetNano) return false;
  const spent = await db
    .prepare(
      `INSERT INTO app_spend (day, nano_usd) VALUES (?1, ?2)
       ON CONFLICT (day) DO UPDATE SET nano_usd = nano_usd + ?2 WHERE nano_usd + ?2 <= ?3
       RETURNING nano_usd`
    )
    .bind(day, nano, config.budgetNano)
    .first("nano_usd");
  return spent != null;
}

/**
 * Settles a reservation: adds `delta` nano-dollars to the day's spend, which
 * is negative when a request cost less than was reserved. The real cost can
 * go slightly past the budget only when a request's prompt was larger than
 * its reservation allowed for; the next reservation then fails.
 */
export async function settleSpend(db, { day }, delta) {
  if (!Number.isInteger(delta) || delta === 0) return;
  await db
    .prepare("UPDATE app_spend SET nano_usd = MAX(0, nano_usd + ?2) WHERE day = ?1")
    .bind(day, delta)
    .run();
}

/**
 * Settles without throwing. If the statement fails, the reservation stays
 * counted in full, so the budget errs on the side of stopping early.
 */
export async function settleQuietly(db, ctx, delta) {
  try {
    await settleSpend(db, ctx, delta);
  } catch {
    // Fails closed; see above.
  }
}

const releaseQuietly = (db, ctx, nano) => settleQuietly(db, ctx, -nano);

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
 * Closes the AI tools for the rest of the day by marking the budget spent.
 * Used when the API reports a billing problem (the Console's spend limit is
 * reached), so the site stops calling an API that will refuse it until the
 * next SGT day.
 */
export async function closeForToday(db, { day, config }) {
  await db
    .prepare(
      `INSERT INTO app_spend (day, nano_usd) VALUES (?1, ?2)
       ON CONFLICT (day) DO UPDATE SET nano_usd = MAX(nano_usd, excluded.nano_usd)`
    )
    .bind(day, config.budgetNano)
    .run();
}

/**
 * One tool closed for the rest of the day, while the others stay open: the
 * product photo studio, when Workers AI says the account's daily allocation
 * is used up. That allocation resets at 00:00 UTC (08:00 SGT), so this one
 * marker is keyed by the UTC date, not the SGT day every other row uses. It
 * is an app_tries row with `visitor_hash` '#site' and `tool`
 * '#closed:<slug>': reserved keys, so no migration was needed and it never
 * meets a visitor's row.
 */
export const closedKey = (tool) => `#closed:${tool}`;
const CLOSED_BY = "#site";
const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

export async function closeToolForToday(db, { tool, now }) {
  await db
    .prepare("INSERT INTO app_tries (day, visitor_hash, tool, count) VALUES (?1, ?2, ?3, 1) ON CONFLICT DO NOTHING")
    .bind(utcDay(now), CLOSED_BY, closedKey(tool))
    .run();
}

export async function toolClosed(db, { tool, now }) {
  const row = await db
    .prepare("SELECT count FROM app_tries WHERE day = ?1 AND visitor_hash = ?2 AND tool = ?3")
    .bind(utcDay(now), CLOSED_BY, closedKey(tool))
    .first("count");
  return row != null;
}
