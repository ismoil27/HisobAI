import { Telegraf, Markup, session, Input } from "telegraf";
import path from "node:path";
import { config } from "./config.js";
import { upsertUserFromTelegram } from "./repositories/userRepository.js";
import {
  createTransaction,
  getMonthActivity,
  getTransactionsByDate
} from "./repositories/transactionRepository.js";
import { buildSummaryMessage } from "./services/summaryService.js";
import { addDateKeyboard, addTypeKeyboard, mainMenuKeyboard, summaryKeyboard, webAppReplyKeyboard } from "./keyboards/menu.js";
import { buildCalendarKeyboard } from "./keyboards/calendar.js";
import { compactDate, compactTime, formatMoney } from "./utils/format.js";
import { dayjs, monthBounds, parseDateInput } from "./utils/dates.js";
import { EXPENSE_SYMBOL, INCOME_SYMBOL } from "./utils/symbols.js";
import { getWebAppUrl, hasTelegramWebAppUrl } from "./webAppUrl.js";

const welcomeImagePath = path.join(process.cwd(), "public", "welcome-card.png");

function dashboardMessage() {
  if (hasTelegramWebAppUrl()) {
    return `Ilova manzili: ${getWebAppUrl()}`;
  }

  return "Telegram Mini App hali sozlanmagan. TELEGRAM_WEB_APP_URL ga Railway HTTPS manzilini kiriting.";
}

async function ensureMiniAppMenuButton(ctx) {
  if (!hasTelegramWebAppUrl()) {
    return;
  }

  await ctx.telegram.setChatMenuButton({
    chat_id: ctx.chat.id,
    menu_button: {
      type: "web_app",
      text: "Ilovani ochish",
      web_app: {
        url: getWebAppUrl()
      }
    }
  });
}

function createInitialSession() {
  return {
    addEntry: null
  };
}

function getUserRecord(ctx) {
  return upsertUserFromTelegram(ctx.from, ctx.chat.id, config.defaultTimezone);
}

function resetAddFlow(ctx) {
  ctx.session.addEntry = null;
}

async function showMainMenu(ctx) {
  if (!hasTelegramWebAppUrl()) {
    return;
  }

  const replyKeyboard = webAppReplyKeyboard();
  if (replyKeyboard) {
    await ctx.reply("Ilovani ochish", replyKeyboard);
  }

  await ctx.reply("Ilovani ochish", mainMenuKeyboard());
}

function welcomeCaption() {
  return [
    "*Bu bot nima qila oladi?*",
    "📅 HisobAI - xarajat, tushum va qarzni bitta joyda yuritadi",
    "✅ Telegram ichida tezkor kalendar kuzatuvi",
    "📊 Haftalik va oylik taqqoslash hisobotlari",
    "🚀 Mini App orqali pulingizni tez boshqaring"
  ].join("\n");
}

async function showCalendar(ctx, user, monthText) {
  const month = dayjs.tz(monthText, "YYYY-MM", user.timezone).startOf("month");
  const bounds = monthBounds(month, user.timezone);
  const rows = getMonthActivity(user.id, compactDate(bounds.start), compactDate(bounds.end));

  return ctx.reply(
    `Kalendar: ${bounds.label}\n${EXPENSE_SYMBOL} xarajat  ${INCOME_SYMBOL} tushum`,
    buildCalendarKeyboard(month.format("YYYY-MM"), user.timezone, rows)
  );
}

function formatDayTransactions(date, transactions) {
  if (transactions.length === 0) {
    return `${date} kuni uchun yozuv yo'q.`;
  }

  const lines = [`${date} bo'yicha yozuvlar`, ""];
  let expense = 0;
  let income = 0;

  for (const item of transactions) {
    const icon = item.type === "expense" ? EXPENSE_SYMBOL : item.type === "income" ? INCOME_SYMBOL : "🔵";
    if (item.type === "expense") {
      expense += Number(item.amount);
    } else if (item.type === "income") {
      income += Number(item.amount);
    }

    const timeLabel = item.transaction_time || "12:00";
    const noteSuffix = item.note ? ` | ${item.note}` : "";
    lines.push(`${icon} ${timeLabel} · ${item.category} - ${formatMoney(item.amount)}${noteSuffix}`);
  }

  lines.push("", `Xarajat jami: ${formatMoney(expense)}`, `Tushum jami: ${formatMoney(income)}`);
  return lines.join("\n");
}

