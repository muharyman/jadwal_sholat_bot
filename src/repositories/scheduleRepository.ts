import type { DailyScheduleRow, Env } from "../types";

export interface ScheduleRepository {
  upsertDailySchedule(row: DailyScheduleRow): Promise<void>;
  listSchedulesByKey(scheduleKey: string, dayLocals: string[]): Promise<DailyScheduleRow[]>;
  deleteSchedulesBefore(dayLocalExclusive: string): Promise<void>;
}

export class D1ScheduleRepository implements ScheduleRepository {
  constructor(private env: Env) {}

  async upsertDailySchedule(row: DailyScheduleRow): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO daily_schedules (
        schedule_key, city, country, lat, lon, tz, method, day_local,
        fajr_time, fajr_due_minute_utc,
        dhuhr_time, dhuhr_due_minute_utc,
        asr_time, asr_due_minute_utc,
        maghrib_time, maghrib_due_minute_utc,
        isha_time, isha_due_minute_utc,
        synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(schedule_key, day_local) DO UPDATE SET
        city=excluded.city,
        country=excluded.country,
        lat=excluded.lat,
        lon=excluded.lon,
        tz=excluded.tz,
        method=excluded.method,
        fajr_time=excluded.fajr_time,
        fajr_due_minute_utc=excluded.fajr_due_minute_utc,
        dhuhr_time=excluded.dhuhr_time,
        dhuhr_due_minute_utc=excluded.dhuhr_due_minute_utc,
        asr_time=excluded.asr_time,
        asr_due_minute_utc=excluded.asr_due_minute_utc,
        maghrib_time=excluded.maghrib_time,
        maghrib_due_minute_utc=excluded.maghrib_due_minute_utc,
        isha_time=excluded.isha_time,
        isha_due_minute_utc=excluded.isha_due_minute_utc,
        synced_at=excluded.synced_at
    `).bind(
      row.schedule_key,
      row.city,
      row.country,
      row.lat,
      row.lon,
      row.tz,
      row.method,
      row.day_local,
      row.fajr_time,
      row.fajr_due_minute_utc,
      row.dhuhr_time,
      row.dhuhr_due_minute_utc,
      row.asr_time,
      row.asr_due_minute_utc,
      row.maghrib_time,
      row.maghrib_due_minute_utc,
      row.isha_time,
      row.isha_due_minute_utc,
      row.synced_at
    ).run();
  }

  async listSchedulesByKey(scheduleKey: string, dayLocals: string[]): Promise<DailyScheduleRow[]> {
    if (!dayLocals.length) return [];

    const placeholders = dayLocals.map(() => "?").join(", ");
    const rows = await this.env.DB.prepare(
      `SELECT * FROM daily_schedules WHERE schedule_key=? AND day_local IN (${placeholders}) ORDER BY day_local ASC`
    )
      .bind(scheduleKey, ...dayLocals)
      .all<DailyScheduleRow>();

    return rows.results ?? [];
  }

  async deleteSchedulesBefore(dayLocalExclusive: string): Promise<void> {
    await this.env.DB.prepare("DELETE FROM daily_schedules WHERE day_local < ?")
      .bind(dayLocalExclusive)
      .run();
  }
}
