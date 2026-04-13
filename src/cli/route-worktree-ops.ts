/**
 * CLI route for worktree commands.
 * Usage:
 *   oracle worktree create <branch> [--agent X] [--cwd X]
 *   oracle worktree ls [--cwd X]
 *   oracle worktree prune [--cwd X] [--merged]
 */

import { cmdWorktreeCreate, cmdWorktreeList, cmdWorktreePrune } from "../commands/worktree-ops.js";

export async function routeWorktreeOps(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "worktree" && cmd !== "wt") return false;

  const sub = args[1]?.toLowerCase();

  if (sub === "create" || sub === "add" || sub === "new") {
    const branch = args[2];
    if (!branch) {
      console.error("usage: oracle worktree create <branch> [--agent X] [--cwd X]");
      process.exit(1);
    }

    let agent: string | undefined;
    let cwd: string | undefined;
    const rest = args.slice(3);
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--agent" && rest[i + 1]) agent = rest[++i];
      else if (rest[i] === "--cwd" && rest[i + 1]) cwd = rest[++i];
    }

    try {
      cmdWorktreeCreate(branch, { agent, cwd });
    } catch (err: any) {
      console.error(`\x1b[31merror\x1b[0m: ${err.message}`);
      process.exit(1);
    }
  } else if (!sub || sub === "ls" || sub === "list") {
    let cwd: string | undefined;
    const rest = args.slice(2);
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--cwd" && rest[i + 1]) cwd = rest[++i];
    }

    try {
      cmdWorktreeList({ cwd });
    } catch (err: any) {
      console.error(`\x1b[31merror\x1b[0m: ${err.message}`);
      process.exit(1);
    }
  } else if (sub === "prune" || sub === "clean") {
    let cwd: string | undefined;
    let merged = true;
    const rest = args.slice(2);
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--cwd" && rest[i + 1]) cwd = rest[++i];
      else if (rest[i] === "--merged") merged = true;
    }

    try {
      cmdWorktreePrune({ cwd, merged });
    } catch (err: any) {
      console.error(`\x1b[31merror\x1b[0m: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error(`unknown worktree subcommand: ${sub}`);
    console.error("usage: oracle worktree <create|ls|prune>");
    process.exit(1);
  }
  return true;
}
