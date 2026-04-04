import { PRAYERS, PrayerName, PrayerTimings } from "../domain/prayer";

export type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

export type LocalDateTimeParts = LocalDateParts & {
  hour: number;
  minute: number;
};

export function nowIsoMinuteUTC(date = new Date()): string {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export function localDayISO(tz: string, date = new Date()): string {
  const parts = localDateParts(tz, date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function localDateTimeParts(tz: string, date = new Date()): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === type)!.value);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute")
  };
}

export function localDateParts(tz: string, date = new Date()): LocalDateParts {
  const parts = localDateTimeParts(tz, date);
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function addDaysToLocalDate(base: LocalDateParts, days: number): LocalDateParts {
  const d = new Date(Date.UTC(base.year, base.month - 1, base.day));
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function getTimeZoneOffsetMinutes(tz: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset"
  }).formatToParts(date);
  const tzName = parts.find(p => p.type === "timeZoneName")?.value ?? "UTC";

  if (tzName === "UTC" || tzName === "GMT") return 0;

  const match = tzName.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
}

function partsToUtcMs(p: LocalDateTimeParts): number {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
}

function utcFromZonedParts(
  tz: string,
  date: LocalDateParts,
  hour: number,
  minute: number
): Date {
  const target: LocalDateTimeParts = { ...date, hour, minute };
  const guessUtcMs = partsToUtcMs(target);
  const guessDate = new Date(guessUtcMs);

  let offset = getTimeZoneOffsetMinutes(tz, guessDate);
  let utcMs = guessUtcMs - offset * 60_000;

  const check = localDateTimeParts(tz, new Date(utcMs));
  const diffMinutes = (partsToUtcMs(target) - partsToUtcMs(check)) / 60_000;

  if (diffMinutes !== 0) {
    utcMs += diffMinutes * 60_000;
  }

  return new Date(utcMs);
}

export function localTimeToIsoMinuteUTC(
  tz: string,
  localDate: LocalDateParts,
  hour: number,
  minute: number
): string {
  const due = utcFromZonedParts(tz, localDate, hour, minute);
  due.setSeconds(0, 0);
  return due.toISOString().slice(0, 16);
}

export function computeNextDueMinuteUTC(
  tz: string,
  timings: PrayerTimings,
  localDate: LocalDateParts,
  nowLocal = localDateTimeParts(tz)
): { nextPrayer: PrayerName; dueMinuteUTC: string } | null {
  const isToday =
    localDate.year === nowLocal.year &&
    localDate.month === nowLocal.month &&
    localDate.day === nowLocal.day;

  const nowTotal = isToday ? nowLocal.hour * 60 + nowLocal.minute : -1;

  for (const p of PRAYERS) {
    const [hh, mm] = timings[p].split(":").map(Number);
    const tTotal = hh * 60 + mm;

    if (tTotal >= nowTotal) {
      const due = utcFromZonedParts(tz, localDate, hh, mm);
      due.setSeconds(0, 0);
      return { nextPrayer: p, dueMinuteUTC: due.toISOString().slice(0, 16) };
    }
  }
  return null;
}
