/**
 * CLI route for overview command.
 * Usage:
 *   oracle overview              — show all running agents
 *   oracle overview agent1 agent2 — show specific agents
 */

import { cmdOverview } from "../commands/overview.js";

export async function routeOverview(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "overview" && cmd !== "ov") return false;

  cmdOverview(args.slice(1));
  return true;
}
