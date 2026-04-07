import { config } from "../config.js";
import {
  ensureWebUser,
  getAllUsers,
  getUserById,
  getUserByTelegramId
} from "../repositories/userRepository.js";
import {
  createTransaction,
  deleteTransaction,
  getDailyTotals,
  getLatestTransactionsByUser,
  getMonthActivity,
  getTransactionById,
  getTransactionsByDate,
  updateTransaction
} from "../repositories/transactionRepository.js";
import { getSummaryData } from "./summaryService.js";
import { compactDate, formatMoney } from "../utils/format.js";
import { dayjs, monthBounds, parseDateInput } from "../utils/dates.js";

export function isAdminUsername(username) {
  return Boolean(username && username.toLowerCase() === config.adminTelegramUsername);
}

export function resolveDashboardUser({ userId, telegramUserId, firstName, username }) {
  if (telegramUserId) {
    const existing = getUserByTelegramId(telegramUserId);
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
    const byId = getUserById(Number(userId));
    if (byId) {
      return byId;
    }
  }

  const allUsers = getAllUsers();
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

export function buildDashboardViewModel({
  user,
  monthText,
  selectedDate,
  flashMessage,
  editEntryId,
  telegramUserId,
  telegramName,
  telegramUsername
}) {
  const now = dayjs().tz(user.timezone);
  const normalizedMonth = monthText || now.format("YYYY-MM");
  const month = dayjs.tz(normalizedMonth, "YYYY-MM", user.timezone).startOf("month");
  const monthData = monthBounds(month, user.timezone);
  const activeDate = parseDateInput(selectedDate || compactDate(now), user.timezone) || now.startOf("day");
  const activity = getMonthActivity(user.id, compactDate(monthData.start), compactDate(monthData.end));
  const entries = getTransactionsByDate(user.id, compactDate(activeDate));
  const dailyTotals = getDailyTotals(user.id, compactDate(activeDate));
  const monthSummary = getSummaryData(user.id, "month", user.timezone);
  const editEntry = editEntryId ? getTransactionById(Number(editEntryId), user.id) : null;

  const activityMap = new Map(activity.map((item) => [item.transaction_date, item]));
  const firstWeekday = Number(monthData.start.format("d"));
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
      hasDebt: Number(totals?.debt_total || 0) > 0
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

  return {
    flashMessage,
    user,
    currentMonth: normalizedMonth,
    previousMonth: month.subtract(1, "month").format("YYYY-MM"),
    nextMonth: month.add(1, "month").format("YYYY-MM"),
    monthLabel: monthData.label,
    selectedDate: compactDate(activeDate),
    calendarWeeks: weeks,
    entries,
    dailyTotals,
    monthSummary,
    editEntry,
    isAdmin: isAdminUsername(telegramUsername || user.username),
    telegramUserId: telegramUserId || user.telegram_id,
    telegramName: telegramName || user.first_name || "My Account",
    telegramUsername: telegramUsername || user.username || "",
    formatMoney
  };
}

export function buildAdminViewModel({ viewerUsername, selectedUserId }) {
  const users = getAllUsers();
  const selectedUser =
    users.find((user) => user.id === Number(selectedUserId)) ||
    users[0] ||
    null;

  const userCards = users.map((user) => {
    const monthSummary = getSummaryData(user.id, "month", user.timezone);
    const latestEntries = getLatestTransactionsByUser(user.id, 8);
    return {
      ...user,
      monthSummary,
      latestEntries
    };
  });

  let selectedDetail = null;
  if (selectedUser) {
    selectedDetail = userCards.find((item) => item.id === selectedUser.id) || null;
  }

  return {
    isAdmin: isAdminUsername(viewerUsername),
    viewerUsername,
    users: userCards,
    selectedUser: selectedDetail,
    formatMoney
  };
}

export function saveDashboardTransaction({ user, entryId, type, amount, category, note, transactionDate }) {
  const parsedDate = parseDateInput(transactionDate, user.timezone);
  const numericAmount = Number(amount);

  if (!["expense", "income", "debt"].includes(type)) {
    return { ok: false, message: "Type must be expense, income, or debt." };
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { ok: false, message: "Amount must be a positive number." };
  }

  if (!category || !category.trim()) {
    return { ok: false, message: "Category is required." };
  }

  if (!parsedDate) {
    return { ok: false, message: "Date must be in YYYY-MM-DD format." };
  }

  const payload = {
    user_id: user.id,
    type,
    amount: numericAmount,
    category: category.trim(),
    note: note?.trim() || "",
    transaction_date: compactDate(parsedDate)
  };

  if (entryId) {
    updateTransaction({
      id: Number(entryId),
      ...payload
    });
    return {
      ok: true,
      message: "Entry updated.",
      transactionDate: compactDate(parsedDate)
    };
  }

  createTransaction(payload);
  return {
    ok: true,
    message: `${type === "expense" ? "Expense" : type === "income" ? "Income" : "Qarz"} saved.`,
    transactionDate: compactDate(parsedDate)
  };
}

export function removeDashboardTransaction({ user, entryId }) {
  deleteTransaction(Number(entryId), user.id);
  return {
    ok: true,
    message: "Entry deleted."
  };
}
