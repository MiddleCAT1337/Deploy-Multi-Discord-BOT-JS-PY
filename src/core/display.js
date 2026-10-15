import chalk from "chalk";
import {
  expiryFromStorage,
  formatDisplayDate,
  isExpired,
  nowBKK,
  remainingDaysApprox,
  remainingText,
  syncExpiredStatus,
} from "./expiry.js";
import { listBotsSorted } from "./registry.js";
import { formatBotRam } from "./processMemory.js";

const TABLE_WIDTH = 94;
const SEP = "─".repeat(TABLE_WIDTH);

export function clearConsole() {
  if (process.stdout.isTTY) {
    console.clear();
  } else {
    process.stdout.write("\x1Bc");
  }
}

function pad(str, len, align = "left") {
  const s = String(str);
  if (s.length >= len) return s.slice(0, len - 1) + "…";
  const padLen = len - s.length;
  return align === "right" ? " ".repeat(padLen) + s : s + " ".repeat(padLen);
}

function statusParts(bot) {
  syncExpiredStatus(bot);
  if (bot.status === "running") {
    return { plain: "RUNNING", colored: chalk.green("RUNNING") };
  }
  if (bot.status === "expired" || isExpired(bot.expiryDate)) {
    return { plain: "EXPIRED", colored: chalk.red("EXPIRED") };
  }
  return { plain: "STOPPED", colored: chalk.gray("STOPPED") };
}

function remainingParts(bot) {
  const text = remainingText(bot.expiryDate);
  if (text === "Expired") return { plain: text, colored: chalk.red(text) };
  const days = remainingDaysApprox(bot.expiryDate);
  if (days >= 0 && days <= 3) return { plain: text, colored: chalk.yellow(text) };
  return { plain: text, colored: text };
}

export function renderDashboard(state) {
  const lines = [];
  const bots = listBotsSorted(state);
  const now = nowBKK();
  let running = 0;
  let expiredCount = 0;

  for (const b of bots) {
    syncExpiredStatus(b);
    if (b.status === "running") running += 1;
    if (isExpired(b.expiryDate)) expiredCount += 1;
  }

  lines.push("");
  lines.push(SEP);
  lines.push(
    chalk.bold("DeployBot") +
      `  |  Bangkok ${now.toFormat("dd/MM/yyyy HH:mm:ss")}`,
  );
  lines.push(
    `Running ${running} / Total ${bots.length}` +
      (expiredCount > 0 ? `  |  Expired ${expiredCount}` : ""),
  );
  lines.push(SEP);

  const header =
    pad("#", 4, "right") +
    "  " +
    pad("Owner", 14) +
    "  " +
    pad("Status", 10) +
    "  " +
    pad("Expires", 12) +
    "  " +
    pad("Remaining", 16) +
    "  " +
    pad("Type", 8) +
    "  " +
    pad("PID", 8) +
    "  " +
    pad("RAM", 9);

  lines.push(chalk.bold(header));

  if (bots.length === 0) {
    lines.push(chalk.dim("  (No bots — use new path=... day=... name=...)"));
  } else {
    for (const bot of bots) {
      const exp = formatDisplayDate(expiryFromStorage(bot.expiryDate));
      const st = statusParts(bot);
      const rem = remainingParts(bot);
      const row =
        pad(bot.id, 4, "right") +
        "  " +
        pad(bot.name, 14) +
        "  " +
        pad(st.plain, 10).replace(st.plain, st.colored) +
        "  " +
        pad(exp, 12) +
        "  " +
        pad(rem.plain, 16).replace(rem.plain, rem.colored) +
        "  " +
        pad(bot.runtime ?? "-", 8) +
        "  " +
        pad(bot.pid ?? "-", 8) +
        "  " +
        pad(formatBotRam(bot), 9);
      lines.push(row);
    }
  }

  lines.push(SEP);
  lines.push(chalk.dim("clear  |  help"));
  lines.push("");

  return lines.join("\n");
}

export function ok(msg) {
  return chalk.green(`[OK] ${msg}`);
}

export function err(msg) {
  return chalk.red(`[ERR] ${msg}`);
}