export function createBot() {
  const bot = new Telegraf(config.botToken);
  bot.use(session({ defaultSession: createInitialSession }));

  bot.start(async (ctx) => {
    getUserRecord(ctx);
    resetAddFlow(ctx);
    await ensureMiniAppMenuButton(ctx);

    const photoOptions = {
      caption: welcomeCaption(),
      parse_mode: "Markdown"
    };

    if (hasTelegramWebAppUrl()) {
      Object.assign(photoOptions, mainMenuKeyboard());
    }

    await ctx.replyWithPhoto(Input.fromLocalFile(welcomeImagePath), photoOptions);

    if (hasTelegramWebAppUrl()) {
      const replyKeyboard = webAppReplyKeyboard();
      if (replyKeyboard) {
        await ctx.reply("Ilovani ochish", replyKeyboard);
      }
    }
  });

  bot.command("menu", async (ctx) => {
    getUserRecord(ctx);
    await ensureMiniAppMenuButton(ctx);
    await showMainMenu(ctx);
  });

  bot.command("dashboard", async (ctx) => {
    getUserRecord(ctx);
    await ctx.reply(dashboardMessage(), mainMenuKeyboard());
  });

  bot.command("add", async (ctx) => {
    getUserRecord(ctx);
    ctx.session.addEntry = { step: "type" };
    await ctx.reply("Nima qo'shmoqchisiz?", addTypeKeyboard());
  });

  bot.command("calendar", async (ctx) => {
    const user = getUserRecord(ctx);
    await showCalendar(ctx, user, dayjs().tz(user.timezone).format("YYYY-MM"));
  });

  bot.command("summary", async (ctx) => {
    const user = getUserRecord(ctx);
    await ctx.reply(`${user.first_name || "Hisob"} uchun hisobot davrini tanlang:`, summaryKeyboard());
  });

  bot.action("menu:add", async (ctx) => {
    getUserRecord(ctx);
    ctx.session.addEntry = { step: "type" };
    await ctx.answerCbQuery();
    await ctx.reply("Nima qo'shmoqchisiz?", addTypeKeyboard());
  });

  bot.action("menu:calendar", async (ctx) => {
    const user = getUserRecord(ctx);
    await ctx.answerCbQuery();
    await showCalendar(ctx, user, dayjs().tz(user.timezone).format("YYYY-MM"));
  });

  bot.action("menu:summary", async (ctx) => {
    getUserRecord(ctx);
    await ctx.answerCbQuery();
    await ctx.reply("Hisobot davrini tanlang:", summaryKeyboard());
  });

  bot.action("menu:home", async (ctx) => {
    getUserRecord(ctx);
    await ctx.answerCbQuery();
    await showMainMenu(ctx);
  });

  bot.action(/^add:type:(expense|income)$/, async (ctx) => {
    getUserRecord(ctx);
    const type = ctx.match[1];
    ctx.session.addEntry = { step: "amount", type };
    await ctx.answerCbQuery();
    await ctx.reply(`${type === "expense" ? "Xarajat" : "Tushum"} miqdorini kiriting. Masalan: 25000`);
  });

  bot.action("add:note:skip", async (ctx) => {
    getUserRecord(ctx);

    if (!ctx.session.addEntry || ctx.session.addEntry.step !== "note") {
      await ctx.answerCbQuery("Faol qo'shish jarayoni yo'q.");
      return;
    }

    ctx.session.addEntry.note = "";
    ctx.session.addEntry.step = "date";
    await ctx.answerCbQuery();
    await ctx.reply("Sana tanlang:", addDateKeyboard());
  });

  bot.action("add:date:today", async (ctx) => {
    const user = getUserRecord(ctx);

    if (!ctx.session.addEntry || ctx.session.addEntry.step !== "date") {
      await ctx.answerCbQuery("Faol qo'shish jarayoni yo'q.");
      return;
    }

    const now = dayjs().tz(user.timezone);
    createTransaction({
      user_id: user.id,
      type: ctx.session.addEntry.type,
      amount: ctx.session.addEntry.amount,
      category: ctx.session.addEntry.category,
      note: ctx.session.addEntry.note || "",
      transaction_date: compactDate(now.startOf("day")),
      transaction_time: compactTime(now)
    });

    await ctx.answerCbQuery();
    resetAddFlow(ctx);
    await ctx.reply("Saqlandi.", mainMenuKeyboard());
  });

  bot.action("add:date:custom", async (ctx) => {
    getUserRecord(ctx);

    if (!ctx.session.addEntry || ctx.session.addEntry.step !== "date") {
      await ctx.answerCbQuery("Faol qo'shish jarayoni yo'q.");
      return;
    }

    ctx.session.addEntry.step = "customDate";
    await ctx.answerCbQuery();
    await ctx.reply("Sanani YYYY-MM-DD formatida yuboring yoki today deb yozing.");
  });

  bot.action(/^summary:(week|month)$/, async (ctx) => {
    const user = getUserRecord(ctx);
    const kind = ctx.match[1];
    const message = buildSummaryMessage(user.id, kind, user.timezone);
    await ctx.answerCbQuery();
    await ctx.reply(message, mainMenuKeyboard());
  });

  bot.action(/^calendar:month:(\d{4}-\d{2})$/, async (ctx) => {
    const user = getUserRecord(ctx);
    const monthText = ctx.match[1];
    await ctx.answerCbQuery();
    await showCalendar(ctx, user, monthText);
  });

  bot.action(/^calendar:day:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2})$/, async (ctx) => {
    const user = getUserRecord(ctx);
    const date = ctx.match[1];
    const monthText = ctx.match[2];
    const transactions = getTransactionsByDate(user.id, date);
    await ctx.answerCbQuery();
    await ctx.reply(
      formatDayTransactions(date, transactions),
      Markup.inlineKeyboard([
        [Markup.button.callback("Kalendar ortga", `calendar:month:${monthText}`)],
        [Markup.button.callback("Menyuga qaytish", "menu:home")]
      ])
    );
  });

  bot.action("noop", async (ctx) => {
    await ctx.answerCbQuery();
  });

  bot.on("text", async (ctx) => {
    const user = getUserRecord(ctx);
    const state = ctx.session.addEntry;
    const text = ctx.message.text.trim();

    if (!state) {
      if (text === "Kalendar") {
        await showCalendar(ctx, user, dayjs().tz(user.timezone).format("YYYY-MM"));
        return;
      }

      if (text === "Hisobot") {
        await ctx.reply("Hisobot davrini tanlang:", summaryKeyboard());
        return;
      }

      if (text === "Ilovani ochish") {
        await ctx.reply(dashboardMessage(), mainMenuKeyboard());
      }

      return;
    }

    if (state.step === "amount") {
      const amount = Number(text);
      if (!Number.isFinite(amount) || amount <= 0) {
        await ctx.reply("Musbat son kiriting.");
        return;
      }

      ctx.session.addEntry.amount = amount;
      ctx.session.addEntry.step = "category";
      await ctx.reply("Toifani kiriting. Masalan: Ovqat, Yo'l, Maosh");
      return;
    }

    if (state.step === "category") {
      ctx.session.addEntry.category = text;
      ctx.session.addEntry.step = "note";
      await ctx.reply(
        "Izoh kiriting yoki o'tkazib yuboring.",
        Markup.inlineKeyboard([
          [Markup.button.callback("Izohsiz davom etish", "add:note:skip")]
        ])
      );
      return;
    }

    if (state.step === "note") {
      ctx.session.addEntry.note = text;
      ctx.session.addEntry.step = "date";
      await ctx.reply("Sana tanlang:", addDateKeyboard());
      return;
    }

    if (state.step === "customDate") {
      const parsedDate = parseDateInput(text, user.timezone);
      if (!parsedDate) {
        await ctx.reply("Sana formati YYYY-MM-DD yoki today bo'lishi kerak.");
        return;
      }

      createTransaction({
        user_id: user.id,
        type: state.type,
        amount: state.amount,
        category: state.category,
        note: state.note || "",
        transaction_date: compactDate(parsedDate),
        transaction_time: compactTime(dayjs().tz(user.timezone))
      });

      resetAddFlow(ctx);
      await ctx.reply(`${compactDate(parsedDate)} uchun saqlandi.`, mainMenuKeyboard());
    }
  });

  bot.catch((error, ctx) => {
    console.error("Bot error", error);
    ctx.reply("So'rovni bajarishda xatolik yuz berdi.");
  });

  return bot;
}
