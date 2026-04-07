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
import { compactDate, formatMoney } from "./utils/format.js";
import { dayjs, monthBounds, parseDateInput } from "./utils/dates.js";
import { EXPENSE_SYMBOL, INCOME_SYMBOL } from "./utils/symbols.js";
import { getWebAppUrl, hasTelegramWebAppUrl } from "./webAppUrl.js";

const welcomeImagePath = path.join(process.cwd(), "public", "welcome-card.png");

function dashboardMessage() {
  if (hasTelegramWebAppUrl()) {
    return `Dashboard: ${getWebAppUrl()}`;
  }

  return "Telegram Mini App is not configured yet. Set TELEGRAM_WEB_APP_URL to your Railway HTTPS URL.";
}

async function ensureMiniAppMenuButton(ctx) {
  if (!hasTelegramWebAppUrl()) {
    return;
  }

  await ctx.telegram.setChatMenuButton({
    chat_id: ctx.chat.id,
    menu_button: {
      type: "web_app",
      text: "Open App",
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
    await ctx.reply("Open App", replyKeyboard);
  }

  await ctx.reply("Open App", mainMenuKeyboard());
}

function welcomeCaption() {
  return [
    "*What can this bot do?*",
    "📅 HisobAI - spending, income, and qarz in one place",
    "✅ Fast calendar tracking inside Telegram",
    "📊 Weekly and monthly comparison reports",
    "🚀 Open the Mini App and manage your money quickly"
  ].join("\n");
}

async function showCalendar(ctx, user, monthText) {
  const month = dayjs.tz(monthText, "YYYY-MM", user.timezone).startOf("month");
  const bounds = monthBounds(month, user.timezone);
  const rows = getMonthActivity(user.id, compactDate(bounds.start), compactDate(bounds.end));

  return ctx.reply(
    `Calendar for ${bounds.label}\n${EXPENSE_SYMBOL} expense  ${INCOME_SYMBOL} income`,
    buildCalendarKeyboard(month.format("YYYY-MM"), user.timezone, rows)
  );
}

function formatDayTransactions(date, transactions) {
  if (transactions.length === 0) {
    return `No entries for ${date}.`;
  }

  const lines = [`Entries for ${date}`, ""];
  let expense = 0;
  let income = 0;

  for (const item of transactions) {
    const icon = item.type === "expense" ? EXPENSE_SYMBOL : INCOME_SYMBOL;
    if (item.type === "expense") {
      expense += Number(item.amount);
    } else {
      income += Number(item.amount);
    }

    const noteSuffix = item.note ? ` | ${item.note}` : "";
    lines.push(`${icon} ${item.category} - ${formatMoney(item.amount)}${noteSuffix}`);
  }

  lines.push("", `Expense total: ${formatMoney(expense)}`, `Income total: ${formatMoney(income)}`);
  return lines.join("\n");
}

export function createBot() {
  const bot = new Telegraf(config.botToken);
  bot.use(session({ defaultSession: createInitialSession }));

  bot.start(async (ctx) => {
    getUserRecord(ctx);
    resetAddFlow(ctx);
    await ensureMiniAppMenuButton(ctx);
    const welcomeMessage = {
      caption: welcomeCaption(),
      parse_mode: "Markdown"
    };

    if (hasTelegramWebAppUrl()) {
      Object.assign(welcomeMessage, mainMenuKeyboard());
    }

    await ctx.replyWithPhoto(Input.fromLocalFile(welcomeImagePath), welcomeMessage);

    if (hasTelegramWebAppUrl()) {
      const replyKeyboard = webAppReplyKeyboard();
      if (replyKeyboard) {
        await ctx.reply("Open App", replyKeyboard);
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
    await ctx.reply("What do you want to add?", addTypeKeyboard());
  });

  bot.command("calendar", async (ctx) => {
    const user = getUserRecord(ctx);
    await showCalendar(ctx, user, dayjs().tz(user.timezone).format("YYYY-MM"));
  });

  bot.command("summary", async (ctx) => {
    const user = getUserRecord(ctx);
    await ctx.reply(`Choose a summary period for ${user.first_name || "your account"}:`, summaryKeyboard());
  });

  bot.action("menu:add", async (ctx) => {
    getUserRecord(ctx);
    ctx.session.addEntry = { step: "type" };
    await ctx.answerCbQuery();
    await ctx.reply("What do you want to add?", addTypeKeyboard());
  });

  bot.action("menu:calendar", async (ctx) => {
    const user = getUserRecord(ctx);
    await ctx.answerCbQuery();
    await showCalendar(ctx, user, dayjs().tz(user.timezone).format("YYYY-MM"));
  });

  bot.action("menu:summary", async (ctx) => {
    getUserRecord(ctx);
    await ctx.answerCbQuery();
    await ctx.reply("Choose a summary period:", summaryKeyboard());
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
    await ctx.reply(`Enter the ${type} amount. Example: 25.50`);
  });

  bot.action("add:note:skip", async (ctx) => {
    getUserRecord(ctx);

    if (!ctx.session.addEntry || ctx.session.addEntry.step !== "note") {
      await ctx.answerCbQuery("No active add flow.");
      return;
    }

    ctx.session.addEntry.note = "";
    ctx.session.addEntry.step = "date";
    await ctx.answerCbQuery();
    await ctx.reply("Choose a date for this entry:", addDateKeyboard());
  });

  bot.action("add:date:today", async (ctx) => {
    const user = getUserRecord(ctx);

    if (!ctx.session.addEntry || ctx.session.addEntry.step !== "date") {
      await ctx.answerCbQuery("No active add flow.");
      return;
    }

    createTransaction({
      user_id: user.id,
      type: ctx.session.addEntry.type,
      amount: ctx.session.addEntry.amount,
      category: ctx.session.addEntry.category,
      note: ctx.session.addEntry.note || "",
      transaction_date: compactDate(dayjs().tz(user.timezone).startOf("day"))
    });

    await ctx.answerCbQuery();
    resetAddFlow(ctx);
    await ctx.reply("Saved.", mainMenuKeyboard());
  });

  bot.action("add:date:custom", async (ctx) => {
    getUserRecord(ctx);

    if (!ctx.session.addEntry || ctx.session.addEntry.step !== "date") {
      await ctx.answerCbQuery("No active add flow.");
      return;
    }

    ctx.session.addEntry.step = "customDate";
    await ctx.answerCbQuery();
    await ctx.reply("Send the date as YYYY-MM-DD or type today.");
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
        [Markup.button.callback("Back to Calendar", `calendar:month:${monthText}`)],
        [Markup.button.callback("Back to Menu", "menu:home")]
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
      if (text === "Calendar") {
        await showCalendar(ctx, user, dayjs().tz(user.timezone).format("YYYY-MM"));
        return;
      }

      if (text === "Summary") {
        await ctx.reply("Choose a summary period:", summaryKeyboard());
        return;
      }

      if (text === "Dashboard" || text === "Open App") {
        await ctx.reply(dashboardMessage(), mainMenuKeyboard());
      }

      return;
    }

    if (state.step === "amount") {
      const amount = Number(text);
      if (!Number.isFinite(amount) || amount <= 0) {
        await ctx.reply("Enter a valid positive number.");
        return;
      }

      ctx.session.addEntry.amount = amount;
      ctx.session.addEntry.step = "category";
      await ctx.reply("Enter a category. Example: Food, Transport, Salary");
      return;
    }

    if (state.step === "category") {
      ctx.session.addEntry.category = text;
      ctx.session.addEntry.step = "note";
      await ctx.reply(
        "Enter a note, or press Skip Note.",
        Markup.inlineKeyboard([
          [Markup.button.callback("Skip Note", "add:note:skip")]
        ])
      );
      return;
    }

    if (state.step === "note") {
      ctx.session.addEntry.note = text;
      ctx.session.addEntry.step = "date";
      await ctx.reply("Choose a date for this entry:", addDateKeyboard());
      return;
    }

    if (state.step === "customDate") {
      const parsedDate = parseDateInput(text, user.timezone);
      if (!parsedDate) {
        await ctx.reply("Date format should be YYYY-MM-DD or today.");
        return;
      }

      createTransaction({
        user_id: user.id,
        type: state.type,
        amount: state.amount,
        category: state.category,
        note: state.note || "",
        transaction_date: compactDate(parsedDate)
      });

      resetAddFlow(ctx);
      await ctx.reply(`Saved for ${compactDate(parsedDate)}.`, mainMenuKeyboard());
    }
  });

  bot.catch((error, ctx) => {
    console.error("Bot error", error);
    ctx.reply("Something went wrong while processing that request.");
  });

  return bot;
}
