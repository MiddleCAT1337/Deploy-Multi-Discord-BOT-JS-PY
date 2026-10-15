import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { detectStartCommand, normalizeStartCommand } from "./runtimeDetect.js";
import { isExpired } from "./expiry.js";
import { LOGS_DIR } from "./paths.js";
import { persist } from "./registry.js";
import { emitBotLifecycle, emitBotStatusChange } from "./statusEvents.js";
import { exitEventFromCode } from "./botStatus.js";
import {
  ensureBotDependencies,
  parseMissingPythonModule,
  pipInstallModule,
  readLogTail,
} from "./depsInstall.js";
import { toProcessSpawn } from "./spawnUtil.js";
import {
  botSpawnOptions,
  isProcessAlive,
  killProcessTree,
} from "./platform.js";

const activeChildren = new Map();

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function spawnBot(bot, startCommand) {
  ensureLogsDir();
  const logPath = path.join(LOGS_DIR, `bot-${bot.id}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: "a" });

  const run = (cmd, args, shell) =>
    spawn(cmd, args, {
      cwd: bot.path,
      shell,
      stdio: ["ignore", "pipe", "pipe"],
      ...botSpawnOptions(),
    });

  const spawnSpec = toProcessSpawn(startCommand);
  let child = run(spawnSpec.cmd, spawnSpec.args, spawnSpec.shell);

  const pipe = (stream) => {
    stream.on("data", (chunk) => logStream.write(chunk));
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on("error", () => {
    if (startCommand.fallbackCmd) {
      child = run(
        startCommand.fallbackCmd,
        startCommand.fallbackArgs,
        startCommand.shell ?? false,
      );
      pipe(child.stdout);
      pipe(child.stderr);
    }
  });

  const cleanup = () => {
    logStream.end();
    activeChildren.delete(bot.id);
  };

  child.on("exit", cleanup);
  child.on("close", cleanup);

  activeChildren.set(bot.id, child);
  return child;
}

export function reconcileAll(state) {
  for (const bot of state.bots) {
    if (bot.pid && isProcessAlive(bot.pid)) {
      bot.status = "running";
    } else {
      bot.pid = null;
      if (isExpired(bot.expiryDate)) bot.status = "expired";
      else if (bot.status === "running") bot.status = "stopped";
    }
  }
  persist(state);
}

export async function startBot(state, id, { notify = true, pipRetried = false } = {}) {
  const bot = state.bots.find((b) => b.id === id);
  if (!bot) throw new Error(`bot=${id} not found`);

  if (isExpired(bot.expiryDate)) {
    bot.status = "expired";
    persist(state);
    throw new Error(`bot=${id} expired — use set or addday before start`);
  }

  if (bot.pid && isProcessAlive(bot.pid)) {
    throw new Error(`bot=${id} already running (PID ${bot.pid})`);
  }

  if (!fs.existsSync(bot.path)) {
    throw new Error(`path not found: ${bot.path}`);
  }

  let startCommand = bot.startCommand;
  let runtime = bot.runtime;
  if (!startCommand) {
    const detected = detectStartCommand(bot.path);
    startCommand = detected.startCommand;
    runtime = detected.runtime;
  } else {
    startCommand = normalizeStartCommand(startCommand);
  }
  bot.startCommand = startCommand;
  bot.runtime = runtime;
  persist(state);

  ensureLogsDir();
  const logPath = path.join(LOGS_DIR, `bot-${id}.log`);

  try {
    await ensureBotDependencies(bot, logPath);
  } catch (e) {
    throw new Error(`bot=${id} dependency install failed: ${e.message}`);
  }

  const child = spawnBot(bot, startCommand);
  bot.pid = child.pid ?? null;
  bot.status = "running";
  persist(state);
  if (notify) {
    emitBotLifecycle(id, "online");
    emitBotStatusChange();
  }

  child.on("exit", (code) => {
    void (async () => {
      const b = state.bots.find((x) => x.id === id);
      if (!b) return;

      if (
        code !== 0 &&
        code != null &&
        b.runtime === "python" &&
        !pipRetried
      ) {
        const missing = parseMissingPythonModule(readLogTail(logPath));
        if (missing) {
          try {
            await pipInstallModule(b.path, logPath, missing);
            await startBot(state, id, { notify, pipRetried: true });
            emitBotStatusChange(
              `[OK] bot=${id} installed python module "${missing}" and restarted`,
            );
            return;
          } catch (e) {
            emitBotStatusChange(
              `[ERR] bot=${id} pip install ${missing}: ${e.message}`,
            );
          }
        }
      }

      b.pid = null;
      if (isExpired(b.expiryDate)) b.status = "expired";
      else b.status = "stopped";
      persist(state);
      const event = exitEventFromCode(code);
      const detail =
        code !== 0 && code != null ? `process ออกด้วย code ${code}` : undefined;
      emitBotLifecycle(id, event, { detail });
      const msg =
        code !== 0 && code != null
          ? `[WARN] bot=${id} exited (code ${code})`
          : null;
      emitBotStatusChange(msg);
    })();
  });

  return bot;
}

export async function stopBot(state, id, reason = "manual") {
  const bot = state.bots.find((b) => b.id === id);
  if (!bot) throw new Error(`bot=${id} not found`);

  const child = activeChildren.get(id);
  const pid = child?.pid ?? bot.pid;

  if (pid && isProcessAlive(pid)) {
    killProcessTree(pid);
    if (child && !child.killed) {
      try {
        child.kill();
      } catch {}
    }
  }

  activeChildren.delete(id);
  bot.pid = null;
  if (isExpired(bot.expiryDate)) bot.status = "expired";
  else bot.status = "stopped";
  persist(state);
  if (reason !== "controller_exit") {
    emitBotLifecycle(id, "offline", {
      detail: reason === "expiry" ? "หมดอายุ / ถูก stop" : undefined,
    });
    emitBotStatusChange();
  }
  return { bot, reason };
}

export async function startAllRegisteredBots(state) {
  const failures = [];
  const bots = [...state.bots].sort((a, b) => a.id - b.id);
  for (const bot of bots) {
    if (isExpired(bot.expiryDate)) continue;
    if (bot.pid && isProcessAlive(bot.pid)) continue;
    try {
      await startBot(state, bot.id, { notify: true });
    } catch (e) {
      failures.push({ id: bot.id, message: e.message });
    }
  }
  return failures;
}

export async function restartBot(state, id) {
  await stopBot(state, id, "restart");
  const bot = state.bots.find((b) => b.id === id);
  if (bot) {
    bot.startCommand = null;
    bot.runtime = null;
    persist(state);
  }
  return startBot(state, id);
}

export async function stopAllRunningBots(state) {
  let stopped = 0;
  for (const bot of state.bots) {
    const running =
      bot.status === "running" || (bot.pid != null && isProcessAlive(bot.pid));
    if (!running) continue;
    try {
      await stopBot(state, bot.id, "controller_exit");
      stopped += 1;
    } catch {}
  }
  return stopped;
}

export { isProcessAlive } from "./platform.js";
