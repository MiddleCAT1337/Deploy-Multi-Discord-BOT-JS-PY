import readline from "node:readline";
import { parseCommand } from "./parser.js";
import { executeCommand } from "../core/commands.js";
import { reconcileAll } from "../core/processManager.js";
import { clearConsole, renderDashboard } from "../core/display.js";

export function appendReply(rl, message = null) {
  if (message) console.log(message);
  if (rl?.prompt) rl.prompt(true);
}

export function refreshScreen(ctx, rl, message = null) {
  reconcileAll(ctx.state);
  clearConsole();
  if (message) {
    console.log(message);
    console.log("");
  }
  console.log(renderDashboard(ctx.state));
  if (rl?.prompt) {
    rl.prompt(true);
  }
}

export function startRepl(ctx, { onBeforeExit } = {}) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "DeployBot> ",
  });

  refreshScreen(ctx, rl);

  rl.on("line", async (line) => {
    const cmd = parseCommand(line);
    try {
      const result = await executeCommand(ctx, cmd);

      if (result.exit) {
        rl.close();
        return;
      }

      if (result.refresh) {
        refreshScreen(ctx, rl, result.message ?? null);
      } else {
        reconcileAll(ctx.state);
        appendReply(rl, result.message ?? null);
      }
    } catch (e) {
      reconcileAll(ctx.state);
      appendReply(rl, `[ERR] ${e.message}`);
    }
  });

  rl.on("close", async () => {
    let stopped = 0;
    if (onBeforeExit) {
      stopped = (await onBeforeExit()) ?? 0;
    }
    clearConsole();
    if (stopped > 0) {
      console.log(`Stopped ${stopped} running bot(s).`);
    }
    console.log("Exiting DeployBot");
    process.exit(0);
  });

  return rl;
}

