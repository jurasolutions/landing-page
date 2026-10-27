-- The suppression list becomes an append-only log: one row per event.
--
-- The growth engine's outreach sync reads this table by id, picking up every
-- row after the last one it processed, and acts on each event even when the
-- address was already suppressed (a complaint after an unsubscribe still
-- pauses outreach). That needs ids that only grow and rows that never change.
-- The contract is "D1 contract" in repos/growth/docs/scout.md.
--
--   id: never reused (AUTOINCREMENT), so the sync's cursor can't skip an event
--   reason: unsubscribe | bounce | complaint | manual
--   source: unsubscribe-link | unsubscribe-post | resend-webhook
--   email is NULL for unsubscribes, which only ever see the hash.
--
-- Every unsubscribe, bounce and complaint inserts a new row, even for an
-- address already in the table. Triggers refuse UPDATE, DELETE and an insert
-- that would replace an existing row.
--
-- Forward-only. Apply it once, straight after the Pages deploy of the code
-- that uses plain inserts. SQLite can't change a primary key in place, so the
-- table is rebuilt; existing rows are copied across, oldest first.

CREATE TABLE suppression_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_hash TEXT NOT NULL,
  email TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual')),
  source TEXT NOT NULL,
  resend_email_id TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO suppression_log (email_hash, email, reason, source, resend_email_id, created_at)
  SELECT email_hash, email, reason, source, resend_email_id, created_at
  FROM suppression
  ORDER BY created_at, email_hash;

DROP TABLE suppression;

ALTER TABLE suppression_log RENAME TO suppression;

CREATE INDEX suppression_email_hash ON suppression (email_hash);

CREATE TRIGGER suppression_no_update
BEFORE UPDATE ON suppression
BEGIN
  SELECT RAISE(ABORT, 'suppression is append-only: rows are never updated');
END;

CREATE TRIGGER suppression_no_delete
BEFORE DELETE ON suppression
BEGIN
  SELECT RAISE(ABORT, 'suppression is append-only: rows are never deleted');
END;

-- INSERT OR REPLACE removes the row it collides with without firing the
-- delete trigger, so an insert that names an id already in use is refused too.
CREATE TRIGGER suppression_no_replace
BEFORE INSERT ON suppression
WHEN NEW.id IS NOT NULL AND EXISTS (SELECT 1 FROM suppression WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'suppression is append-only: an id is never reused');
END;
