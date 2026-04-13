/**
 * CLI route for wakeup command.
 * Usage:
 *   oracle wakeup <delaySeconds> "prompt" [--reason "..."]
 */

import { cmdWakeup } from "../commands/wakeup.js";

export async function routeWakeup(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "wakeup" && cmd !== "wake") return false;

  const sub = args[1]?.toLowerCase();

  if (sub === "pending" || sub === "ls") {
    const { listPendingWakeups } = await import("../commands/wakeup.js");
    const entries = listPendingWakeups();
    if (!entries.length) {
      console.log("\x1b[90mno pending wakeups\x1b[0m");
    } else {
      console.log(`\n\x1b[36mPENDING WAKEUPS\x1b[0m (${entries.length}):\n`);
      for (const e of entries) {
        const fireAt = new Date(e.fireAt).toLocaleTimeString();
        console.log(`  ⏰ #${e.id} fires at ${fireAt} (${e.delaySeconds}s) — ${e.reason || e.prompt.slice(0, 50)}`);
      }
      console.log();
    }
  } else {
    cmdWakeup(args.slice(1));
  }
  return true;
}
