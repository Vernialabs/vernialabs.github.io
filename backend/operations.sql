-- Additive migration. Existing leads are not emailed retroactively.
CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waitlist_id INTEGER NOT NULL UNIQUE REFERENCES waitlist(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','uncertain')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt INTEGER NOT NULL DEFAULT (unixepoch()),
  lease_until INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  error_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS email_outbox_due ON email_outbox(status,next_attempt);
CREATE TRIGGER IF NOT EXISTS waitlist_confirmation AFTER INSERT ON waitlist
BEGIN INSERT INTO email_outbox(waitlist_id) VALUES (NEW.id); END;
CREATE TABLE IF NOT EXISTS admin_challenges (
 id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL,
 expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_rate (
 key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS analytics_events (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL, event TEXT NOT NULL,
 path TEXT NOT NULL, referrer TEXT NOT NULL, source TEXT NOT NULL, campaign TEXT NOT NULL,
 country TEXT NOT NULL, device TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS analytics_time ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS analytics_sessions ON analytics_events(session_id,created_at);
CREATE TABLE IF NOT EXISTS service_health (
 service TEXT PRIMARY KEY, state TEXT NOT NULL, detail TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
