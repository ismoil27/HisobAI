import cron from "node-cron";
import { getAllUsers } from "./repositories/userRepository.js";
import { buildSummaryMessage } from "./services/summaryService.js";

export function startSchedulers(bot) {
  cron.schedule("0 9 * * 1", async () => {
    const users = await getAllUsers();
    for (const user of users) {
      const message = await buildSummaryMessage(user.id, "week", user.timezone, user.currency || "UZS");
      await bot.telegram.sendMessage(user.chat_id, `Weekly update\n\n${message}`);
    }
  });

  cron.schedule("0 9 1 * *", async () => {
    const users = await getAllUsers();
    for (const user of users) {
      const message = await buildSummaryMessage(user.id, "month", user.timezone, user.currency || "UZS");
      await bot.telegram.sendMessage(user.chat_id, `Monthly update\n\n${message}`);
    }
  });
}
