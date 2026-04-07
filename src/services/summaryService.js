import { getTransactionsForRange } from "../repositories/transactionRepository.js";
import { formatMoney } from "../utils/format.js";
import { compactDate } from "../utils/format.js";
import { summaryBounds } from "../utils/dates.js";

export function aggregateTransactions(transactions) {
  const totals = {
    expense: 0,
    income: 0,
    debt: 0,
    categories: new Map()
  };

  for (const item of transactions) {
    if (item.type === "expense") {
      totals.expense += Number(item.amount);
    } else if (item.type === "debt") {
      totals.debt += Number(item.amount);
    } else {
      totals.income += Number(item.amount);
    }

    const current = totals.categories.get(item.category) || 0;
    totals.categories.set(item.category, current + Number(item.amount));
  }

  return totals;
}

export function buildComparisonText(currentExpense, previousExpense, currentLabel, previousLabel) {
  if (previousExpense === 0 && currentExpense === 0) {
    return "";
  }

  if (previousExpense === 0) {
    return "";
  }

  const diff = currentExpense - previousExpense;
  const percent = Math.abs((diff / previousExpense) * 100).toFixed(1);

  if (diff === 0) {
    return `${currentLabel} oyida xarajat ${previousLabel} oyiga teng bo'ldi.`;
  }

  if (diff < 0) {
    return `${currentLabel} oyida ${previousLabel} oyiga nisbatan ${percent}% kam xarajat qildingiz.`;
  }

  return `${currentLabel} oyida ${previousLabel} oyiga nisbatan ${percent}% ko'p xarajat qildingiz.`;
}

export function topCategories(categoryMap) {
  return [...categoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => `${category}: ${formatMoney(amount)}`);
}

export function getSummaryData(userId, kind, timezoneName) {
  const bounds = summaryBounds(kind, timezoneName);
  const currentTransactions = getTransactionsForRange(
    userId,
    compactDate(bounds.current.start),
    compactDate(bounds.current.end)
  );
  const previousTransactions = getTransactionsForRange(
    userId,
    compactDate(bounds.previous.start),
    compactDate(bounds.previous.end)
  );

  const current = aggregateTransactions(currentTransactions);
  const previous = aggregateTransactions(previousTransactions);
  const comparison = buildComparisonText(
    current.expense,
    previous.expense,
    bounds.current.label,
    bounds.previous.label
  );
  const categories = topCategories(current.categories);

  return {
    bounds,
    current,
    previous,
    comparison,
    categories
  };
}

export function buildSummaryMessage(userId, kind, timezoneName) {
  const { bounds, current, comparison, categories } = getSummaryData(userId, kind, timezoneName);

  const lines = [
    `${bounds.current.label} bo'yicha hisobot`,
    ``,
    `Xarajat: ${formatMoney(current.expense)}`,
    `Tushum: ${formatMoney(current.income)}`,
    `Qarz: ${formatMoney(current.debt)}`,
    `Balans: ${formatMoney(current.income - current.expense - current.debt)}`
  ];

  if (comparison) {
    lines.push("", comparison);
  }

  if (categories.length > 0) {
    lines.push("", "Asosiy toifalar:");
    for (const line of categories) {
      lines.push(`- ${line}`);
    }
  }

  return lines.join("\n");
}
