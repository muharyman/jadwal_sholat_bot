import type { TelegramClient } from "../services/telegram";
import type { UserRepository } from "../repositories/userRepository";
import { localDayISO, nowIsoMinuteUTC } from "../utils/time";
import type { PrayerName } from "../domain/prayer";
import { PrayerScheduleCacheService } from "../services/scheduleCache";

type Deps = {
  telegram: TelegramClient;
  scheduleCache: PrayerScheduleCacheService;
  users: UserRepository;
};

export class DispatchCronHandler {
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
        await this.deps.telegram.sendMessage(
          u.chat_id,
          `ðŸ•Œ Waktunya sholat ${prayer}!\nSemoga Allah terima ibadahmu. ðŸ¤`
        );
        await this.deps.users.markSent(u.chat_id, dayLocal, prayer);
      }

      const next = await this.deps.scheduleCache.findNextForUser(u, minuteUTC, false);

      await this.deps.users.updateNextSchedule(
        u.chat_id,
        next?.nextPrayer ?? null,
        next?.dueMinuteUTC ?? null
      );
    }

    const staleUsers = await this.deps.users.listStaleUsers(minuteUTC);

    for (const u of staleUsers) {
      if (!u.chat_id || !u.lat || !u.lon || !u.tz) continue;

      const next = await this.deps.scheduleCache.findNextForUser(u, minuteUTC, true);

      await this.deps.users.updateNextSchedule(
        u.chat_id,
        next?.nextPrayer ?? null,
        next?.dueMinuteUTC ?? null
      );
    }
  }
}
