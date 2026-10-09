import fs from "node:fs";
import path from "node:path";
import { isWindows, primaryPythonRun } from "./platform.js";

function fileExists(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function detectStartCommand(botPath) {
  const pkgPath = path.join(botPath, "package.json");
  if (fileExists(pkgPath)) {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    } catch {
      throw new Error("cannot read package.json");
    }
    if (pkg.scripts?.start) {
      return {
        runtime: "node",
        startCommand: npmStartCommand(),
      };
    }
    if (fileExists(path.join(botPath, "index.js"))) {
      return {
        runtime: "node",
        startCommand: { type: "node", cmd: "node", args: ["index.js"], shell: false },
      };
    }
    if (fileExists(path.join(botPath, "src", "index.js"))) {
      return {
        runtime: "node",
        startCommand: {
          type: "node",
          cmd: "node",
          args: ["src/index.js"],
          shell: false,
        },
      };
    }
    throw new Error("package.json found but no npm start or index.js");
  }

  const pyCandidates = ["main.py", "bot.py", "app.py"];
  for (const name of pyCandidates) {
    if (fileExists(path.join(botPath, name))) {
      return {
        runtime: "python",
        startCommand: primaryPythonRun(name),
      };
    }
  }

  throw new Error("no package.json or main.py/bot.py/app.py found");
}

function npmStartCommand() {
  return {
    type: "npm",
    cmd: isWindows() ? "npm.cmd" : "npm",
    args: ["start"],
    shell: false,
  };
}

export function normalizeStartCommand(startCommand) {
  if (!startCommand) return startCommand;
  if (startCommand.type === "npm" || startCommand.shell === true) {
    const isNpm =
      startCommand.type === "npm" ||
      startCommand.cmd === "npm" ||
      startCommand.cmd === "npm.cmd" ||
      (Array.isArray(startCommand.args) && startCommand.args[0] === "start");
    if (isNpm) return npmStartCommand();
  }
  if (startCommand.cmd === "npm.cmd" && !isWindows()) {
    return npmStartCommand();
  }
  return startCommand;
}
