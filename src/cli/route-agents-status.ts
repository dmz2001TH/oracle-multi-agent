/**
 * CLI route for agents status command.
 * Usage:
 *   oracle agents [status]
 *   oracle agents kill <name>
 */

import { cmdAgentsStatus, cmdAgentsKill } from "../commands/agents-status.js";

export async function routeAgentsStatus(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "agents" && cmd !== "agent") return false;

  const sub = args[1]?.toLowerCase();

  if (!sub || sub === "status" || sub === "ls" || sub === "list") {
    cmdAgentsStatus();
  } else if (sub === "kill" || sub === "stop") {
    cmdAgentsKill(args[2]);
  } else {
    // Default: show status
    cmdAgentsStatus();
  }
  return true;
}
