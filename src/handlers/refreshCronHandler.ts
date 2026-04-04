import type { UserRepository } from "../repositories/userRepository";
import { PrayerScheduleCacheService } from "../services/scheduleCache";
import { nowIsoMinuteUTC } from "../utils/time";

type Deps = {
  scheduleCache: PrayerScheduleCacheService;
  users: UserRepository;
};

export class RefreshCronHandler {
  constructor(private deps: Deps) {}

  async handle(): Promise<void> {
    const users = await this.deps.users.listSchedulableUsers();
    await this.deps.scheduleCache.syncUsers(users);

    for (const user of users) {
      const next = await this.deps.scheduleCache.findNextForUser(user, nowIsoMinuteUTC(), true);
      await this.deps.users.updateNextSchedule(
        user.chat_id,
        next?.nextPrayer ?? null,
        next?.dueMinuteUTC ?? null
      );
    }

    await this.deps.scheduleCache.deleteExpiredSchedules();
  }
}
