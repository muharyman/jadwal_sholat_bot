import type { PrayerTimings } from "../domain/prayer";

export interface PrayerTimesService {
  fetchPrayerTimes(lat: number, lon: number, method: number): Promise<PrayerTimings>;
}

export class AlAdhanPrayerTimesService implements PrayerTimesService {
  async fetchPrayerTimes(lat: number, lon: number, method: number): Promise<PrayerTimings> {
    const d = new Date();
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getUTCFullYear());
    const dateStr = `${dd}-${mm}-${yyyy}`;

    const url = new URL(`https://api.aladhan.com/v1/timings/${dateStr}`);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("method", String(method));

    const res = await fetch(url);
    if (!res.ok) throw new Error(`AlAdhan error: ${res.status}`);
    const j = (await res.json()) as any;
    const t = j?.data?.timings;
    if (!t) throw new Error("Invalid AlAdhan response");

    const pick = (x: string) => String(x).split(" ")[0];
    return {
      Fajr: pick(t.Fajr),
      Dhuhr: pick(t.Dhuhr),
      Asr: pick(t.Asr),
      Maghrib: pick(t.Maghrib),
      Isha: pick(t.Isha)
    };
  }
}
