/**
 * CLI route for merge command.
 * Usage:
 *   oracle merge <team> [--cwd X] [--no-push] [--no-test] [--dry-run]
 */

import { cmdMergeTeam } from "../commands/merge-team.js";

export async function routeMergeTeam(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "merge") return false;

  const team = args[1];
  if (!team) {
    console.error("usage: oracle merge <team> [--cwd X] [--no-push] [--no-test] [--dry-run]");
    process.exit(1);
  }

  let cwd: string | undefined;
  let noPush = false;
  let noTest = false;
  let dryRun = false;

  const rest = args.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--cwd" && rest[i + 1]) cwd = rest[++i];
    else if (rest[i] === "--no-push") noPush = true;
    else if (rest[i] === "--no-test") noTest = true;
    else if (rest[i] === "--dry-run") dryRun = true;
  }

  try {
    cmdMergeTeam(team, { cwd, noPush, noTest, dryRun });
  } catch (err: any) {
    console.error(`\x1b[31merror\x1b[0m: ${err.message}`);
    process.exit(1);
  }

  return true;
}
