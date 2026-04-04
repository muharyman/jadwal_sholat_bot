import type { Env, TelegramUpdate } from "./types";
import { bad, okJson } from "./utils/http";
import { TelegramApiClient } from "./services/telegram";
import { NominatimGeocoder } from "./services/geocoding";
import { TimeApiTimezoneService } from "./services/timezone";
import { AlAdhanPrayerTimesService } from "./services/prayerTimes";
import { D1UserRepository } from "./repositories/userRepository";
import { D1ScheduleRepository } from "./repositories/scheduleRepository";
import { CommandHandler } from "./handlers/commandHandler";
import { DispatchCronHandler } from "./handlers/dispatchCronHandler";
import { RefreshCronHandler } from "./handlers/refreshCronHandler";
import { PrayerScheduleCacheService } from "./services/scheduleCache";
import { localDateParts } from "./utils/time";

const DISPATCH_CRON = "* * * * *";
const REFRESH_CRON = "0 0 * * *";

function buildHandlers(env: Env) {
  const telegram = new TelegramApiClient(env);
  const geocoder = new NominatimGeocoder(env);
  const timezone = new TimeApiTimezoneService();
  const prayerTimes = new AlAdhanPrayerTimesService();
  const users = new D1UserRepository(env);
  const schedules = new D1ScheduleRepository(env);
  const scheduleCache = new PrayerScheduleCacheService({ prayerTimes, schedules });

  const commandHandler = new CommandHandler({
    telegram,
    geocoder,
    timezone,
    prayerTimes,
    scheduleCache,
    users
  });

  const dispatchCronHandler = new DispatchCronHandler({ telegram, scheduleCache, users });
  const refreshCronHandler = new RefreshCronHandler({ scheduleCache, users });

  return {
    commandHandler,
    dispatchCronHandler,
    refreshCronHandler,
    geocoder,
    prayerTimes,
    timezone
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const { commandHandler, geocoder, prayerTimes, timezone } = buildHandlers(env);

    if (req.method === "OPTIONS" && url.pathname.startsWith("/api/public/")) {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env)
      });
    }

    if (req.method === "POST" && url.pathname === `/webhook/${env.WEBHOOK_SECRET}`) {
      const update = (await req.json()) as TelegramUpdate;
      await commandHandler.handle(update);
      return okJson({ ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/public/search-city") {
      const q = url.searchParams.get("q")?.trim() ?? "";
      if (!q) return okJson({ results: [] }, corsHeaders(env));

      const results = await geocoder.searchCities(q, 5);
      return okJson({ results }, corsHeaders(env));
    }

    if (req.method === "GET" && url.pathname === "/api/public/prayer-times") {
      const city = url.searchParams.get("city")?.trim() ?? "";
      const method = Number(url.searchParams.get("method") || "3") || 3;

      if (!city) {
        return new Response(JSON.stringify({ error: "city is required" }), {
          status: 400,
          headers: {
            "content-type": "application/json; charset=utf-8",
            ...corsHeaders(env)
          }
        });
      }

      const geo = await geocoder.geocodeCity(city);
      if (!geo) {
        return new Response(JSON.stringify({ error: "city not found" }), {
          status: 404,
          headers: {
            "content-type": "application/json; charset=utf-8",
            ...corsHeaders(env)
          }
        });
      }

      const tz = await timezone.lookupTimezone(geo.lat, geo.lon);
      const localDate = localDateParts(tz);
      const timings = await prayerTimes.fetchPrayerTimes(geo.lat, geo.lon, method, localDate);

      return okJson(
        {
          query: city,
          city,
          lat: geo.lat,
          lon: geo.lon,
          tz,
          method,
          day_local: `${localDate.year}-${String(localDate.month).padStart(2, "0")}-${String(localDate.day).padStart(2, "0")}`,
          timings
        },
        corsHeaders(env)
      );
    }

    if (url.pathname === "/health") return new Response("ok");

    return bad("Not Found", 404);
  },

  async scheduled(controller: ScheduledController, env: Env) {
    const { dispatchCronHandler, refreshCronHandler } = buildHandlers(env);

    if (controller.cron === REFRESH_CRON) {
      await refreshCronHandler.handle();
      return;
    }

    if (controller.cron === DISPATCH_CRON) {
      await dispatchCronHandler.handle();
      return;
    }
  }
};

function corsHeaders(env: Env): HeadersInit {
  return {
    "access-control-allow-origin": env.FRONTEND_ORIGIN || "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}
