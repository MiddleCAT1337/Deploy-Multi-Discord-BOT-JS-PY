import { createContext } from "./core/commands.js";
import {
  reconcileAll,
  stopBot,
  stopAllRunningBots,
  startAllRegisteredBots,
} from "./core/processManager.js";
import { shouldAutoStop, syncExpiredStatus } from "./core/expiry.js";
import { persist } from "./core/registry.js";
import { onBotStatusChange } from "./core/statusEvents.js";
import { startRepl, appendReply } from "./cli/repl.js";
import { err } from "./core/display.js";

let expiryScheduler;
let shuttingDown = false;

async function main() {
  const ctx = createContext();
  reconcileAll(ctx.state);

  for (const bot of ctx.state.bots) {
    syncExpiredStatus(bot);
  }
  persist(ctx.state);

  const startupFailures = await startAllRegisteredBots(ctx.state);

  async function onControllerExit() {
    if (shuttingDown) return;
    shuttingDown = true;

    if (expiryScheduler) clearInterval(expiryScheduler);

    return stopAllRunningBots(ctx.state);
  }

  const rl = startRepl(ctx, { onBeforeExit: onControllerExit });

  onBotStatusChange(({ message }) => {
    if (shuttingDown || !message) return;
    appendReply(rl, message);
  });

  if (startupFailures.length > 0) {
    const lines = startupFailures.map(
      (f) => err(`auto-start bot=${f.id}: ${f.message}`),
    );
    appendReply(rl, lines.join("\n"));
  }

  expiryScheduler = setInterval(async () => {
    if (shuttingDown) return;
    for (const bot of ctx.state.bots) {
      syncExpiredStatus(bot);
      if (shouldAutoStop(bot.expiryDate) && bot.status === "running") {
        try {
          await stopBot(ctx.state, bot.id, "expiry");
          appendReply(rl, `[OK] auto-stopped bot=${bot.id} (expired)`);
        } catch {}
      }
    }
    persist(ctx.state);
  }, 60_000);

  process.on("SIGINT", () => {
    rl.close();
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
