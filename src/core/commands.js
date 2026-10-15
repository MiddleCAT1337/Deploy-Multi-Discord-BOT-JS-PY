import fs from "node:fs";
import path from "node:path";
import {
  allocateBot,
  getBotById,
  loadRegistry,
  persist,
  removeBotEntry,
  listBotsSorted,
} from "./registry.js";
import {
  computeAddDayExpiry,
  expiryFromStorage,
  expiryToStorage,
  formatDisplayDate,
  isExpired,
  expiryFromDayCount,
  parseDateDDMMYYYY,
  remainingText,
  syncExpiredStatus,
} from "./expiry.js";
import { startBot, stopBot, restartBot } from "./processManager.js";
import { emitBotLifecycle } from "./statusEvents.js";
import { ok, err } from "./display.js";
import { getHelpText } from "../cli/help.js";
import { buildDebugReport } from "./debugBot.js";

export function createContext() {
  return { state: loadRegistry() };
}

export async function executeCommand(ctx, cmd) {
  switch (cmd.type) {
    case "empty":
      return { message: null };
    case "help":
      return { message: getHelpText() };
    case "clear":
    case "status":
      return { refresh: true, message: null };
    case "exit":
      return { exit: true };
    case "new": {
      if (!cmd.path || !cmd.name) {
        return { message: err("new requires path= day= name=") };
      }
      if (!Number.isInteger(cmd.day) || cmd.day < 1) {
        return { message: err("day must be a positive integer (Bangkok, from today)") };
      }
      const absPath = path.resolve(cmd.path);
      if (!fs.existsSync(absPath)) {
        return { message: err(`path not found: ${absPath}`) };
      }
      const expiryIso = expiryFromDayCount(cmd.day);
      const bot = allocateBot(ctx.state, {
        name: cmd.name,
        botPath: absPath,
        expiryDate: expiryIso,
        ownerId: cmd.ownerid,
      });
      syncExpiredStatus(bot);
      const expiresOn = formatDisplayDate(expiryFromStorage(expiryIso));
      const added = ok(
        `added bot=${bot.id} ${cmd.name} day=${cmd.day} expires ${expiresOn} (Bangkok)`,
      );
      if (isExpired(bot.expiryDate)) {
        return { message: `${added} (expired — not started)` };
      }
      try {
        await startBot(ctx.state, bot.id);
        return { message: `${added} — running` };
      } catch (e) {
        emitBotLifecycle(bot.id, "error", { detail: e.message });
        return { message: `${added}\n${err(`start failed: ${e.message}`)}` };
      }
    }
    case "start":
    case "stop":
    case "restart": {
      if (!Number.isInteger(cmd.bot) || cmd.bot < 1) {
        return { message: err("requires bot=<id>") };
      }
      try {
        if (cmd.type === "start") {
          await startBot(ctx.state, cmd.bot);
          return { message: ok(`start bot=${cmd.bot}`) };
        }
        if (cmd.type === "stop") {
          await stopBot(ctx.state, cmd.bot);
          return { message: ok(`stop bot=${cmd.bot}`) };
        }
        await restartBot(ctx.state, cmd.bot);
        return { message: ok(`restart bot=${cmd.bot}`) };
      } catch (e) {
        if (cmd.type === "start") {
          emitBotLifecycle(cmd.bot, "error", { detail: e.message });
        }
        return { message: err(e.message) };
      }
    }
    case "remove": {
      if (!Number.isInteger(cmd.bot) || cmd.bot < 1) {
        return { message: err("requires bot=<id>") };
      }
      const bot = getBotById(ctx.state, cmd.bot);
      if (!bot) return { message: err(`bot=${cmd.bot} not found`) };
      try {
        await stopBot(ctx.state, cmd.bot);
      } catch (e) {
        return { message: err(e.message) };
      }
      if (!removeBotEntry(ctx.state, cmd.bot)) {
        return { message: err(`bot=${cmd.bot} not found`) };
      }
      return {
        message: ok(`removed bot=${cmd.bot} (${bot.name})`),
      };
    }
    case "set": {
      if (!Number.isInteger(cmd.bot) || cmd.bot < 1) {
        return { message: err("requires bot=<id>") };
      }
      if (!cmd.date && cmd.ownerid == null) {
        return { message: err("set requires date=DD/MM/YYYY and/or ownerid=") };
      }
      const bot = getBotById(ctx.state, cmd.bot);
      if (!bot) return { message: err(`bot=${cmd.bot} not found`) };
      const parts = [];
      if (cmd.date) {
        const dt = parseDateDDMMYYYY(cmd.date);
        if (!dt) return { message: err("invalid date — use DD/MM/YYYY") };
        const old = formatDisplayDate(expiryFromStorage(bot.expiryDate));
        bot.expiryDate = expiryToStorage(dt);
        syncExpiredStatus(bot);
        const neu = formatDisplayDate(dt);
        parts.push(`expiry ${old} → ${neu}`);
      }
      if (cmd.ownerid != null) {
        const prev = bot.ownerId ?? "(none)";
        const next =
          cmd.ownerid === "" || cmd.ownerid === "none"
            ? null
            : String(cmd.ownerid).trim();
        bot.ownerId = next || null;
        parts.push(`ownerId ${prev} → ${bot.ownerId ?? "(none)"}`);
      }
      persist(ctx.state);
      return {
        message: ok(`bot=${cmd.bot} ${parts.join("; ")}`),
      };
    }
    case "debug": {
      if (!Number.isInteger(cmd.bot) || cmd.bot < 1) {
        return { message: err("requires bot=<id>") };
      }
      const logLines =
        Number.isInteger(cmd.lines) && cmd.lines > 0 ? cmd.lines : 40;
      const report = buildDebugReport(ctx.state, cmd.bot, { logLines });
      if (report.error) return { message: err(report.error) };
      return { message: report.text };
    }
    case "addday": {
      if (!Number.isInteger(cmd.bot) || cmd.bot < 1) {
        return { message: err("requires bot=<id>") };
      }
      if (!Number.isInteger(cmd.day) || cmd.day < 1) {
        return { message: err("day must be a positive integer") };
      }
      const bot = getBotById(ctx.state, cmd.bot);
      if (!bot) return { message: err(`bot=${cmd.bot} not found`) };
      const oldIso = bot.expiryDate;
      const old = formatDisplayDate(expiryFromStorage(oldIso));
      bot.expiryDate = computeAddDayExpiry(oldIso, cmd.day);
      syncExpiredStatus(bot);
      persist(ctx.state);
      const neu = formatDisplayDate(expiryFromStorage(bot.expiryDate));
      const rem = isExpired(bot.expiryDate)
        ? "Expired"
        : `${remainingText(bot.expiryDate)} left`;
      return {
        message: ok(`bot=${cmd.bot} ${old} → ${neu} (${rem})`),
      };
    }
    case "adddayall": {
      if (!Number.isInteger(cmd.day) || cmd.day < 1) {
        return { message: err("day must be a positive integer") };
      }
      const bots = listBotsSorted(ctx.state);
      if (bots.length === 0) {
        return { message: err("no bots in registry") };
      }
      const lines = [];
      for (const bot of bots) {
        const old = formatDisplayDate(expiryFromStorage(bot.expiryDate));
        bot.expiryDate = computeAddDayExpiry(bot.expiryDate, cmd.day);
        syncExpiredStatus(bot);
        const neu = formatDisplayDate(expiryFromStorage(bot.expiryDate));
        lines.push(`  bot=${bot.id} ${old} → ${neu}`);
      }
      persist(ctx.state);
      return {
        message: ok(
          `adddayall day=${cmd.day} (${bots.length} bot(s))\n${lines.join("\n")}`,
        ),
      };
    }
    case "unknown":
      return { message: err(`unknown command: ${cmd.raw}`) };
    default:
      return { message: err("unknown command") };
  }
}
