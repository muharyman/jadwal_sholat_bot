# Sholat Telegram Bot - Cloudflare Workers + Cron + D1

## Purpose
A Telegram bot that sends prayer time notifications for public use.
Users only need to set their location by city: `/setcity Berlin, Germany` (no GPS permission required).

## Features
- Set location using a city name.
- Prayer times from AlAdhan.
- Automatic notifications via Cron every minute.
- Mute/unmute notifications.

## Commands
- `/start` - quick help
- `/setcity <city, country>` - set location, example `/setcity Berlin, Germany`
- `/status` - view schedule and notification status
- `/method <number>` - change calculation method (AlAdhan)
- `/mute` - disable notifications
- `/unmute` - enable notifications

## Configuration
In `wrangler.toml`:
- `TELEGRAM_API_BASE` defaults to `https://api.telegram.org`
- `NOMINATIM_USER_AGENT` must be set (valid user agent format)

Secrets:
- `TELEGRAM_BOT_TOKEN` from @BotFather
- `WEBHOOK_SECRET` random string for the webhook endpoint

Database:
- D1 binding: `DB`

## Deployment (Cloudflare Workers)
1) Install dependencies:
```bash
npm install
```

2) Login to Cloudflare:
```bash
npx wrangler login
```

3) Create the D1 database:
```bash
npx wrangler d1 create sholat_bot_db
```

4) Copy the `database_id` output and paste it into `wrangler.toml`:
```
database_id = "..."
```

5) Run migrations:
```bash
npx wrangler d1 migrations apply sholat_bot_db --local
npx wrangler d1 migrations apply sholat_bot_db
```

6) Set secrets:
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put WEBHOOK_SECRET
```

7) Deploy the Worker:
```bash
npx wrangler deploy
```

8) Set Telegram webhook to the Worker:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -d "url=https://sholat-bot.<subdomain>.workers.dev/webhook/<WEBHOOK_SECRET>"
```

9) Check webhook:
```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"
```

10) Test the bot in Telegram:
```
/start
/setcity Berlin, Germany
/status
```

## Notes
- Geocoding uses Nominatim (OpenStreetMap). Please avoid heavy usage.
- Timezone lookup uses timeapi.io (free). If you want to avoid third-party calls, add a manual `/settz` command.
- The Cron trigger runs every minute (see `wrangler.toml`).

## Credits
- Prayer time data is provided by the AlAdhan API.

## License
This project is open source and available for use under the MIT License. See `LICENSE` for details.
