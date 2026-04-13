/**
 * CLI route for spawn command.
 * Usage:
 *   oracle spawn <name> "task" [--cwd X] [--orchestrator X] [--branch X] [--model X] [--yes]
 */

import { spawnAgent } from "../commands/spawn.js";

export async function routeSpawn(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "spawn") return false;

  const name = args[1];
  if (!name) {
    console.error("usage: oracle spawn <name> \"task description\" [--cwd X] [--orchestrator X] [--branch X]");
    process.exit(1);
  }

  // Collect task text — everything up to first --flag
  const rest = args.slice(2);
  const taskParts: string[] = [];
  let i = 0;
  while (i < rest.length && !rest[i].startsWith("--")) {
    taskParts.push(rest[i]);
    i++;
  }

  if (taskParts.length === 0) {
    console.error("usage: oracle spawn <name> \"task description\" [--cwd X] [--orchestrator X] [--branch X]");
    process.exit(1);
  }

  const task = taskParts.join(" ");

  // Parse flags
  const flagArgs = rest.slice(i);
  const opts: Record<string, string | boolean> = {};
  for (let j = 0; j < flagArgs.length; j++) {
    if (flagArgs[j] === "--yes" || flagArgs[j] === "-y") {
      opts.dangerouslySkipPermissions = true;
    } else if (flagArgs[j] === "--cwd" && flagArgs[j + 1]) {
      opts.cwd = flagArgs[++j];
    } else if (flagArgs[j] === "--orchestrator" && flagArgs[j + 1]) {
      opts.orchestrator = flagArgs[++j];
    } else if (flagArgs[j] === "--branch" && flagArgs[j + 1]) {
      opts.branch = flagArgs[++j];
    } else if (flagArgs[j] === "--model" && flagArgs[j + 1]) {
      opts.model = flagArgs[++j];
    }
  }

  try {
    spawnAgent(name, task, opts as any);
  } catch (err: any) {
    console.error(`\x1b[31merror\x1b[0m: ${err.message}`);
    process.exit(1);
  }

  return true;
}
