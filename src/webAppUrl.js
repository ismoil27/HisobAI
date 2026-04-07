import { config } from "./config.js";

let currentWebAppUrl = config.telegramWebAppUrl;

export function getWebAppUrl() {
  return currentWebAppUrl;
}

export function hasTelegramWebAppUrl() {
  return Boolean(currentWebAppUrl && currentWebAppUrl.startsWith("https://"));
}
