import { execSync } from "node:child_process";
import fs from "node:fs";
import { isProcessAlive, isWindows } from "./platform.js";

export function formatRamBytes(bytes) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "-";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 100) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function listProcessTreePids(rootPid) {
  const root = Number(rootPid);
  if (!root) return [];

  if (isWindows()) {
    try {
      const out = execSync(
        `powershell -NoProfile -Command "$r=${root};$s=@{};$q=[Collections.Queue]::new();$q.Enqueue([int]$r);while($q.Count){$p=$q.Dequeue();if($s[$p]){continue};$s[$p]=$true;Get-CimInstance Win32_Process -Filter \\"ParentProcessId=$p\\" | ForEach-Object {$q.Enqueue([int]$_.ProcessId)}};($s.Keys -join ',')"`,
        {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
          timeout: 8000,
        },
      ).trim();
      if (!out) return [root];
      return [...new Set(out.split(",").map(Number).filter(Boolean))];
    } catch {
      return [root];
    }
  }

  try {
    const lines = execSync("ps -eo pid=,ppid=", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 5000,
    })
      .trim()
      .split("\n");
    const children = new Map();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const pid = Number(parts[0]);
      const ppid = Number(parts[1]);
      if (!children.has(ppid)) children.set(ppid, []);
      children.get(ppid).push(pid);
    }
    const pids = new Set([root]);
    const queue = [root];
    while (queue.length) {
      const p = queue.shift();
      for (const c of children.get(p) ?? []) {
        if (!pids.has(c)) {
          pids.add(c);
          queue.push(c);
        }
      }
    }
    return [...pids];
  } catch {
    return [root];
  }
}

function readRamForPids(pids) {
  if (isWindows()) {
    const idList = pids.join(",");
    try {
      const out = execSync(
        `powershell -NoProfile -Command "$ids=@(${idList});($ids | ForEach-Object { (Get-Process -Id $_ -ErrorAction SilentlyContinue).WorkingSet64 } | Measure-Object -Sum).Sum"`,
        {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
          timeout: 8000,
        },
      ).trim();
      const sum = Number(out);
      return Number.isFinite(sum) ? sum : 0;
    } catch {
      return 0;
    }
  }

  let sum = 0;
  for (const pid of pids) {
    try {
      const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
      const m = status.match(/^VmRSS:\s+(\d+)/m);
      if (m) {
        sum += Number(m[1]) * 1024;
        continue;
      }
    } catch {}
    try {
      const out = execSync(`ps -o rss= -p ${pid}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
        timeout: 3000,
      }).trim();
      const kb = Number(out);
      if (Number.isFinite(kb)) sum += kb * 1024;
    } catch {}
  }
  return sum;
}

export function getProcessTreeRamBytes(pid) {
  if (!pid || !isProcessAlive(pid)) return null;
  const pids = listProcessTreePids(pid);
  const bytes = readRamForPids(pids);
  return bytes > 0 ? bytes : null;
}

/** @param {{ status?: string, pid?: number | null }} bot */
export function formatBotRam(bot) {
  if (bot.status !== "running" || bot.pid == null) return "-";
  return formatRamBytes(getProcessTreeRamBytes(bot.pid));
}
