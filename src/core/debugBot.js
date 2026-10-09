import fs from "node:fs";
import path from "node:path";
import { getBotById } from "./registry.js";
import {
  expiryFromStorage,
  formatDisplayDate,
  isExpired,
  remainingText,
  syncExpiredStatus,
} from "./expiry.js";
import { isProcessAlive } from "./platform.js";
import { LOGS_DIR } from "./paths.js";
import { normalizeStartCommand } from "./runtimeDetect.js";

const DEFAULT_LOG_LINES = 40;

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

function tailLogFile(logPath, maxLines) {
  if (!fs.existsSync(logPath)) {
    return { exists: false, lines: [], truncated: false };
  }
  const raw = fs.readFileSync(logPath, "utf8");
  const all = raw.split(/\r?\n/);
  const truncated = all.length > maxLines;
  const lines = all.slice(-maxLines).map(stripAnsi);
  return { exists: true, lines, truncated, bytes: fs.statSync(logPath).size };
}

function formatStartCommand(sc) {
  if (!sc) return "(not detected yet)";
  const norm = normalizeStartCommand(sc);
  const shell = norm.shell ? "shell" : "no-shell";
  return `${norm.cmd} ${norm.args?.join(" ") ?? ""} (${shell})`;
}

export function buildDebugReport(state, id, { logLines = DEFAULT_LOG_LINES } = {}) {
  const bot = getBotById(state, id);
  if (!bot) {
    return { error: `bot=${id} not found` };
  }

  syncExpiredStatus(bot);
  const pidAlive = bot.pid != null && isProcessAlive(bot.pid);
  const logPath = path.join(LOGS_DIR, `bot-${id}.log`);
  const log = tailLogFile(logPath, logLines);
  const pathOk = fs.existsSync(bot.path);

  const lines = [];
  lines.push(`=== debug bot=${bot.id} ===`);
  lines.push(`Owner:     ${bot.name}`);
  lines.push(`Status:    ${bot.status}${pidAlive ? " (process alive)" : ""}`);
  lines.push(`Path:      ${bot.path}${pathOk ? "" : "  [MISSING]"}`);
  lines.push(`Runtime:   ${bot.runtime ?? "-"}`);
  lines.push(`Start:     ${formatStartCommand(bot.startCommand)}`);
  lines.push(`PID:       ${bot.pid ?? "-"}`);
  lines.push(
    `Expiry:    ${formatDisplayDate(expiryFromStorage(bot.expiryDate))}` +
      (isExpired(bot.expiryDate) ? " (expired)" : ` (${remainingText(bot.expiryDate)} left)`),
  );
  lines.push(`Log file:  ${logPath}`);
  if (log.exists) {
    lines.push(`Log size:  ${log.bytes} bytes (last ${logLines} lines${log.truncated ? ", truncated" : ""})`);
  } else {
    lines.push("Log size:  (no log yet)");
  }
  lines.push("--- log tail ---");
  if (!log.exists) {
    lines.push("(empty)");
  } else if (log.lines.every((l) => l === "")) {
    lines.push("(empty)");
  } else {
    for (const line of log.lines) {
      lines.push(line === "" ? " " : line);
    }
  }
  lines.push("--- end debug ---");

  return { text: lines.join("\n") };
}
