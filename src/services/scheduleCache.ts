import type { PrayerName, PrayerTimings } from "../domain/prayer";
import type { DailyScheduleRow, UserRow } from "../types";
import type { ScheduleRepository } from "../repositories/scheduleRepository";
import type { PrayerTimesService } from "./prayerTimes";
import {
  addDaysToLocalDate,
  localDateParts,
  localTimeToIsoMinuteUTC,
  nowIsoMinuteUTC
} from "../utils/time";

type SchedulableUser = Pick<
  UserRow,
  "chat_id" | "city" | "country" | "lat" | "lon" | "tz" | "method" | "schedule_key"
>;

type Deps = {
  prayerTimes: PrayerTimesService;
  schedules: ScheduleRepository;
};

type NextSchedule = {
  nextPrayer: PrayerName;
  dueMinuteUTC: string;
};

export class PrayerScheduleCacheService {
  constructor(private deps: Deps) {}

  buildScheduleKey(lat: number, lon: number, tz: string, method: number): string {
    return [lat.toFixed(6), lon.toFixed(6), tz, method].join(":");
  }

  async syncUsers(users: SchedulableUser[], now = new Date()): Promise<void> {
    const uniqueUsers = new Map<string, RequiredSchedulableUser>();

    for (const user of users) {
      if (!this.isSchedulable(user)) continue;

      const method = user.method ?? 3;
      const scheduleKey = this.buildScheduleKey(user.lat, user.lon, user.tz, method);

      if (!uniqueUsers.has(scheduleKey)) {
        uniqueUsers.set(scheduleKey, {
          ...user,
          method,
          schedule_key: scheduleKey
        });
      }
    }

    for (const user of uniqueUsers.values()) {
      await this.syncSingleSchedule(user, now);
    }
  }

  async syncUserSchedule(user: SchedulableUser, now = new Date()): Promise<{
    scheduleKey: string;
    nextPrayer: PrayerName | null;
    dueMinuteUTC: string | null;
  } | null> {
    if (!this.isSchedulable(user)) return null;

    const scheduleKey = this.buildScheduleKey(user.lat, user.lon, user.tz, user.method ?? 3);
    const normalizedUser = {
      ...user,
      method: user.method ?? 3,
      schedule_key: scheduleKey
    };

    await this.syncSingleSchedule(normalizedUser, now);

    const next = await this.findNextForUser(normalizedUser, nowIsoMinuteUTC(now), true);

    return {
      scheduleKey,
      nextPrayer: next?.nextPrayer ?? null,
      dueMinuteUTC: next?.dueMinuteUTC ?? null
    };
  }

  async findNextForUser(
    user: SchedulableUser,
    minuteUTC: string,
    includeCurrent: boolean
  ): Promise<NextSchedule | null> {
    if (!this.isSchedulable(user)) return null;

    const method = user.method ?? 3;
    const scheduleKey =
      user.schedule_key || this.buildScheduleKey(user.lat, user.lon, user.tz, method);
    const baseDate = new Date(`${minuteUTC}:00.000Z`);
    const today = localDateParts(user.tz, baseDate);
    const tomorrow = addDaysToLocalDate(today, 1);
    const rows = await this.deps.schedules.listSchedulesByKey(scheduleKey, [
      toDayLocal(today),
      toDayLocal(tomorrow)
    ]);

    return findNextFromRows(rows, minuteUTC, includeCurrent);
  }

