import { db } from "../db.js";

const findByTelegramIdStmt = db.prepare(`
  SELECT *
  FROM users
  WHERE telegram_id = ?
`);

const findByIdStmt = db.prepare(`
  SELECT *
  FROM users
  WHERE id = ?
`);

const upsertStmt = db.prepare(`
  INSERT INTO users (telegram_id, chat_id, first_name, username, timezone, updated_at)
  VALUES (@telegram_id, @chat_id, @first_name, @username, @timezone, CURRENT_TIMESTAMP)
  ON CONFLICT(telegram_id)
  DO UPDATE SET
    chat_id = excluded.chat_id,
    first_name = excluded.first_name,
    username = excluded.username,
    timezone = excluded.timezone,
    updated_at = CURRENT_TIMESTAMP
`);

export function upsertUserFromTelegram(from, chatId, timezone) {
  upsertStmt.run({
    telegram_id: String(from.id),
    chat_id: String(chatId),
    first_name: from.first_name || "",
    username: from.username || "",
    timezone
  });

  return findByTelegramIdStmt.get(String(from.id));
}

export function getUserByTelegramId(telegramId) {
  return findByTelegramIdStmt.get(String(telegramId));
}

export function getUserById(id) {
  return findByIdStmt.get(id);
}

export function ensureWebUser({ telegramId, firstName, username, timezone }) {
  upsertStmt.run({
    telegram_id: String(telegramId),
    chat_id: String(telegramId),
    first_name: firstName || "",
    username: username || "",
    timezone
  });

  return findByTelegramIdStmt.get(String(telegramId));
}

export function getAllUsers() {
  return db.prepare("SELECT * FROM users").all();
}
