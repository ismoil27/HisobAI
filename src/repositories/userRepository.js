import { query } from "../db.js";

export async function getUserByTelegramId(telegramId) {
  const result = await query(
    `
      SELECT *
      FROM users
      WHERE telegram_id = $1
      LIMIT 1
    `,
    [String(telegramId)]
  );

  return result.rows[0] || null;
}

export async function getUserById(id) {
  const result = await query(
    `
      SELECT *
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [Number(id)]
  );

  return result.rows[0] || null;
}

export async function upsertUserFromTelegram(from, chatId, timezone) {
  const result = await query(
    `
      INSERT INTO users (telegram_id, chat_id, first_name, username, timezone, currency, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (telegram_id)
      DO UPDATE SET
        chat_id = EXCLUDED.chat_id,
        first_name = EXCLUDED.first_name,
        username = EXCLUDED.username,
        timezone = EXCLUDED.timezone,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [String(from.id), String(chatId), from.first_name || "", from.username || "", timezone, "UZS"]
  );

  return result.rows[0] || null;
}

export async function ensureWebUser({ telegramId, firstName, username, timezone, currency = "UZS" }) {
  const result = await query(
    `
      INSERT INTO users (telegram_id, chat_id, first_name, username, timezone, currency, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (telegram_id)
      DO UPDATE SET
        chat_id = EXCLUDED.chat_id,
        first_name = EXCLUDED.first_name,
        username = EXCLUDED.username,
        timezone = EXCLUDED.timezone,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [String(telegramId), String(telegramId), firstName || "", username || "", timezone, currency]
  );

  return result.rows[0] || null;
}

export async function getAllUsers() {
  const result = await query("SELECT * FROM users ORDER BY id ASC");
  return result.rows;
}

export async function updateUserCurrency(userId, currency) {
  const result = await query(
    `
      UPDATE users
      SET currency = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `,
    [currency, Number(userId)]
  );

  return result.rows[0] || null;
}
