import { query } from "../db.js";

export async function createTransaction(payload) {
  const result = await query(
    `
      INSERT INTO transactions (user_id, type, amount, transaction_currency, category, note, transaction_date, transaction_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      Number(payload.user_id),
      payload.type,
      Number(payload.amount),
      payload.transaction_currency || null,
      payload.category,
      payload.note || "",
      payload.transaction_date,
      payload.transaction_time
    ]
  );

  return result.rows[0] || null;
}

export async function updateTransaction(payload) {
  const result = await query(
    `
      UPDATE transactions
      SET type = $1,
          amount = $2,
          transaction_currency = $3,
          category = $4,
          note = $5,
          transaction_date = $6,
          transaction_time = $7
      WHERE id = $8 AND user_id = $9
      RETURNING *
    `,
    [
      payload.type,
      Number(payload.amount),
      payload.transaction_currency || null,
      payload.category,
      payload.note || "",
      payload.transaction_date,
      payload.transaction_time,
      Number(payload.id),
      Number(payload.user_id)
    ]
  );

  return result.rows[0] || null;
}

export async function deleteTransaction(id, userId) {
  const result = await query(
    `
      DELETE FROM transactions
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `,
    [Number(id), Number(userId)]
  );

  return result.rows[0] || null;
}

export async function getTransactionById(id, userId) {
  const result = await query(
    `
      SELECT *
      FROM transactions
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [Number(id), Number(userId)]
  );

  return result.rows[0] || null;
}

export async function getLatestTransactionsByUser(userId, limit = 20) {
  const result = await query(
    `
      SELECT *
      FROM transactions
      WHERE user_id = $1
      ORDER BY transaction_date DESC, transaction_time DESC, id DESC
      LIMIT $2
    `,
    [Number(userId), Number(limit)]
  );

  return result.rows;
}

export async function getTransactionsByDate(userId, date) {
  const result = await query(
    `
      SELECT *
      FROM transactions
      WHERE user_id = $1 AND transaction_date = $2
      ORDER BY transaction_time ASC, id ASC
    `,
    [Number(userId), date]
  );

  return result.rows;
}

export async function getTransactionsForRange(userId, startDate, endDate) {
  const result = await query(
    `
      SELECT *
      FROM transactions
      WHERE user_id = $1
        AND transaction_date BETWEEN $2 AND $3
      ORDER BY transaction_date ASC, transaction_time ASC, id ASC
    `,
    [Number(userId), startDate, endDate]
  );

  return result.rows;
}

export async function getMonthActivity(userId, startDate, endDate) {
  const result = await query(
    `
      SELECT
        transaction_date,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense_total,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income_total,
        SUM(CASE WHEN type = 'debt' THEN amount ELSE 0 END) AS debt_total
      FROM transactions
      WHERE user_id = $1
        AND transaction_date BETWEEN $2 AND $3
      GROUP BY transaction_date
      ORDER BY transaction_date ASC
    `,
    [Number(userId), startDate, endDate]
  );

  return result.rows;
}

export async function getDailyTotals(userId, date) {
  const result = await query(
    `
      SELECT
        transaction_date,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense_total,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income_total,
        SUM(CASE WHEN type = 'debt' THEN amount ELSE 0 END) AS debt_total
      FROM transactions
      WHERE user_id = $1
        AND transaction_date = $2
      GROUP BY transaction_date
    `,
    [Number(userId), date]
  );

  return (
    result.rows[0] || {
      transaction_date: date,
      expense_total: 0,
      income_total: 0,
      debt_total: 0
    }
  );
}

export async function getCategoryHistoryByUser(userId, limitPerType = 12) {
  const result = await query(
    `
      SELECT
        type,
        category,
        COUNT(*) AS usage_count,
        MAX(transaction_date || ' ' || transaction_time) AS last_used_at
      FROM transactions
      WHERE user_id = $1
        AND TRIM(COALESCE(category, '')) <> ''
      GROUP BY type, category
      ORDER BY last_used_at DESC, usage_count DESC, category ASC
    `,
    [Number(userId)]
  );

  const grouped = {
    expense: [],
    income: [],
    debt: []
  };

  for (const row of result.rows) {
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
