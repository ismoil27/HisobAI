import cron from "node-cron";
import { getAllUsers } from "./repositories/userRepository.js";
import { buildSummaryMessage } from "./services/summaryService.js";

export function startSchedulers(bot) {
  cron.schedule("0 9 * * 1", async () => {
    const users = getAllUsers();
    for (const user of users) {
      const message = buildSummaryMessage(user.id, "week", user.timezone);
      await bot.telegram.sendMessage(user.chat_id, `Weekly update\n\n${message}`);
    }
  });

  cron.schedule("0 9 1 * *", async () => {
    const users = getAllUsers();
    for (const user of users) {
      const message = buildSummaryMessage(user.id, "month", user.timezone);
      await bot.telegram.sendMessage(user.chat_id, `Monthly update\n\n${message}`);
    }
  });
}
