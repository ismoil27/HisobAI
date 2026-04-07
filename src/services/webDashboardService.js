import { config } from "../config.js";
import {
  ensureWebUser,
  getAllUsers,
  getUserById,
  getUserByTelegramId,
  updateUserCurrency
} from "../repositories/userRepository.js";
import {
  createTransaction,
  deleteTransaction,
  getCategoryHistoryByUser,
  getDailyTotals,
  getLatestTransactionsByUser,
  getMonthActivity,
  getTransactionById,
  getTransactionsByDate,
  updateTransaction
} from "../repositories/transactionRepository.js";
import { getSummaryData } from "./summaryService.js";
import { convertTransactionsTotal } from "./exchangeRateService.js";
import { compactDate, compactTime, formatMoney } from "../utils/format.js";
import { dayjs, getUzbekMonthLabel, getUzbekWeekdays, monthBounds, parseDateInput } from "../utils/dates.js";

export function isAdminUsername(username) {
  return Boolean(username && username.toLowerCase() === config.adminTelegramUsername);
}

export async function resolveDashboardUser({ userId, telegramUserId, firstName, username }) {
  if (telegramUserId) {
    const existing = await getUserByTelegramId(telegramUserId);
    if (existing) {
      return existing;
    }

    return ensureWebUser({
      telegramId: telegramUserId,
      firstName: firstName || config.webDefaultName,
      username: username || "",
      timezone: config.defaultTimezone
    });
  }

  if (userId) {
    const byId = await getUserById(Number(userId));
    if (byId) {
      return byId;
    }
  }

  const allUsers = await getAllUsers();
  if (allUsers.length > 0) {
    return allUsers[0];
  }

  return ensureWebUser({
    telegramId: config.webDefaultTelegramId,
    firstName: config.webDefaultName,
    username: "",
    timezone: config.defaultTimezone
  });
}

function buildDraftEntry({ editEntry, draftType, draftAmount, draftCategory, draftNote, defaultTime, selectedDate }) {
  return {
    type: draftType || editEntry?.type || "expense",
    amount: draftAmount || editEntry?.amount || "",
    category: draftCategory || editEntry?.category || "",
    note: draftNote || editEntry?.note || "",
    transactionDate: editEntry?.transaction_date || selectedDate,
    transactionTime: editEntry?.transaction_time || defaultTime
  };
}

export async function buildDashboardViewModel({
  user,
  monthText,
  selectedDate,
  flashMessage,
  editEntryId,
  viewMode,
  telegramUserId,
  telegramName,
  telegramUsername,
  draftType,
  draftAmount,
  draftCategory,
  draftNote
}) {
  const now = dayjs().tz(user.timezone);
  const activeDate = parseDateInput(selectedDate || compactDate(now), user.timezone) || now.startOf("day");
  const month = dayjs.tz(monthText || activeDate.format("YYYY-MM"), "YYYY-MM", user.timezone).startOf("month");
  const monthData = monthBounds(month, user.timezone);
  const activity = await getMonthActivity(user.id, compactDate(monthData.start), compactDate(monthData.end));
  const entries = await getTransactionsByDate(user.id, compactDate(activeDate));
  const todayEntries = await getTransactionsByDate(user.id, compactDate(now));
  const todayTotals = await getDailyTotals(user.id, compactDate(now));
  const monthSummary = await getSummaryData(user.id, "month", user.timezone, user.currency || "UZS");
  const editEntry = editEntryId ? await getTransactionById(Number(editEntryId), user.id) : null;
  const categoryHistory = await getCategoryHistoryByUser(user.id);
  const activityMap = new Map(activity.map((item) => [item.transaction_date, item]));
  const defaultTime = compactTime(now);

  const firstWeekday = (Number(monthData.start.format("d")) + 6) % 7;
  const daysInMonth = monthData.end.date();
  const weeks = [];
  let row = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    row.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = monthData.start.date(day);
    const isoDate = compactDate(date);
    const totals = activityMap.get(isoDate);
    row.push({
      isoDate,
      dayNumber: day,
      isSelected: isoDate === compactDate(activeDate),
      isToday: isoDate === compactDate(now),
      hasExpense: Number(totals?.expense_total || 0) > 0,
      hasIncome: Number(totals?.income_total || 0) > 0,
      hasDebt: Number(totals?.debt_total || 0) > 0,
      expenseTotal: Number(totals?.expense_total || 0)
    });

    if (row.length === 7) {
      weeks.push(row);
      row = [];
    }
  }

  if (row.length > 0) {
    while (row.length < 7) {
      row.push(null);
    }
    weeks.push(row);
  }

  let convertedTodayExpense = Number(todayTotals.expense_total || 0);
  try {
    convertedTodayExpense = await convertTransactionsTotal(
      todayEntries,
      user.currency || "UZS",
      (item) => item.type === "expense"
    );
  } catch (_error) {
    convertedTodayExpense = Number(todayTotals.expense_total || 0);
  }

  return {
    viewMode: viewMode === "month" ? "month" : "today",
    flashMessage,
    user,
    currentMonth: month.format("YYYY-MM"),
    previousMonth: month.subtract(1, "month").format("YYYY-MM"),
    nextMonth: month.add(1, "month").format("YYYY-MM"),
    monthLabel: getUzbekMonthLabel(month),
    selectedDate: compactDate(activeDate),
    selectedDateLabel: `${activeDate.format("D")} ${getUzbekMonthLabel(activeDate)}`,
    currentTimeLabel: now.format("HH:mm"),
    calendarWeeks: weeks,
    weekdayLabels: getUzbekWeekdays(),
    entries,
    todayTotals: {
      expense: convertedTodayExpense,
      income: Number(todayTotals.income_total || 0),
      debt: Number(todayTotals.debt_total || 0)
    },
    monthSummary,
    editEntry,
    draftEntry: buildDraftEntry({
      editEntry,
      draftType,
      draftAmount,
      draftCategory,
      draftNote,
      defaultTime,
      selectedDate: compactDate(activeDate)
    }),
    categoryHistory,
    isAdmin: isAdminUsername(telegramUsername || user.username),
    telegramUserId: telegramUserId || user.telegram_id,
    telegramName: telegramName || user.first_name || "Mening hisobim",
    telegramUsername: telegramUsername || user.username || "",
    todayDate: compactDate(now),
    defaultTime,
    currencies: ["UZS", "USD", "KRW", "RUB", "EUR"],
    formatMoney: (amount) => formatMoney(amount, user.currency || "UZS")
  };
}

