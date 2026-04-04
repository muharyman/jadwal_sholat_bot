import type { Env, TelegramUpdate } from "./types";
import { bad, okJson } from "./utils/http";
import { TelegramApiClient } from "./services/telegram";
import { NominatimGeocoder } from "./services/geocoding";
import { TimeApiTimezoneService } from "./services/timezone";
import { AlAdhanPrayerTimesService } from "./services/prayerTimes";
import { D1UserRepository } from "./repositories/userRepository";
import { CommandHandler } from "./handlers/commandHandler";
import { DispatchCronHandler } from "./handlers/dispatchCronHandler";
import { RefreshCronHandler } from "./handlers/refreshCronHandler";

const DISPATCH_CRON = "* * * * *";
const REFRESH_CRON = "0 0 * * *";

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

  const dispatchCronHandler = new DispatchCronHandler({ telegram, prayerTimes, users });
  const refreshCronHandler = new RefreshCronHandler();

  return { commandHandler, dispatchCronHandler, refreshCronHandler };
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
