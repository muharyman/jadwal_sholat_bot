export interface TimezoneService {
  lookupTimezone(lat: number, lon: number): Promise<string>;
}

export class TimeApiTimezoneService implements TimezoneService {
  async lookupTimezone(lat: number, lon: number): Promise<string> {
    const url = new URL("https://timeapi.io/api/TimeZone/coordinate");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));

    const res = await fetch(url);
    if (res.ok) {
      const j = (await res.json()) as { timeZone?: string };
      if (j.timeZone) return j.timeZone;
    }

    const fallback = await this.lookupTimezoneViaAlAdhan(lat, lon);
    return fallback || "UTC";
  }

  private async lookupTimezoneViaAlAdhan(lat: number, lon: number): Promise<string | null> {
    const d = new Date();
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getUTCFullYear());
    const dateStr = `${dd}-${mm}-${yyyy}`;

    const url = new URL(`https://api.aladhan.com/v1/timings/${dateStr}`);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("method", "3");

    const res = await fetch(url);
    if (!res.ok) return null;

    const j = (await res.json()) as { data?: { meta?: { timezone?: string } } };
    return j?.data?.meta?.timezone ?? null;
  }
}
