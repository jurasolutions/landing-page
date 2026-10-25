-- The site-wide daily AI budget (AI_DAILY_BUDGET_USD, default US$5).
--
-- What the AI tools have spent on the Claude API each SGT day, in
-- nano-dollars (billionths of a US dollar), so every amount is a whole
-- number. A request reserves its worst-case cost here before it is sent and
-- is settled to its real cost, from the API's token counts, when it returns.

CREATE TABLE IF NOT EXISTS app_spend (
  day TEXT PRIMARY KEY,
  nano_usd INTEGER NOT NULL DEFAULT 0
);
