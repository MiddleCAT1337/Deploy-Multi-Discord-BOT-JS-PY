import { createContext } from "./core/commands.js";
import {
  reconcileAll,
  stopBot,
  stopAllRunningBots,
  startAllRegisteredBots,
} from "./core/processManager.js";
import { shouldAutoStop, syncExpiredStatus } from "./core/expiry.js";
import { persist } from "./core/registry.js";
import { onBotStatusChange, emitBotLifecycle } from "./core/statusEvents.js";
import { loadConfig } from "./core/config.js";
import { startRepl, appendReply } from "./cli/repl.js";
import { err } from "./core/display.js";
import {
  startDiscordController,
  stopDiscordController,
} from "./discord/client.js";
import { sendStatusDm } from "./discord/notify.js";

let expiryScheduler;
let shuttingDown = false;
/** @type {import("discord.js").Client | null} */
let discordClient = null;
/** @type {string | null} */
let discordAdminId = null;

async function main() {
  const config = loadConfig();
  const ctx = createContext();
  reconcileAll(ctx.state);

  for (const bot of ctx.state.bots) {
    syncExpiredStatus(bot);
  }
  persist(ctx.state);

  /** @type {{ ready?: boolean, error?: string } | null} */
  let discordResult = null;
  if (config.discordEnabled) {
    discordResult = await startDiscordController({
      discordToken: config.discordToken,
      adminId: config.adminId,
      state: ctx.state,
    });
    if (discordResult.ready) {
      discordClient = discordResult.client;
      discordAdminId = config.adminId;
    }
  }

  async function onControllerExit() {
    if (shuttingDown) return;
    shuttingDown = true;

    if (expiryScheduler) clearInterval(expiryScheduler);

    await stopDiscordController(discordClient);
    discordClient = null;

    return stopAllRunningBots(ctx.state);
  }

  const rl = startRepl(ctx, { onBeforeExit: onControllerExit });

  if (config.discordEnabled && !discordClient) {
    const detail = discordResult?.error ? `: ${discordResult.error}` : "";
    appendReply(
      rl,
      err(`Discord controller failed${detail} — CLI still running`),
    );
  } else if (discordClient) {
    appendReply(rl, "[OK] Discord controller online (/panel in DM)");
  }

  onBotStatusChange((payload) => {
    if (shuttingDown) return;

    if (payload?.message) {
      appendReply(rl, payload.message);
    }

    if (
      payload?.kind === "bot" &&
      discordClient?.isReady() &&
      !shuttingDown
    ) {
      void sendStatusDm(discordClient, ctx.state, discordAdminId, {
        botId: payload.botId,
        event: payload.event,
        detail: payload.detail,
      });
    }
  });

  const startupFailures = await startAllRegisteredBots(ctx.state);

  if (startupFailures.length > 0) {
    const lines = startupFailures.map(
      (f) => err(`auto-start bot=${f.id}: ${f.message}`),
    );
    appendReply(rl, lines.join("\n"));
    for (const f of startupFailures) {
      emitBotLifecycle(f.id, "error", { detail: f.message });
    }
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
