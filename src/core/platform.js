import { execSync } from "node:child_process";
import process from "node:process";

export function isWindows() {
  return process.platform === "win32";
}

export function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    if (isWindows()) {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      return out.includes(String(pid));
    }
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (isWindows()) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      return;
    }
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      process.kill(pid, "SIGTERM");
    }
  } catch {}
}

export function botSpawnOptions() {
  if (isWindows()) {
    return { detached: false, windowsHide: true };
  }
  return { detached: true, windowsHide: false };
}

export function pythonExecutables() {
  if (isWindows()) {
    return [
      { cmd: "python", pipPrefix: ["-m", "pip"] },
      { cmd: "py", pipPrefix: ["-3", "-m", "pip"] },
    ];
  }
  return [
    { cmd: "python3", pipPrefix: ["-m", "pip"] },
    { cmd: "python", pipPrefix: ["-m", "pip"] },
  ];
}

export function primaryPythonRun(name) {
  if (isWindows()) {
    return {
      type: "python",
      cmd: "python",
      args: [name],
      shell: false,
      fallbackCmd: "py",
      fallbackArgs: ["-3", name],
    };
  }
  return {
    type: "python",
    cmd: "python3",
    args: [name],
    shell: false,
    fallbackCmd: "python",
    fallbackArgs: [name],
  };
}
