CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL DEFAULT '',
  organisation TEXT NOT NULL DEFAULT '',
  interests TEXT NOT NULL CHECK (json_valid(interests)),
  source TEXT NOT NULL DEFAULT 'direct',
  campaign TEXT NOT NULL DEFAULT '',
  consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','contacted','invited','withdrawn'))
);
CREATE INDEX IF NOT EXISTS waitlist_created ON waitlist(created_at);
CREATE INDEX IF NOT EXISTS waitlist_status ON waitlist(status, id);
