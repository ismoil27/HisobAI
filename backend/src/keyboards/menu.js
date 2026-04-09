import { Markup } from "telegraf";
import { getWebAppUrl, hasTelegramWebAppUrl } from "../webAppUrl.js";

const OPEN_WEB_LABEL = "Ilovani ochish";

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
    [Markup.button.callback("Xarajat", "add:type:expense"), Markup.button.callback("Tushum", "add:type:income")]
  ]);
}

export function addDateKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Bugun", "add:date:today"), Markup.button.callback("Boshqa sana", "add:date:custom")]
  ]);
}

export function summaryKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Shu hafta", "summary:week"), Markup.button.callback("Shu oy", "summary:month")]
  ]);
}
