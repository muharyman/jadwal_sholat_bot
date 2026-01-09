import type { Env } from "../types";

export type LatLon = { lat: number; lon: number };

export type CitySearchResult = {
  title: string;
  description: string;
  query: string;
};

export interface Geocoder {
  geocodeCity(query: string): Promise<LatLon | null>;
  searchCities(query: string, limit?: number): Promise<CitySearchResult[]>;
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

  async searchCities(query: string, limit = 8): Promise<CitySearchResult[]> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url, {
      headers: { "User-Agent": this.env.NOMINATIM_USER_AGENT }
    });
    if (!res.ok) return [];

    const data = (await res.json()) as Array<{
      display_name?: string;
      name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        country?: string;
        country_code?: string;
      };
    }>;

    return data.map(item => {
      const address = item.address || {};
      const city =
        address.city ||
        address.town ||
        address.village ||
        address.county ||
        item.name ||
        item.display_name?.split(",")[0]?.trim() ||
        "Unknown";
      const countryCode = address.country_code?.toUpperCase();
      const country = address.country || "";
      const title = countryCode ? `${city}, ${countryCode}` : country ? `${city}, ${country}` : city;
      const description =
        item.display_name ||
        [city, address.state, country].filter(Boolean).join(", ");
      const queryText = countryCode
        ? `${city}, ${countryCode}`
        : country
          ? `${city}, ${country}`
          : item.display_name || city;

      return { title, description, query: queryText };
    });
  }
}
