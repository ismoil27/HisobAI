import { db } from "../db.js";

const insertStmt = db.prepare(`
  INSERT INTO transactions (user_id, type, amount, category, note, transaction_date, transaction_time)
  VALUES (@user_id, @type, @amount, @category, @note, @transaction_date, @transaction_time)
`);

const updateStmt = db.prepare(`
  UPDATE transactions
  SET type = @type,
      amount = @amount,
      category = @category,
      note = @note,
      transaction_date = @transaction_date,
      transaction_time = @transaction_time
  WHERE id = @id AND user_id = @user_id
`);

const deleteStmt = db.prepare(`
  DELETE FROM transactions
  WHERE id = ? AND user_id = ?
`);

const byIdStmt = db.prepare(`
  SELECT *
  FROM transactions
  WHERE id = ? AND user_id = ?
`);

const latestByUserStmt = db.prepare(`
  SELECT *
  FROM transactions
  WHERE user_id = ?
  ORDER BY transaction_date DESC, transaction_time DESC, id DESC
  LIMIT ?
`);

const byDateStmt = db.prepare(`
  SELECT *
  FROM transactions
  WHERE user_id = ? AND transaction_date = ?
  ORDER BY transaction_time ASC, id ASC
`);

const monthStmt = db.prepare(`
  SELECT
    transaction_date,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense_total,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income_total,
    SUM(CASE WHEN type = 'debt' THEN amount ELSE 0 END) AS debt_total
  FROM transactions
  WHERE user_id = ?
    AND transaction_date BETWEEN ? AND ?
  GROUP BY transaction_date
  ORDER BY transaction_date ASC
`);

const rangeStmt = db.prepare(`
  SELECT *
  FROM transactions
  WHERE user_id = ?
    AND transaction_date BETWEEN ? AND ?
  ORDER BY transaction_date ASC, transaction_time ASC, id ASC
`);

const totalsByDateStmt = db.prepare(`
  SELECT
    transaction_date,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense_total,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income_total,
    SUM(CASE WHEN type = 'debt' THEN amount ELSE 0 END) AS debt_total
  FROM transactions
  WHERE user_id = ?
    AND transaction_date = ?
  GROUP BY transaction_date
`);

const categoryHistoryStmt = db.prepare(`
  SELECT
    type,
    category,
    COUNT(*) AS usage_count,
    MAX(transaction_date || ' ' || transaction_time) AS last_used_at
  FROM transactions
  WHERE user_id = ?
    AND TRIM(COALESCE(category, '')) <> ''
  GROUP BY type, category
  ORDER BY last_used_at DESC, usage_count DESC, category COLLATE NOCASE ASC
`);

export function createTransaction(payload) {
  return insertStmt.run(payload);
}

export function updateTransaction(payload) {
  return updateStmt.run(payload);
}

export function deleteTransaction(id, userId) {
  return deleteStmt.run(id, userId);
}

export function getTransactionById(id, userId) {
  return byIdStmt.get(id, userId);
}

export function getLatestTransactionsByUser(userId, limit = 20) {
  return latestByUserStmt.all(userId, limit);
}

export function getTransactionsByDate(userId, date) {
  return byDateStmt.all(userId, date);
}

export function getTransactionsForRange(userId, startDate, endDate) {
  return rangeStmt.all(userId, startDate, endDate);
}

export function getMonthActivity(userId, startDate, endDate) {
  return monthStmt.all(userId, startDate, endDate);
}

export function getDailyTotals(userId, date) {
  return totalsByDateStmt.get(userId, date) || {
    transaction_date: date,
    expense_total: 0,
    income_total: 0,
    debt_total: 0
  };
}

export function getCategoryHistoryByUser(userId, limitPerType = 12) {
  const rows = categoryHistoryStmt.all(userId);
  const grouped = {
    expense: [],
    income: [],
    debt: []
  };

  for (const row of rows) {
    if (!grouped[row.type]) {
      continue;
    }

    if (grouped[row.type].length >= limitPerType) {
      continue;
    }

    grouped[row.type].push({
      category: row.category,
      usageCount: Number(row.usage_count || 0),
      lastUsedAt: row.last_used_at
    });
  }

  return grouped;
}
