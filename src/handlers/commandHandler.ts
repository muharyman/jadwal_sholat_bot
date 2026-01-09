import type { TelegramUpdate } from "../types";
import type { Geocoder } from "../services/geocoding";
import type { TimezoneService } from "../services/timezone";
import type { PrayerTimesService } from "../services/prayerTimes";
import type { TelegramClient } from "../services/telegram";
import type { UserRepository } from "../repositories/userRepository";
import { parseCommand } from "../utils/command";
import { computeNextDueMinuteUTC, localDateParts, addDaysToLocalDate } from "../utils/time";

type Deps = {
  telegram: TelegramClient;
  geocoder: Geocoder;
  timezone: TimezoneService;
  prayerTimes: PrayerTimesService;
  users: UserRepository;
};

export class CommandHandler {
  constructor(private deps: Deps) {}

  async handle(update: TelegramUpdate): Promise<void> {
    const msg = update.message;
    if (!msg?.chat?.id) return;

    const chatId = msg.chat.id;
    const { cmd, args } = parseCommand(msg.text);

    if (cmd === "/start") {
      await this.deps.telegram.sendMessage(
        chatId,
        "Assalamualaikum! Bot notifikasi waktu sholat.\n\n" +
          "Set kota (tanpa GPS):\n" +
          "  /setcity Berlin, DE\n\n" +
          "Cek jadwal:\n" +
          "  /status\n\n" +
          "Opsional:\n" +
          "  /method 3  (MWL)\n" +
          "  /mute /unmute"
      );
      return;
    }

    if (cmd === "/setcity") {
      if (!args) {
        await this.deps.telegram.sendMessage(
          chatId,
          "Format: /setcity <kota, negara>\nContoh: /setcity Berlin, DE"
        );
        return;
      }

      const geo = await this.deps.geocoder.geocodeCity(args);
      if (!geo) {
        await this.deps.telegram.sendMessage(
          chatId,
          "Kota tidak ditemukan. Coba lebih spesifik, misalnya: Berlin, DE"
        );
        return;
      }

      const tz = await this.deps.timezone.lookupTimezone(geo.lat, geo.lon);
      const [city, country] = args.split(",").map(s => s.trim());

      const method = 3;
      const today = localDateParts(tz);
      const timings = await this.deps.prayerTimes.fetchPrayerTimes(geo.lat, geo.lon, method, today);
      let next = computeNextDueMinuteUTC(tz, timings, today);

      if (!next) {
        const tomorrow = addDaysToLocalDate(today, 1);
        const timingsTomorrow = await this.deps.prayerTimes.fetchPrayerTimes(
          geo.lat,
          geo.lon,
          method,
          tomorrow
        );
        next = computeNextDueMinuteUTC(tz, timingsTomorrow, tomorrow);
      }

      await this.deps.users.upsertUser({
        chat_id: chatId,
        city: city || args,
        country: country || "",
        lat: geo.lat,
        lon: geo.lon,
        tz,
        method,
        muted: 0,
        next_prayer: next?.nextPrayer ?? null,
        next_due_minute_utc: next?.dueMinuteUTC ?? null
      });

      await this.deps.telegram.sendMessage(
        chatId,
        `OK. Tersimpan: ${city || args}, ${country || ""}\nTZ: ${tz}\nMethod: 3 (MWL)\nKetik /status.`
      );
      return;
    }

    if (cmd === "/method") {
      const m = Number(args);
      if (!m || Number.isNaN(m)) {
        await this.deps.telegram.sendMessage(
          chatId,
          "Kirim: /method <angka>\nContoh: /method 3\n\n" +
            "Contoh method (AlAdhan):\n" +
            "2=ISNA, 3=MWL, 4=UmmAlQura, 5=Egypt"
        );
        return;
      }

      const u = await this.deps.users.getUser(chatId);
      if (!u?.lat || !u.lon || !u.tz) {
        await this.deps.telegram.sendMessage(chatId, "Set kota dulu: /setcity Berlin, DE");
        return;
      }

      const today = localDateParts(u.tz);
      const timings = await this.deps.prayerTimes.fetchPrayerTimes(u.lat, u.lon, m, today);
      let next = computeNextDueMinuteUTC(u.tz, timings, today);

      if (!next) {
        const tomorrow = addDaysToLocalDate(today, 1);
        const timingsTomorrow = await this.deps.prayerTimes.fetchPrayerTimes(
          u.lat,
          u.lon,
          m,
          tomorrow
        );
        next = computeNextDueMinuteUTC(u.tz, timingsTomorrow, tomorrow);
      }

      await this.deps.users.upsertUser({
        chat_id: chatId,
        city: u.city ?? "",
        country: u.country ?? "",
        lat: u.lat,
        lon: u.lon,
        tz: u.tz,
        method: m,
        muted: u.muted ?? 0,
        next_prayer: next?.nextPrayer ?? null,
        next_due_minute_utc: next?.dueMinuteUTC ?? null
      });

      await this.deps.telegram.sendMessage(chatId, `OK. Method diubah ke ${m}.`);
      return;
    }

    if (cmd === "/status") {
      const u = await this.deps.users.getUser(chatId);
      if (!u?.lat || !u.lon || !u.tz) {
        await this.deps.telegram.sendMessage(chatId, "Set kota dulu: /setcity Berlin, DE");
        return;
      }

      const method = u.method ?? 3;
      const today = localDateParts(u.tz);
      const timings = await this.deps.prayerTimes.fetchPrayerTimes(u.lat, u.lon, method, today);

      await this.deps.telegram.sendMessage(
        chatId,
        `Kota: ${u.city ?? "-"}, ${u.country ?? "-"}\nTZ: ${u.tz}\nMethod: ${method}\n\n` +
          `Fajr: ${timings.Fajr}\nDhuhr: ${timings.Dhuhr}\nAsr: ${timings.Asr}\nMaghrib: ${timings.Maghrib}\nIsha: ${timings.Isha}\n\n` +
          `Notif: ${(u.muted ?? 0) ? "OFF" : "ON"}`
      );
      return;
    }

    if (cmd === "/mute") {
      await this.deps.users.setMuted(chatId, 1);
      await this.deps.telegram.sendMessage(
        chatId,
        "Notifikasi dimatikan. /unmute untuk aktifkan lagi."
      );
      return;
    }

    if (cmd === "/unmute") {
      await this.deps.users.setMuted(chatId, 0);
      await this.deps.telegram.sendMessage(chatId, "Notifikasi diaktifkan.");
      return;
    }
  }
}
