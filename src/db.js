import { Pool } from "pg";
import { config } from "./config.js";

const configuredUrl = config.databaseUrl;

function buildPgConnectionString(rawUrl) {
  const parsed = new URL(rawUrl);
  parsed.search = "";
  return parsed.toString();
}

if (!configuredUrl) {
  throw new Error("Missing DATABASE_URL in environment variables.");
}

export const db = new Pool({
  connectionString: buildPgConnectionString(configuredUrl),
  ssl: {
    rejectUnauthorized: false
  }
});

export async function query(text, params = []) {
  return db.query(text, params);
}

export async function initializeDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id TEXT NOT NULL UNIQUE,
      chat_id TEXT NOT NULL,
      first_name TEXT,
      username TEXT,
      timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
      currency TEXT NOT NULL DEFAULT 'UZS',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'debt')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DELETED')),
      amount DOUBLE PRECISION NOT NULL,
      transaction_currency TEXT,
      category TEXT NOT NULL,
      note TEXT,
      transaction_date TEXT NOT NULL,
      transaction_time TEXT NOT NULL DEFAULT '12:00',
      deleted_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user_date
      ON transactions(user_id, transaction_date);
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'UZS';
  `);

  await query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS transaction_time TEXT NOT NULL DEFAULT '12:00';
  `);

  await query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS transaction_currency TEXT;
  `);

  await query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
  `);

  await query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await query(`
    UPDATE transactions
    SET status = 'ACTIVE'
    WHERE status IS NULL OR TRIM(status) = '';
  `);

  await query(`
    UPDATE transactions
    SET transaction_currency = users.currency
    FROM users
    WHERE users.id = transactions.user_id
      AND transactions.transaction_currency IS NULL;
  `);
}
