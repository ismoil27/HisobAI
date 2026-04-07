# Hisob AI Bot

Telegram bot for recording spending, income, and debt, with a Telegram Mini App dashboard built with Express and EJS.

## Features

- Add income, expense, or debt entries
- Save category, note, amount, and date
- View a month calendar with day markers
- Open any day to see saved items
- Use a Telegram Mini App dashboard with calendar-based entry management
- Receive weekly and monthly comparison summaries

## Setup

1. Use `.env` as the only environment file.
2. Set `BOT_TOKEN`.
3. Set `PORT`.
4. Set `TELEGRAM_WEB_APP_URL` to your public Railway HTTPS URL.
5. Optional: set `DB_PATH` if you want SQLite stored on a mounted volume.
6. Install packages with `npm install`.
7. Start with `npm start`.

## Railway Deployment

1. Push this repo to GitHub.
2. Create a new Railway project from the repo.
3. Add environment variables in Railway:
   - `BOT_TOKEN`
   - `DEFAULT_TIMEZONE=Asia/Seoul`
   - `PORT=3000`
   - `TELEGRAM_WEB_APP_URL=https://your-app-name.up.railway.app`
   - `ADMIN_TELEGRAM_USERNAME=ismoiljon27`
   - `DB_PATH=/data/hisob.db`
4. Deploy once, copy the Railway public URL, and set that same URL as `TELEGRAM_WEB_APP_URL`.
5. In BotFather, update the Mini App URL to the same Railway HTTPS URL.
6. Add a Railway Volume and mount it at `/data`.

Important:
- Railway gives a public HTTPS URL, which is enough for Telegram Mini Apps.
- SQLite on Railway must use a mounted volume at `/data`, otherwise data will be wiped on redeploy.

## Commands

- `/start`
- `/add`
- `/calendar`
- `/summary`
- `/menu`

## Notes

- Calendar days are marked with `🔴` for spending and `🟢` for income.
- The bot only shows the Telegram `Open App` button when `TELEGRAM_WEB_APP_URL` is set to a valid `https://...` URL.
- Scheduled reports are sent every Monday at 09:00 and on day 1 of each month at 09:00.
