import type { PrayerTimesService } from "../services/prayerTimes";
import type { TelegramClient } from "../services/telegram";
import type { UserRepository } from "../repositories/userRepository";
import { localDayISO, nowIsoMinuteUTC, computeNextDueMinuteUTC } from "../utils/time";
import type { PrayerName } from "../domain/prayer";

type Deps = {
  telegram: TelegramClient;
  prayerTimes: PrayerTimesService;
  users: UserRepository;
};

export class CronHandler {
  constructor(private deps: Deps) {}

  async handle(): Promise<void> {
    const minuteUTC = nowIsoMinuteUTC();
    const dueUsers = await this.deps.users.listDueUsers(minuteUTC);

    for (const u of dueUsers) {
      if (!u.chat_id || !u.lat || !u.lon || !u.tz) continue;

      const prayer = u.next_prayer as PrayerName | null;
      if (!prayer) continue;

      const dayLocal = localDayISO(u.tz);

      if (!(await this.deps.users.wasSent(u.chat_id, dayLocal, prayer))) {
        await this.deps.telegram.sendMessage(u.chat_id, `Waktu sholat ${prayer}`);
        await this.deps.users.markSent(u.chat_id, dayLocal, prayer);
      }

      const method = u.method ?? 3;
      const timings = await this.deps.prayerTimes.fetchPrayerTimes(u.lat, u.lon, method);
      const next = computeNextDueMinuteUTC(u.tz, timings);

      await this.deps.users.updateNextSchedule(
        u.chat_id,
        next?.nextPrayer ?? null,
        next?.dueMinuteUTC ?? null
      );
    }
  }
}
