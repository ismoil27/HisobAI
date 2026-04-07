import { Markup } from "telegraf";
import { getWebAppUrl, hasTelegramWebAppUrl } from "../webAppUrl.js";

const OPEN_WEB_LABEL = "Open App";

export function mainMenuKeyboard() {
  if (hasTelegramWebAppUrl()) {
    return Markup.inlineKeyboard([
      [Markup.button.webApp(OPEN_WEB_LABEL, getWebAppUrl())]
    ]);
  }

  return undefined;
}

export function webAppReplyKeyboard() {
  if (!hasTelegramWebAppUrl()) {
    return null;
  }

  return Markup.keyboard([
    [Markup.button.webApp(OPEN_WEB_LABEL, getWebAppUrl())]
  ]).resize();
}

export function addTypeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Expense", "add:type:expense"), Markup.button.callback("Income", "add:type:income")]
  ]);
}

export function addDateKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Use Today", "add:date:today"), Markup.button.callback("Custom Date", "add:date:custom")]
  ]);
}

export function summaryKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("This Week", "summary:week"), Markup.button.callback("This Month", "summary:month")]
  ]);
}
