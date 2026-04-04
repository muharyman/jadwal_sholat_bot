ALTER TABLE users ADD COLUMN schedule_key TEXT;

CREATE TABLE IF NOT EXISTS daily_schedules (
  schedule_key TEXT NOT NULL,
  city TEXT,
  country TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  tz TEXT NOT NULL,
  method INTEGER NOT NULL,
  day_local TEXT NOT NULL,
  fajr_time TEXT NOT NULL,
  fajr_due_minute_utc TEXT NOT NULL,
  dhuhr_time TEXT NOT NULL,
  dhuhr_due_minute_utc TEXT NOT NULL,
  asr_time TEXT NOT NULL,
  asr_due_minute_utc TEXT NOT NULL,
  maghrib_time TEXT NOT NULL,
  maghrib_due_minute_utc TEXT NOT NULL,
  isha_time TEXT NOT NULL,
  isha_due_minute_utc TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (schedule_key, day_local)
);

CREATE INDEX IF NOT EXISTS idx_users_schedule_key ON users(schedule_key);
CREATE INDEX IF NOT EXISTS idx_daily_schedules_city ON daily_schedules(city, country);
