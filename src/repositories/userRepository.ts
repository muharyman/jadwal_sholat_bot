import type { Env, UserRow } from "../types";

export interface UserRepository {
  getUser(chatId: number): Promise<UserRow | null>;
  upsertUser(u: Partial<UserRow> & { chat_id: number }): Promise<void>;
  setMuted(chatId: number, muted: number): Promise<void>;
  markSent(chatId: number, dayLocal: string, prayer: string): Promise<void>;
  wasSent(chatId: number, dayLocal: string, prayer: string): Promise<boolean>;
  listDueUsers(minuteUTC: string): Promise<UserRow[]>;
  listStaleUsers(minuteUTC: string): Promise<UserRow[]>;
  updateNextSchedule(chatId: number, nextPrayer: string | null, dueMinuteUTC: string | null): Promise<void>;
}

export class D1UserRepository implements UserRepository {
  constructor(private env: Env) {}

  async getUser(chatId: number): Promise<UserRow | null> {
    const row = await this.env.DB.prepare("SELECT * FROM users WHERE chat_id=?")
      .bind(chatId)
      .first<UserRow>();
    return row || null;
  }

  async upsertUser(u: Partial<UserRow> & { chat_id: number }): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO users (chat_id, city, country, lat, lon, tz, method, muted, next_prayer, next_due_minute_utc, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        city=excluded.city,
        country=excluded.country,
        lat=excluded.lat,
        lon=excluded.lon,
        tz=excluded.tz,
        method=excluded.method,
        muted=excluded.muted,
        next_prayer=excluded.next_prayer,
        next_due_minute_utc=excluded.next_due_minute_utc,
        updated_at=excluded.updated_at
    `).bind(
      u.chat_id,
      u.city ?? null,
      u.country ?? null,
      u.lat ?? null,
      u.lon ?? null,
      u.tz ?? null,
      u.method ?? 3,
      u.muted ?? 0,
      u.next_prayer ?? null,
      u.next_due_minute_utc ?? null,
      new Date().toISOString()
    ).run();
  }

  async setMuted(chatId: number, muted: number): Promise<void> {
    await this.env.DB.prepare("UPDATE users SET muted=?, updated_at=? WHERE chat_id=?")
      .bind(muted, new Date().toISOString(), chatId)
      .run();
  }

  async markSent(chatId: number, dayLocal: string, prayer: string): Promise<void> {
    await this.env.DB.prepare(
      "INSERT OR IGNORE INTO sent_log (chat_id, day_local, prayer) VALUES (?,?,?)"
    )
      .bind(chatId, dayLocal, prayer)
      .run();
  }

  async wasSent(chatId: number, dayLocal: string, prayer: string): Promise<boolean> {
    const row = await this.env.DB.prepare(
      "SELECT 1 FROM sent_log WHERE chat_id=? AND day_local=? AND prayer=?"
    )
      .bind(chatId, dayLocal, prayer)
      .first();
    return !!row;
  }

  async listDueUsers(minuteUTC: string): Promise<UserRow[]> {
    const due = await this.env.DB.prepare(
      "SELECT * FROM users WHERE muted=0 AND next_due_minute_utc=?"
    )
      .bind(minuteUTC)
      .all<UserRow>();
    return due.results ?? [];
  }

  async listStaleUsers(minuteUTC: string): Promise<UserRow[]> {
    const stale = await this.env.DB.prepare(
      "SELECT * FROM users WHERE muted=0 AND (next_due_minute_utc IS NULL OR next_due_minute_utc < ?)"
    )
      .bind(minuteUTC)
      .all<UserRow>();
    return stale.results ?? [];
  }

  async updateNextSchedule(
    chatId: number,
    nextPrayer: string | null,
    dueMinuteUTC: string | null
  ): Promise<void> {
    await this.env.DB.prepare(
      "UPDATE users SET next_prayer=?, next_due_minute_utc=?, updated_at=? WHERE chat_id=?"
    )
      .bind(nextPrayer, dueMinuteUTC, new Date().toISOString(), chatId)
      .run();
  }
}
