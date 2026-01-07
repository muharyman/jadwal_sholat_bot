import type { Env, TelegramUpdate } from "./types";
import { bad, okJson } from "./utils/http";
import { TelegramApiClient } from "./services/telegram";
import { NominatimGeocoder } from "./services/geocoding";
import { TimeApiTimezoneService } from "./services/timezone";
import { AlAdhanPrayerTimesService } from "./services/prayerTimes";
import { D1UserRepository } from "./repositories/userRepository";
import { CommandHandler } from "./handlers/commandHandler";
import { CronHandler } from "./handlers/cronHandler";

function buildHandlers(env: Env) {
  const telegram = new TelegramApiClient(env);
  const geocoder = new NominatimGeocoder(env);
  const timezone = new TimeApiTimezoneService();
  const prayerTimes = new AlAdhanPrayerTimesService();
  const users = new D1UserRepository(env);

  const commandHandler = new CommandHandler({
    telegram,
    geocoder,
    timezone,
    prayerTimes,
    users
  });

  const cronHandler = new CronHandler({ telegram, prayerTimes, users });

  return { commandHandler, cronHandler };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const { commandHandler } = buildHandlers(env);

    if (req.method === "POST" && url.pathname === `/webhook/${env.WEBHOOK_SECRET}`) {
      const update = (await req.json()) as TelegramUpdate;
      await commandHandler.handle(update);
      return okJson({ ok: true });
    }

    if (url.pathname === "/health") return new Response("ok");

    return bad("Not Found", 404);
  },

  async scheduled(_controller: ScheduledController, env: Env) {
    const { cronHandler } = buildHandlers(env);
    await cronHandler.handle();
  }
};
