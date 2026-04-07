import { createBot } from "./bot.js";
import { startSchedulers } from "./scheduler.js";
import { createServer } from "./server.js";
import { mainMenuKeyboard } from "./keyboards/menu.js";
import { getAllUsers } from "./repositories/userRepository.js";
import { getWebAppUrl, hasTelegramWebAppUrl } from "./webAppUrl.js";

const bot = createBot();
const app = createServer();
let server;
let shuttingDown = false;

async function announceWebAppUrl() {
  if (!hasTelegramWebAppUrl()) {
    return;
  }

  const webAppUrl = getWebAppUrl();
  const users = getAllUsers();

  for (const user of users) {
    try {
      await bot.telegram.setChatMenuButton({
        chat_id: user.chat_id,
        menu_button: {
          type: "web_app",
          text: "Open App",
          web_app: {
            url: webAppUrl
          }
        }
      });

      await bot.telegram.sendMessage(
        user.chat_id,
        "Open App",
        mainMenuKeyboard()
      );
    } catch (error) {
      console.error(`Failed to announce Mini App URL for chat ${user.chat_id}`, error);
    }
  }
}

async function start() {
  server = app.listen(app.get("port"), () => {
    console.log(`Web dashboard is running on port ${app.get("port")}`);
  });

  startSchedulers(bot);

  await bot.launch();
  console.log("Telegram bot is running.");

  if (hasTelegramWebAppUrl()) {
    console.log(`Telegram Web App URL: ${getWebAppUrl()}`);
    await announceWebAppUrl();
  } else {
    console.log("TELEGRAM_WEB_APP_URL is not set. The Telegram Mini App button will stay hidden until you set a public HTTPS URL.");
  }
}

start().catch((error) => {
  console.error("Startup failed", error);
  process.exit(1);
});

async function shutdown(signal) {
  shuttingDown = true;
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
  bot.stop(signal);
}

process.once("SIGINT", () => {
  shutdown("SIGINT").finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  shutdown("SIGTERM").finally(() => process.exit(0));
});
