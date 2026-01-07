import { PRAYERS, PrayerName, PrayerTimings } from "../domain/prayer";

export function nowIsoMinuteUTC(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export function localDayISO(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const d = parts.find(p => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

export function localHM(tz: string): { h: number; m: number } {
  const hm = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date());
  const [h, m] = hm.split(":").map(Number);
  return { h, m };
}

export function computeNextDueMinuteUTC(
  tz: string,
  timings: PrayerTimings
): { nextPrayer: PrayerName; dueMinuteUTC: string } | null {
  const now = localHM(tz);
  const nowTotal = now.h * 60 + now.m;

  for (const p of PRAYERS) {
    const [hh, mm] = timings[p].split(":").map(Number);
    const tTotal = hh * 60 + mm;

    if (tTotal >= nowTotal) {
      const delta = tTotal - nowTotal;
      const due = new Date(Date.now() + delta * 60_000);
      due.setSeconds(0, 0);
      return { nextPrayer: p, dueMinuteUTC: due.toISOString().slice(0, 16) };
    }
  }
  return null;
}
