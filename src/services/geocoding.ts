import type { Env } from "../types";

export type LatLon = { lat: number; lon: number };

export interface Geocoder {
  geocodeCity(query: string): Promise<LatLon | null>;
}

export class NominatimGeocoder implements Geocoder {
  constructor(private env: Env) {}

  async geocodeCity(query: string): Promise<LatLon | null> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const res = await fetch(url, {
      headers: { "User-Agent": this.env.NOMINATIM_USER_AGENT }
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data?.length) return null;

    return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
  }
}
