# Sholat Telegram Bot

Bot Telegram berbasis Cloudflare Workers + D1 untuk reminder waktu sholat, plus frontend statis sederhana untuk preview jadwal.

## Features
- Set lokasi cukup dengan nama kota lewat Telegram.
- Reminder real-time tetap dikirim tiap waktu sholat.
- Refresh jadwal harian dipisah dari dispatch notifikasi.
- Public API read-only untuk frontend preview.
- Static landing page sederhana di folder `web/`.

## Commands
- `/start`
- `/setcity <kota, negara>`
- `/status`
- `/method <number>`
- `/mute`
- `/unmute`

## Architecture
- `* * * * *`: dispatch notifikasi Telegram dari schedule yang sudah tersimpan di D1.
- `0 0 * * *`: refresh cache jadwal harian dari AlAdhan untuk hari lokal aktif + hari berikutnya.
- Geocoding: Nominatim.
- Timezone lookup: timeapi.io dengan fallback AlAdhan.
- Prayer times: AlAdhan.

## Worker Configuration
Salin `wrangler.toml.example` menjadi `wrangler.toml`, lalu isi nilainya.

Vars:
- `TELEGRAM_API_BASE`
- `NOMINATIM_USER_AGENT`
- `FRONTEND_ORIGIN`

Secrets:
- `TELEGRAM_BOT_TOKEN`
- `WEBHOOK_SECRET`

Database binding:
- `DB`

## Public API
- `GET /health`
- `GET /api/public/search-city?q=jakarta`
- `GET /api/public/prayer-times?city=Jakarta,%20Indonesia&method=3`

## Backend Deploy
1. Install dependency:
```bash
npm install
```

2. Login Cloudflare:
```bash
wrangler login
```

3. Buat D1 database:
```bash
wrangler d1 create sholat_bot_db
```

4. Isi `database_id` ke `wrangler.toml`.

5. Jalankan migrasi:
```bash
wrangler d1 migrations apply sholat_bot_db --local
wrangler d1 migrations apply sholat_bot_db
```

6. Simpan secret:
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put WEBHOOK_SECRET
```

7. Deploy Worker:
```bash
wrangler deploy
```

8. Set webhook Telegram:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -d "url=https://sholat-bot.<subdomain>.workers.dev/webhook/<WEBHOOK_SECRET>"
```

## Frontend Deploy (Vercel)
1. Edit `web/config.js`:
```js
window.SHOLAT_APP_CONFIG = {
  API_BASE_URL: "https://sholat-bot.<your-cloudflare-subdomain>.workers.dev",
  TELEGRAM_BOT_URL: "https://t.me/your_bot_username"
};
```

2. Saat membuat project di Vercel, set Root Directory ke `web`.

3. Deploy static site:
```bash
vercel --prod
```

## Local Notes
- `wrangler.toml` di-ignore oleh git. Simpan perubahan lokal di file itu, dan gunakan `wrangler.toml.example` sebagai template repo.
- Frontend preview memanggil Worker API langsung, jadi `FRONTEND_ORIGIN` di Worker harus sesuai domain Vercel.
- Dispatch cron per menit tidak lagi fetch AlAdhan.

## License
MIT. Lihat `LICENSE`.
