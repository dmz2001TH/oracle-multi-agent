/**
 * CLI route for cron commands.
 * Usage:
 *   oracle cron add "0/5 * * * *" "prompt" [--name X]
 *   oracle cron ls
 *   oracle cron get id
 *   oracle cron rm id
 *   oracle cron run id
 */

import { cmdCronAdd, cmdCronList, cmdCronGet, cmdCronRm, cmdCronRun } from "../commands/cron.js";

export async function routeCron(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "cron") return false;

  const sub = args[1]?.toLowerCase();

  if (!sub || sub === "ls" || sub === "list") {
    await cmdCronList();
  } else if (sub === "add" || sub === "create" || sub === "new") {
    await cmdCronAdd(args.slice(2));
  } else if (sub === "get" || sub === "show" || sub === "info") {
    await cmdCronGet(args[2]);
  } else if (sub === "rm" || sub === "delete" || sub === "remove") {
    await cmdCronRm(args[2]);
  } else if (sub === "run" || sub === "trigger" || sub === "fire") {
    await cmdCronRun(args[2]);
  } else {
    console.error(`unknown cron subcommand: ${sub}`);
    console.error("usage: oracle cron <ls|add|get|rm|run>");
    process.exit(1);
  }
  return true;
}
