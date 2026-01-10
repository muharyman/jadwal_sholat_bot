# Sholat Telegram Bot - Cloudflare Workers + Cron + D1

## Tujuan
Bot Telegram untuk notifikasi waktu sholat yang bisa dipakai publik.
User cukup set lokasi berdasarkan kota: `/setcity Berlin, Germany` (tanpa GPS permission).

## Fitur
- Set lokasi via nama kota.
- Jadwal sholat dari AlAdhan.
- Notifikasi otomatis via Cron setiap menit.
- Mute/unmute notifikasi.

## Commands
- `/start` - bantuan singkat
- `/setcity <kota, negara>` - set lokasi, contoh `/setcity Berlin, Germany`
- `/status` - cek jadwal dan status notifikasi
- `/method <angka>` - ganti metode perhitungan (AlAdhan)
- `/mute` - matikan notifikasi
- `/unmute` - nyalakan notifikasi

## Konfigurasi
Di `wrangler.toml`:
- `TELEGRAM_API_BASE` default `https://api.telegram.org`
- `NOMINATIM_USER_AGENT` harus diisi (format user agent yang valid)

Secrets:
- `TELEGRAM_BOT_TOKEN` dari @BotFather
- `WEBHOOK_SECRET` string random untuk endpoint webhook

Database:
- D1 binding: `DB`

## Cara Deploy (Cloudflare Workers)
1) Install dependencies:
```bash
npm install
```

2) Login Cloudflare:
```bash
npx wrangler login
```

3) Buat D1 database:
```bash
npx wrangler d1 create sholat_bot_db
```

4) Copy `database_id` hasil command, lalu paste ke `wrangler.toml`:
```
database_id = "..."
```

5) Jalankan migrations:
```bash
npx wrangler d1 migrations apply sholat_bot_db --local
npx wrangler d1 migrations apply sholat_bot_db
```

6) Set secrets:
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put WEBHOOK_SECRET
```

7) Deploy Worker:
```bash
npx wrangler deploy
```

8) Set Telegram webhook ke Worker:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -d "url=https://sholat-bot.<subdomain>.workers.dev/webhook/<WEBHOOK_SECRET>"
```

9) Cek webhook:
```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"
```

10) Test bot di Telegram:
```
/start
/setcity Berlin, Germany
/status
```

## Catatan Penting
- Geocoding menggunakan Nominatim (OpenStreetMap). Jangan spam.
- Timezone lookup memakai timeapi.io (gratis). Jika ingin tanpa third-party, bisa tambah command manual `/settz`.
- Cron trigger tiap menit sudah aktif (lihat `wrangler.toml`).