export async function buildAdminViewModel({ viewerUsername, selectedUserId }) {
  const users = await getAllUsers();
  const selectedUser =
    users.find((user) => user.id === Number(selectedUserId)) ||
    users[0] ||
    null;

  const userCards = await Promise.all(users.map(async (user) => {
    const monthSummary = await getSummaryData(user.id, "month", user.timezone, user.currency || "UZS");
    const latestEntries = await getLatestTransactionsByUser(user.id, 8);
    return {
      ...user,
      monthSummary,
      latestEntries
    };
  }));

  let selectedDetail = null;
  if (selectedUser) {
    selectedDetail = userCards.find((item) => item.id === selectedUser.id) || null;
  }

  return {
    isAdmin: isAdminUsername(viewerUsername),
    viewerUsername,
    users: userCards,
    selectedUser: selectedDetail,
    formatMoney: (amount, currency = "UZS") => formatMoney(amount, currency)
  };
}

export async function saveDashboardTransaction({ user, entryId, type, amount, category, note, transactionDate, transactionTime }) {
  const parsedDate = parseDateInput(transactionDate, user.timezone);
  const numericAmount = Number(amount);
  const fallbackTime = compactTime(dayjs().tz(user.timezone));
  const timeValue = String(transactionTime || fallbackTime).trim();

  if (!["expense", "income", "debt"].includes(type)) {
    return { ok: false, message: "Turi noto'g'ri." };
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { ok: false, message: "Miqdor musbat son bo'lishi kerak." };
  }

  if (!category || !category.trim()) {
    return { ok: false, message: "Toifa kiritilishi shart." };
  }

  if (!parsedDate) {
    return { ok: false, message: "Sana YYYY-MM-DD formatida bo'lishi kerak." };
  }

  if (!/^\d{2}:\d{2}$/.test(timeValue)) {
    return { ok: false, message: "Vaqt HH:MM formatida bo'lishi kerak." };
  }

  const payload = {
    user_id: user.id,
    type,
    amount: numericAmount,
    transaction_currency: user.currency || "UZS",
    category: category.trim(),
    note: note?.trim() || "",
    transaction_date: compactDate(parsedDate),
    transaction_time: timeValue
  };

  if (entryId) {
    await updateTransaction({
      id: Number(entryId),
      ...payload
    });
    return {
      ok: true,
      message: "Yozuv yangilandi.",
      transactionDate: compactDate(parsedDate)
    };
  }

  await createTransaction(payload);
  return {
    ok: true,
    message: "Yozuv saqlandi.",
    transactionDate: compactDate(parsedDate)
  };
}

export async function saveDashboardCurrency({ user, currency }) {
  const normalized = String(currency || "").toUpperCase();
  const allowed = new Set(["UZS", "USD", "KRW", "RUB", "EUR"]);

  if (!allowed.has(normalized)) {
    return { ok: false, message: "Valyuta noto'g'ri." };
  }

  await updateUserCurrency(user.id, normalized);
  return {
    ok: true,
    message: "Valyuta saqlandi."
  };
}

export async function removeDashboardTransaction({ user, entryId }) {
  await deleteTransaction(Number(entryId), user.id);
  return {
    ok: true,
    message: "Yozuv o'chirildi."
  };
}
