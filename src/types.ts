export interface Env {
  DB: D1Database;

  TELEGRAM_API_BASE: string;
  NOMINATIM_USER_AGENT: string;

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
  next_prayer: string | null;
  next_due_minute_utc: string | null;
};
