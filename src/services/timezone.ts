export interface TimezoneService {
  lookupTimezone(lat: number, lon: number): Promise<string>;
}

export class TimeApiTimezoneService implements TimezoneService {
  async lookupTimezone(lat: number, lon: number): Promise<string> {
    const url = new URL("https://timeapi.io/api/TimeZone/coordinate");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));

    const res = await fetch(url);
    if (!res.ok) return "UTC";

    const j = (await res.json()) as { timeZone?: string };
    return j.timeZone || "UTC";
  }
}
