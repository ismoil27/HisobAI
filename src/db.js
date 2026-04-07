import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

const defaultDbPath = path.join(process.cwd(), "data", "hisob.db");
const dbPath = config.dbPath ? path.resolve(process.cwd(), config.dbPath) : defaultDbPath;
const dataDir = path.dirname(dbPath);

fs.mkdirSync(dataDir, { recursive: true });
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL UNIQUE,
    chat_id TEXT NOT NULL,
    first_name TEXT,
    username TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
    currency TEXT NOT NULL DEFAULT 'UZS',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
    amount REAL NOT NULL,
    transaction_currency TEXT,
    category TEXT NOT NULL,
    note TEXT,
    transaction_date TEXT NOT NULL,
    transaction_time TEXT NOT NULL DEFAULT '12:00',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_user_date
    ON transactions(user_id, transaction_date);
`);

const transactionSchema = db
  .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'transactions'")
  .get();

if (transactionSchema?.sql && !transactionSchema.sql.includes("'debt'")) {
  db.exec(`
    ALTER TABLE transactions RENAME TO transactions_old;

    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'debt')),
      amount REAL NOT NULL,
      transaction_currency TEXT,
      category TEXT NOT NULL,
      note TEXT,
      transaction_date TEXT NOT NULL,
      transaction_time TEXT NOT NULL DEFAULT '12:00',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    INSERT INTO transactions (id, user_id, type, amount, transaction_currency, category, note, transaction_date, transaction_time, created_at)
    SELECT id, user_id, type, amount, NULL, category, note, transaction_date, '12:00', created_at
    FROM transactions_old;

    DROP TABLE transactions_old;

    CREATE INDEX IF NOT EXISTS idx_transactions_user_date
      ON transactions(user_id, transaction_date);
  `);
}

const transactionTimeColumn = db
  .prepare("PRAGMA table_info(transactions)")
  .all()
  .find((column) => column.name === "transaction_time");

if (!transactionTimeColumn) {
  try {
    db.exec(`
      ALTER TABLE transactions ADD COLUMN transaction_time TEXT NOT NULL DEFAULT '12:00';
    `);
  } catch (error) {
    if (!String(error.message || error).includes("duplicate column name")) {
      throw error;
    }
  }
}

const transactionCurrencyColumn = db
  .prepare("PRAGMA table_info(transactions)")
  .all()
  .find((column) => column.name === "transaction_currency");

if (!transactionCurrencyColumn) {
  try {
    db.exec(`
      ALTER TABLE transactions ADD COLUMN transaction_currency TEXT;
    `);
    db.exec(`
      UPDATE transactions
      SET transaction_currency = (
        SELECT currency
        FROM users
        WHERE users.id = transactions.user_id
      )
      WHERE transaction_currency IS NULL;
    `);
  } catch (error) {
    if (!String(error.message || error).includes("duplicate column name")) {
      throw error;
    }
  }
}

const userCurrencyColumn = db
  .prepare("PRAGMA table_info(users)")
  .all()
  .find((column) => column.name === "currency");

if (!userCurrencyColumn) {
  try {
    db.exec(`
      ALTER TABLE users ADD COLUMN currency TEXT NOT NULL DEFAULT 'UZS';
    `);
  } catch (error) {
    if (!String(error.message || error).includes("duplicate column name")) {
      throw error;
    }
  }
}
