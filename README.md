# Sholat Telegram Bot

A Telegram bot built on Cloudflare Workers + D1 for prayer time reminders, with a simple static frontend for schedule preview.

## Features
- Set the user location with a city name through Telegram.
- Send real-time reminders at each prayer time.
- Separate daily schedule refresh from notification dispatch.
- Expose read-only public API endpoints for the frontend preview.
- Include a simple static landing page in the `web/` folder.

## Commands
- `/start`
- `/setcity <city, country>`
- `/status`
- `/method <number>`
- `/mute`
- `/unmute`

## Architecture
- `* * * * *`: dispatch Telegram notifications from schedules already stored in D1.
- `0 0 * * *`: refresh the daily schedule cache from AlAdhan for the active local day and the next local day.
- Geocoding: Nominatim.
- Timezone lookup: timeapi.io with AlAdhan as fallback.
- Prayer times: AlAdhan.

## Worker Configuration
Copy `wrangler.toml.example` to `wrangler.toml`, then fill in the values.

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

3. Create the D1 database:
```bash
wrangler d1 create sholat_bot_db
```

4. Put the `database_id` into `wrangler.toml`.

5. Run the migrations:
```bash
wrangler d1 migrations apply sholat_bot_db --local
wrangler d1 migrations apply sholat_bot_db
```

6. Store the secrets:
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put WEBHOOK_SECRET
```

7. Deploy the Worker:
```bash
wrangler deploy
```

8. Set the Telegram webhook:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -d "url=https://sholat-bot.muharyman.workers.dev/webhook/<WEBHOOK_SECRET>"
```

## Frontend Deploy (Vercel)
1. Edit `web/config.js`:
```js
window.SHOLAT_APP_CONFIG = {
  API_BASE_URL: "https://sholat-bot.muharyman.workers.dev",
  TELEGRAM_BOT_URL: "https://t.me/your_bot_username"
};
```

2. When creating the project in Vercel, set the Root Directory to `web`.

3. Deploy the static site:
```bash
vercel --prod
```

Frontend app:
- `https://jadwal-sholat-bot.vercel.app/`

## Local Notes
- `wrangler.toml` is ignored by git. Keep local changes in that file and use `wrangler.toml.example` as the repository template.
- The frontend preview calls the Worker API directly, so `FRONTEND_ORIGIN` in the Worker should match the Vercel domain.
- The frontend stores the last successfully selected city in `localStorage`, then reloads fresh data when the page is opened again.
- The frontend uses English copy and a long date format such as `Sunday, 5 April 2026`.
- The minute-level dispatch cron no longer fetches AlAdhan directly.

## License
MIT. See `LICENSE`.
