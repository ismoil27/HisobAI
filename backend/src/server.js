import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import {
  buildDashboardViewModel,
  buildAdminViewModel,
  removeDashboardTransaction,
  isAdminUsername,
  resolveDashboardUser,
  saveDashboardCurrency,
  saveDashboardTransaction
} from "./services/webDashboardService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "..", "..", "frontend", "dist");

function serializeDashboardViewModel(viewModel) {
  return {
    viewMode: viewModel.viewMode,
    flashMessage: viewModel.flashMessage,
    user: {
      id: viewModel.user.id,
      telegram_id: viewModel.user.telegram_id,
      first_name: viewModel.user.first_name,
      username: viewModel.user.username,
      timezone: viewModel.user.timezone,
      currency: viewModel.user.currency
    },
    currentMonth: viewModel.currentMonth,
    previousMonth: viewModel.previousMonth,
    nextMonth: viewModel.nextMonth,
    monthLabel: viewModel.monthLabel,
    selectedDate: viewModel.selectedDate,
    selectedDateLabel: viewModel.selectedDateLabel,
    currentTimeLabel: viewModel.currentTimeLabel,
    calendarWeeks: viewModel.calendarWeeks,
    weekdayLabels: viewModel.weekdayLabels,
    entries: viewModel.entries,
    todayTotals: viewModel.todayTotals,
    monthSummary: viewModel.monthSummary,
    editEntry: viewModel.editEntry,
    draftEntry: viewModel.draftEntry,
    categoryHistory: viewModel.categoryHistory,
    isAdmin: viewModel.isAdmin,
    telegramUserId: viewModel.telegramUserId,
    telegramName: viewModel.telegramName,
    telegramUsername: viewModel.telegramUsername,
    todayDate: viewModel.todayDate,
    defaultTime: viewModel.defaultTime,
    currencies: viewModel.currencies
  };
}

function serializeAdminViewModel(viewModel) {
  return {
    isAdmin: viewModel.isAdmin,
    viewerUsername: viewModel.viewerUsername,
    users: viewModel.users,
    selectedUser: viewModel.selectedUser
  };
}

async function getDashboardPayload(source) {
  const user = await resolveDashboardUser({
    userId: source.userId,
    telegramUserId: source.tgUserId,
    firstName: source.tgName,
    username: source.tgUsername
  });

  const viewModel = await buildDashboardViewModel({
    user,
    monthText: source.month,
    selectedDate: source.date,
    flashMessage: source.message || "",
    editEntryId: source.editId,
    viewMode: source.view,
    telegramUserId: source.tgUserId,
    telegramName: source.tgName,
    telegramUsername: source.tgUsername,
    draftType: source.type,
    draftAmount: source.amount,
    draftCategory: source.category,
    draftNote: source.note
  });

  return { user, viewModel };
}

export function createServer() {
  const app = express();

  app.set("port", config.port);
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/assets", express.static(path.join(__dirname, "..", "public")));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/dashboard", async (req, res, next) => {
    try {
      const { viewModel } = await getDashboardPayload(req.query);
      res.json(serializeDashboardViewModel(viewModel));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin", async (req, res, next) => {
    try {
      const username = req.query.tgUsername || "";
      if (!isAdminUsername(username)) {
        res.status(403).json({ ok: false, message: "Forbidden" });
        return;
      }

      const viewModel = await buildAdminViewModel({
        viewerUsername: username,
        selectedUserId: req.query.userId
      });

      res.json(serializeAdminViewModel(viewModel));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/entries", async (req, res, next) => {
    try {
      const { user } = await getDashboardPayload(req.body);
      const result = await saveDashboardTransaction({
        user,
        entryId: req.body.entryId,
        type: req.body.type,
        amount: req.body.amount,
        category: req.body.category,
        note: req.body.note,
        transactionDate: req.body.transactionDate,
        transactionTime: req.body.transactionTime
      });

      if (!result.ok) {
        res.status(422).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/entries/:id/delete", async (req, res, next) => {
    try {
      const { user } = await getDashboardPayload(req.body);
      const result = await removeDashboardTransaction({
        user,
        entryId: req.params.id
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/settings/currency", async (req, res, next) => {
    try {
      const { user } = await getDashboardPayload(req.body);
      const result = await saveDashboardCurrency({
        user,
        currency: req.body.currency
      });

      if (!result.ok) {
        res.status(422).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));

    app.get(/^(?!\/api\/).*/, (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }

      res.sendFile(path.join(frontendDistPath, "index.html"));
    });
  }

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Internal server error"
    });
  });

  return app;
}
