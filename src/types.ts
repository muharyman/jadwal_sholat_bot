export interface Env {
  DB: D1Database;

  TELEGRAM_API_BASE: string;
  NOMINATIM_USER_AGENT: string;
  FRONTEND_ORIGIN?: string;

  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
}

export type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
  };
  inline_query?: {
    id: string;
    query: string;
  };
};

export type UserRow = {
  chat_id: number;
  city: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  tz: string | null;
  method: number | null;
  muted: number | null;
  schedule_key: string | null;
  next_prayer: string | null;
  next_due_minute_utc: string | null;
};

export type DailyScheduleRow = {
  schedule_key: string;
  city: string | null;
  country: string | null;
  lat: number;
  lon: number;
  tz: string;
  method: number;
  day_local: string;
  fajr_time: string;
  fajr_due_minute_utc: string;
  dhuhr_time: string;
  dhuhr_due_minute_utc: string;
  asr_time: string;
  asr_due_minute_utc: string;
  maghrib_time: string;
  maghrib_due_minute_utc: string;
  isha_time: string;
  isha_due_minute_utc: string;
  synced_at: string;
};
