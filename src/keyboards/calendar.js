import { Markup } from "telegraf";
import { dayjs, monthBounds } from "../utils/dates.js";

function markerForDay(activity) {
  const hasExpense = Number(activity?.expense_total || 0) > 0;
  const hasIncome = Number(activity?.income_total || 0) > 0;

  if (hasExpense && hasIncome) {
    return "🔴🟢";
  }
  if (hasExpense) {
    return "🔴";
  }
  if (hasIncome) {
    return "🟢";
  }
  return "";
}

export function buildCalendarKeyboard(monthText, timezoneName, activityRows) {
  const targetMonth = dayjs.tz(monthText, "YYYY-MM", timezoneName).startOf("month");
  const bounds = monthBounds(targetMonth, timezoneName);
  const firstWeekday = (Number(bounds.start.format("d")) + 6) % 7;
  const daysInMonth = bounds.end.date();
  const activityMap = new Map(activityRows.map((row) => [row.transaction_date, row]));
  const rows = [];
  const headers = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"].map((label) => Markup.button.callback(label, "noop"));

  rows.push(headers);

  let currentRow = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    currentRow.push(Markup.button.callback("·", "noop"));
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = bounds.start.date(day).format("YYYY-MM-DD");
    const marker = markerForDay(activityMap.get(date));
    currentRow.push(Markup.button.callback(`${day}${marker}`, `calendar:day:${date}:${monthText}`));

    if (currentRow.length === 7) {
      rows.push(currentRow);
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    while (currentRow.length < 7) {
      currentRow.push(Markup.button.callback("·", "noop"));
    }
    rows.push(currentRow);
  }

  rows.push([
    Markup.button.callback("<", `calendar:month:${targetMonth.subtract(1, "month").format("YYYY-MM")}`),
    Markup.button.callback(bounds.label, "noop"),
    Markup.button.callback(">", `calendar:month:${targetMonth.add(1, "month").format("YYYY-MM")}`)
  ]);

  rows.push([Markup.button.callback("Menyuga qaytish", "menu:home")]);

  return Markup.inlineKeyboard(rows);
}
