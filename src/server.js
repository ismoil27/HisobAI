import express from "express";
import path from "node:path";
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

export function createServer() {
  const app = express();

  app.set("port", config.port);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "views"));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/", (req, res) => {
    const user = resolveDashboardUser({
      userId: req.query.userId,
      telegramUserId: req.query.tgUserId,
      firstName: req.query.tgName,
      username: req.query.tgUsername
    });
    const viewModel = buildDashboardViewModel({
      user,
      monthText: req.query.month,
      selectedDate: req.query.date,
      flashMessage: req.query.message || "",
      editEntryId: req.query.editId,
      viewMode: req.query.view,
      telegramUserId: req.query.tgUserId,
      telegramName: req.query.tgName,
      telegramUsername: req.query.tgUsername
    });

    res.render("dashboard", viewModel);
  });

  app.get("/admin", (req, res) => {
    const username = req.query.tgUsername || "";
    if (!isAdminUsername(username)) {
      res.status(403).send("Forbidden");
      return;
    }

    const viewModel = buildAdminViewModel({
      viewerUsername: username,
      selectedUserId: req.query.userId
    });

    res.render("admin", viewModel);
  });

  app.post("/entries", (req, res) => {
    const user = resolveDashboardUser({
      userId: req.body.userId,
      telegramUserId: req.body.tgUserId,
      firstName: req.body.tgName,
      username: req.body.tgUsername
    });
    const result = saveDashboardTransaction({
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
      const viewModel = buildDashboardViewModel({
        user,
        monthText: req.body.month,
        selectedDate: req.body.transactionDate,
        flashMessage: result.message,
        editEntryId: req.body.entryId,
        viewMode: req.body.view,
        telegramUserId: req.body.tgUserId,
        telegramName: req.body.tgName,
        telegramUsername: req.body.tgUsername
      });
      res.status(422).render("dashboard", viewModel);
      return;
    }

    const params = new URLSearchParams({
      month: req.body.month,
      date: result.transactionDate,
      view: req.body.view || "today",
      message: result.message,
      tgUserId: req.body.tgUserId || "",
      tgName: req.body.tgName || "",
      tgUsername: req.body.tgUsername || ""
    });

    res.redirect(`/?${params.toString()}`);
  });

  app.post("/entries/:id/delete", (req, res) => {
    const user = resolveDashboardUser({
      userId: req.body.userId,
      telegramUserId: req.body.tgUserId,
      firstName: req.body.tgName,
      username: req.body.tgUsername
    });
    const result = removeDashboardTransaction({
      user,
      entryId: req.params.id
    });
    const params = new URLSearchParams({
      month: req.body.month,
      date: req.body.date,
      view: req.body.view || "today",
      message: result.message,
      tgUserId: req.body.tgUserId || "",
      tgName: req.body.tgName || "",
      tgUsername: req.body.tgUsername || ""
    });

    res.redirect(`/?${params.toString()}`);
  });

  app.post("/settings/currency", (req, res) => {
    const user = resolveDashboardUser({
      userId: req.body.userId,
      telegramUserId: req.body.tgUserId,
      firstName: req.body.tgName,
      username: req.body.tgUsername
    });

    const result = saveDashboardCurrency({
      user,
      currency: req.body.currency
    });

    const params = new URLSearchParams({
      month: req.body.month,
      date: req.body.date,
      view: req.body.view || "today",
      message: result.message,
      tgUserId: req.body.tgUserId || "",
      tgName: req.body.tgName || "",
      tgUsername: req.body.tgUsername || ""
    });

    res.redirect(`/?${params.toString()}`);
  });

  return app;
}
