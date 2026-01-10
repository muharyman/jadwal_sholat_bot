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
    if (update.inline_query?.id) {
      await this.handleInlineQuery(update.inline_query);
      return;
    }

    const msg = update.message;
    if (!msg?.chat?.id) return;

    const chatId = msg.chat.id;
    const { cmd, args } = parseCommand(msg.text);

    if (cmd === "/start") {
      await this.deps.telegram.sendMessage(
        chatId,
        "Assalamualaikum! ✨\n" +
          "Selamat datang di Bot Waktu Sholat.\n\n" +
          "Mulai cepat:\n" +
          "  /setcity <kota>, <negara>\n" +
          "  Contoh: /setcity Berlin, Jerman\n\n" +
          "Cek jadwal:\n" +
          "  /status\n\n" +
          "Atur metode & notif:\n" +
          "  /method 3  (MWL)\n" +
          "  /mute /unmute"
      );
      return;
    }

    if (cmd === "/setcity") {
      if (!args) {
        await this.deps.telegram.sendMessage(
          chatId,
          "Format yang benar:\n" +
            "  /setcity <kota>, <negara>\n" +
            "  Contoh: /setcity Berlin, Jerman"
        );
        return;
      }

      const geo = await this.deps.geocoder.geocodeCity(args);
      if (!geo) {
        await this.deps.telegram.sendMessage(
          chatId,
          "❌ Kota tidak ditemukan.\n" +
            "Coba lebih spesifik, misalnya: Berlin, Jerman"
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
        `✅ Kota tersimpan!\n` +
          `📍 Lokasi: ${city || args}, ${country || ""}\n` +
          `🕒 TZ: ${tz}\n` +
          `🧭 Method: 3 (MWL)\n\n` +
          `Ketik /status untuk lihat jadwal.`
      );
      return;
    }

    if (cmd === "/method") {
      const m = Number(args);
      if (!m || Number.isNaN(m)) {
        await this.deps.telegram.sendMessage(
          chatId,
          "Format:\n" +
            "  /method <angka>\n" +
            "  Contoh: /method 3\n\n" +
            "Contoh method (AlAdhan):\n" +
            "2=ISNA, 3=MWL, 4=UmmAlQura, 5=Egypt"
        );
        return;
      }

      const u = await this.deps.users.getUser(chatId);
      if (!u?.lat || !u.lon || !u.tz) {
        await this.deps.telegram.sendMessage(
          chatId,
          "⚠️ Set kota dulu:\n" +
            "  /setcity Berlin, Jerman"
        );
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

      await this.deps.telegram.sendMessage(chatId, `✅ Method diubah ke ${m}.`);
      return;
    }

    if (cmd === "/status") {
      const u = await this.deps.users.getUser(chatId);
      if (!u?.lat || !u.lon || !u.tz) {
        await this.deps.telegram.sendMessage(
          chatId,
          "⚠️ Set kota dulu:\n" +
            "  /setcity Berlin, Jerman"
        );
        return;
      }

      const method = u.method ?? 3;
      const today = localDateParts(u.tz);
      const timings = await this.deps.prayerTimes.fetchPrayerTimes(u.lat, u.lon, method, today);

      await this.deps.telegram.sendMessage(
        chatId,
        `🕌 Jadwal Sholat\n` +
          `📍 Kota: ${u.city ?? "-"}, ${u.country ?? "-"}\n` +
          `🕒 TZ: ${u.tz}\n` +
          `🧭 Method: ${method}\n\n` +
          `Fajr: ${timings.Fajr}\n` +
          `Dhuhr: ${timings.Dhuhr}\n` +
          `Asr: ${timings.Asr}\n` +
          `Maghrib: ${timings.Maghrib}\n` +
          `Isha: ${timings.Isha}\n\n` +
          `Notif: ${(u.muted ?? 0) ? "OFF" : "ON"}`
      );
      return;
    }

    if (cmd === "/mute") {
      await this.deps.users.setMuted(chatId, 1);
      await this.deps.telegram.sendMessage(
        chatId,
        "🔕 Notifikasi dimatikan.\n" +
          "Ketik /unmute untuk aktifkan lagi."
      );
      return;
    }

    if (cmd === "/unmute") {
      await this.deps.users.setMuted(chatId, 0);
      await this.deps.telegram.sendMessage(chatId, "🔔 Notifikasi diaktifkan. Siap mengingatkan! ✨");
      return;
    }
  }

  private async handleInlineQuery(inlineQuery: { id: string; query: string }): Promise<void> {
    const q = inlineQuery.query.trim();
    if (q.length < 2) {
      await this.deps.telegram.answerInlineQuery(inlineQuery.id, [], {
        cacheTime: 1,
        isPersonal: true
      });
      return;
    }

    const results = await this.deps.geocoder.searchCities(q);
    const inlineResults = results.map((r, idx) => ({
      type: "article" as const,
      id: `${idx}-${r.query}`,
      title: r.title,
      description: r.description,
      input_message_content: {
        message_text: `/setcity ${r.query}`
      }
    }));

    await this.deps.telegram.answerInlineQuery(inlineQuery.id, inlineResults, {
      cacheTime: 60,
      isPersonal: true
    });
  }
}
