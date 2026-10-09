import { spawnSync } from "node:child_process";
import process from "node:process";

export const DEP0190_FLAG = "--disable-warning=DEP0190";

export function hasDep0190Disabled() {
  return process.execArgv.some(
    (arg) => arg === DEP0190_FLAG || arg.startsWith("--disable-warning=DEP0190"),
  );
}

export function ensureDep0190Disabled() {
  if (hasDep0190Disabled()) return;

  const result = spawnSync(
    process.execPath,
    [...process.execArgv, DEP0190_FLAG, ...process.argv.slice(1)],
    { stdio: "inherit", env: process.env },
  );

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  const code = result.status ?? 1;
  process.exit(code);
}