  async deleteExpiredSchedules(now = new Date()): Promise<void> {
    const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2));
    const cutoffDay = cutoff.toISOString().slice(0, 10);
    await this.deps.schedules.deleteSchedulesBefore(cutoffDay);
  }

  private async syncSingleSchedule(user: RequiredSchedulableUser, now: Date): Promise<void> {
    const today = localDateParts(user.tz, now);
    const tomorrow = addDaysToLocalDate(today, 1);
    const syncedAt = now.toISOString();

    const todayTimings = await this.deps.prayerTimes.fetchPrayerTimes(
      user.lat,
      user.lon,
      user.method,
      today
    );
    await this.deps.schedules.upsertDailySchedule(
      buildDailyScheduleRow(user, todayTimings, today, syncedAt)
    );

    const tomorrowTimings = await this.deps.prayerTimes.fetchPrayerTimes(
      user.lat,
      user.lon,
      user.method,
      tomorrow
    );
    await this.deps.schedules.upsertDailySchedule(
      buildDailyScheduleRow(user, tomorrowTimings, tomorrow, syncedAt)
    );
  }

  private isSchedulable(user: SchedulableUser): user is RequiredSchedulableUser {
    return user.lat !== null && user.lon !== null && user.tz !== null;
  }
}

type RequiredSchedulableUser = SchedulableUser & {
  city: string | null;
  country: string | null;
  lat: number;
  lon: number;
  tz: string;
  method: number;
  schedule_key: string;
};

function buildDailyScheduleRow(
  user: RequiredSchedulableUser,
  timings: PrayerTimings,
  localDate: { year: number; month: number; day: number },
  syncedAt: string
): DailyScheduleRow {
  return {
    schedule_key: user.schedule_key,
    city: user.city,
    country: user.country,
    lat: user.lat,
    lon: user.lon,
    tz: user.tz,
    method: user.method,
    day_local: toDayLocal(localDate),
    fajr_time: timings.Fajr,
    fajr_due_minute_utc: timeToMinuteUtc(user.tz, localDate, timings.Fajr),
    dhuhr_time: timings.Dhuhr,
    dhuhr_due_minute_utc: timeToMinuteUtc(user.tz, localDate, timings.Dhuhr),
    asr_time: timings.Asr,
    asr_due_minute_utc: timeToMinuteUtc(user.tz, localDate, timings.Asr),
    maghrib_time: timings.Maghrib,
    maghrib_due_minute_utc: timeToMinuteUtc(user.tz, localDate, timings.Maghrib),
    isha_time: timings.Isha,
    isha_due_minute_utc: timeToMinuteUtc(user.tz, localDate, timings.Isha),
    synced_at: syncedAt
  };
}

function timeToMinuteUtc(
  tz: string,
  localDate: { year: number; month: number; day: number },
  time: string
): string {
  const [hour, minute] = time.split(":").map(Number);
  return localTimeToIsoMinuteUTC(tz, localDate, hour, minute);
}

function toDayLocal(localDate: { year: number; month: number; day: number }): string {
  return `${localDate.year}-${String(localDate.month).padStart(2, "0")}-${String(localDate.day).padStart(2, "0")}`;
}

function findNextFromRows(
  rows: DailyScheduleRow[],
  minuteUTC: string,
  includeCurrent: boolean
): NextSchedule | null {
  const entries: Array<{ prayer: PrayerName; dueMinuteUTC: string }> = [];

  for (const row of rows) {
    entries.push(
      { prayer: "Fajr", dueMinuteUTC: row.fajr_due_minute_utc },
      { prayer: "Dhuhr", dueMinuteUTC: row.dhuhr_due_minute_utc },
      { prayer: "Asr", dueMinuteUTC: row.asr_due_minute_utc },
      { prayer: "Maghrib", dueMinuteUTC: row.maghrib_due_minute_utc },
      { prayer: "Isha", dueMinuteUTC: row.isha_due_minute_utc }
    );
  }

  entries.sort((a, b) => a.dueMinuteUTC.localeCompare(b.dueMinuteUTC));

  for (const entry of entries) {
    const isDue =
      includeCurrent ? entry.dueMinuteUTC >= minuteUTC : entry.dueMinuteUTC > minuteUTC;
    if (isDue) return { nextPrayer: entry.prayer, dueMinuteUTC: entry.dueMinuteUTC };
  }

  return null;
}
