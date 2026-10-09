import process from "node:process";
import { isWindows } from "./platform.js";
import { normalizeStartCommand } from "./runtimeDetect.js";

export function toProcessSpawn(startCommand) {
  const norm = normalizeStartCommand(startCommand);
  const isNpm =
    norm.type === "npm" ||
    norm.cmd === "npm" ||
    norm.cmd === "npm.cmd";

  if (isWindows() && isNpm) {
    const sub = norm.args?.length ? norm.args : ["start"];
    return {
      cmd: process.env.ComSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", "npm", ...sub],
      shell: false,
    };
  }

  if (isNpm && !isWindows()) {
    return {
      cmd: "npm",
      args: norm.args?.length ? norm.args : ["start"],
      shell: false,
    };
  }

  return {
    cmd: norm.cmd,
    args: norm.args ?? [],
    shell: norm.shell ?? false,
  };
}

export function npmInstallSpawn() {
  if (isWindows()) {
    return {
      cmd: process.env.ComSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", "npm", "install"],
      shell: false,
    };
  }
  return { cmd: "npm", args: ["install"], shell: false };
}
