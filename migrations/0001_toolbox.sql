-- Jura toolbox, D1 schema. Binding name: DB.
--
-- Every `day` is the Singapore (UTC+8) calendar date, YYYY-MM-DD.
-- Nothing here holds what a visitor uploads or types. Visitors appear only as
-- a salted hash, and usage counts carry no personal data at all.
--
-- Apply with wrangler's D1 migrations (see README.md), or paste into the D1
-- console in the Cloudflare dashboard.

-- AI tool tries per visitor per day. `tool` is '*' when the limit is shared
-- across every AI tool (AI_LIMIT_SCOPE=all, the default) and the tool's slug
-- when it is per tool (AI_LIMIT_SCOPE=per-tool).
CREATE TABLE IF NOT EXISTS app_tries (
  day TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  tool TEXT NOT NULL DEFAULT '*',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, visitor_hash, tool)
);

-- Site-wide AI calls per day, for the daily cap (AI_SITE_CAP).
CREATE TABLE IF NOT EXISTS app_calls (
  day TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

-- Anonymous opens and completions per tool per day.
CREATE TABLE IF NOT EXISTS app_usage (
  day TEXT NOT NULL,
  app_slug TEXT NOT NULL,
  opens INTEGER NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, app_slug)
);

-- Addresses that must never be emailed again.
--   reason: unsubscribe | bounce | complaint | manual
--   source: unsubscribe-link | unsubscribe-post | resend-webhook
--   email is NULL for link unsubscribes, which only ever see the hash.
CREATE TABLE IF NOT EXISTS suppression (
  email_hash TEXT PRIMARY KEY,
  email TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual')),
  source TEXT NOT NULL,
  resend_email_id TEXT,
  created_at TEXT NOT NULL
);
