import dotenv from "dotenv";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("Missing BOT_TOKEN in environment variables.");
}

export const config = {
  botToken: BOT_TOKEN,
  defaultTimezone: process.env.DEFAULT_TIMEZONE || "Asia/Seoul",
  port: Number(process.env.RAILWAY_ENVIRONMENT ? process.env.PORT || 3003 : process.env.PORT || 3003),
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  webDefaultTelegramId: process.env.WEB_DEFAULT_TELEGRAM_ID || "web-local",
  webDefaultName: process.env.WEB_DEFAULT_NAME || "Local Dashboard",
  telegramWebAppUrl: process.env.TELEGRAM_WEB_APP_URL || "",
  adminTelegramUsername: (process.env.ADMIN_TELEGRAM_USERNAME || "ismoiljon27").toLowerCase()
};
