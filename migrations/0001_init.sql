CREATE TABLE IF NOT EXISTS users (
  chat_id INTEGER PRIMARY KEY,
  city TEXT,
  country TEXT,
  lat REAL,
  lon REAL,
  tz TEXT,
  method INTEGER DEFAULT 3,
  muted INTEGER DEFAULT 0,

  next_prayer TEXT,
  next_due_minute_utc TEXT, -- "YYYY-MM-DDTHH:MM" UTC
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sent_log (
  chat_id INTEGER,
  day_local TEXT,  -- "YYYY-MM-DD" in user's timezone
  prayer TEXT,
  PRIMARY KEY (chat_id, day_local, prayer)
);

CREATE INDEX IF NOT EXISTS idx_users_due ON users(next_due_minute_utc);
