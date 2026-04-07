import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek.js";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(isoWeek);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export { dayjs };

export function parseDateInput(input, fallbackTimezone) {
  const raw = input.trim();
  if (raw.toLowerCase() === "today") {
    return dayjs().tz(fallbackTimezone).startOf("day");
  }

  const parsed = dayjs.tz(raw, "YYYY-MM-DD", fallbackTimezone);
  if (!parsed.isValid()) {
    return null;
  }

  return parsed.startOf("day");
}

export function monthBounds(targetMonth, timezoneName) {
  const month = targetMonth.tz(timezoneName).startOf("month");
  return {
    label: month.format("MMMM YYYY"),
    start: month.startOf("month"),
    end: month.endOf("month")
  };
}

export function summaryBounds(kind, timezoneName) {
  const now = dayjs().tz(timezoneName);

  if (kind === "week") {
    const currentStart = now.startOf("isoWeek");
    const currentEnd = now.endOf("isoWeek");
    const previousStart = currentStart.subtract(1, "week");
    const previousEnd = currentEnd.subtract(1, "week");

    return {
      current: { label: `${currentStart.format("D MMM")} - ${currentEnd.format("D MMM YYYY")}`, start: currentStart, end: currentEnd },
      previous: { label: `${previousStart.format("D MMM")} - ${previousEnd.format("D MMM YYYY")}`, start: previousStart, end: previousEnd }
    };
  }

  const currentStart = now.startOf("month");
  const currentEnd = now.endOf("month");
  const previousMonth = currentStart.subtract(1, "month");
  const previousStart = previousMonth.startOf("month");
  const previousEnd = previousMonth.endOf("month");

  return {
    current: { label: currentStart.format("MMMM YYYY"), start: currentStart, end: currentEnd },
    previous: { label: previousStart.format("MMMM YYYY"), start: previousStart, end: previousEnd }
  };
}
