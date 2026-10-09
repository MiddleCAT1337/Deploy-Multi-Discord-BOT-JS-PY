import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { npmInstallSpawn } from "./spawnUtil.js";
import { botSpawnOptions, pythonExecutables } from "./platform.js";

function pipInvocations() {
  return pythonExecutables().map((p) => ({
    cmd: p.cmd,
    prefix: p.pipPrefix,
  }));
}

function appendLog(logPath, text) {
  fs.appendFileSync(logPath, text, "utf8");
}

export function runLoggedCommand(cmd, args, cwd, logPath, label) {
  return new Promise((resolve, reject) => {
    appendLog(logPath, `\n--- DeployBot: ${label} ---\n> ${cmd} ${args.join(" ")}\n`);

    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      ...botSpawnOptions(),
    });

    child.stdout.on("data", (chunk) => {
      fs.appendFileSync(logPath, chunk);
    });
    child.stderr.on("data", (chunk) => {
      fs.appendFileSync(logPath, chunk);
    });

    child.on("error", (err) => reject(err));

    child.on("close", (code) => {
      appendLog(logPath, `\n--- DeployBot: ${label} exit ${code} ---\n`);
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (exit ${code})`));
    });
  });
}

export function needsNpmInstall(botPath) {
  const pkgPath = path.join(botPath, "package.json");
  if (!fs.existsSync(pkgPath)) return false;

  const nmPath = path.join(botPath, "node_modules");
  if (!fs.existsSync(nmPath)) return true;

  try {
    const pkgMtime = fs.statSync(pkgPath).mtimeMs;
    const nmMtime = fs.statSync(nmPath).mtimeMs;
    if (pkgMtime > nmMtime) return true;
  } catch {
    return true;
  }

  return false;
}

export async function ensureNpmInstall(botPath, logPath) {
  if (!needsNpmInstall(botPath)) return false;
  const npm = npmInstallSpawn();
  await runLoggedCommand(
    npm.cmd,
    npm.args,
    botPath,
    logPath,
    "npm install",
  );
  return true;
}

async function runPip(botPath, logPath, pipArgs, label) {
  let lastErr;
  for (const inv of pipInvocations()) {
    try {
      await runLoggedCommand(
        inv.cmd,
        [...inv.prefix, ...pipArgs],
        botPath,
        logPath,
        label,
      );
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error(`${label} failed`);
}

export async function ensurePythonDeps(botPath, logPath) {
  let ran = false;
  const req = path.join(botPath, "requirements.txt");
  if (fs.existsSync(req)) {
    await runPip(
      botPath,
      logPath,
      ["install", "-r", "requirements.txt"],
      "pip install -r requirements.txt",
    );
    ran = true;
  }

  const pyproject = path.join(botPath, "pyproject.toml");
  if (fs.existsSync(pyproject)) {
    await runPip(
      botPath,
      logPath,
      ["install", "."],
      "pip install .",
    );
    ran = true;
  }

  return ran;
}

export async function pipInstallModule(botPath, logPath, moduleName) {
  await runPip(
    botPath,
    logPath,
    ["install", moduleName],
    `pip install ${moduleName}`,
  );
}

const MODULE_NOT_FOUND =
  /ModuleNotFoundError: No module named ['"]([^'"]+)['"]|No module named ['"]?([^'"\s]+)['"]?/i;

export function parseMissingPythonModule(logText) {
  const lines = logText.split(/\r?\n/).reverse();
  for (const line of lines) {
    const m = MODULE_NOT_FOUND.exec(line);
    if (m) {
      const name = (m[1] ?? m[2] ?? "").trim();
      if (name) return name.split(".")[0];
    }
  }
  return null;
}

export function readLogTail(logPath, maxBytes = 48_000) {
  if (!fs.existsSync(logPath)) return "";
  const stat = fs.statSync(logPath);
  const start = Math.max(0, stat.size - maxBytes);
  const fd = fs.openSync(logPath, "r");
  try {
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    return buf.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

export async function ensureBotDependencies(bot, logPath) {
  const actions = [];

  if (fs.existsSync(path.join(bot.path, "package.json"))) {
    if (await ensureNpmInstall(bot.path, logPath)) {
      actions.push("npm install");
    }
  }

  const runtime = bot.runtime;
  const isPython =
    runtime === "python" ||
    (!runtime &&
      (fs.existsSync(path.join(bot.path, "main.py")) ||
        fs.existsSync(path.join(bot.path, "bot.py")) ||
        fs.existsSync(path.join(bot.path, "app.py"))));

  if (isPython) {
    if (await ensurePythonDeps(bot.path, logPath)) {
      actions.push("pip install");
    }
  }

  return actions;
}
