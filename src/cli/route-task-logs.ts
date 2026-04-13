import { cmdTaskLogAdd, cmdTaskLogList, cmdTaskLogAll } from "../commands/task-logs.js";

export async function routeTaskLogs(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "tasklog" && cmd !== "tl") return false;
  const sub = args[1]?.toLowerCase();
  if (!sub || sub === "all") await cmdTaskLogAll(args.slice(2));
  else if (sub === "add" || sub === "log") await cmdTaskLogAdd(args.slice(2));
  else if (sub === "ls" || sub === "list") await cmdTaskLogList(args.slice(2));
  else { console.error(`unknown tasklog subcommand: ${sub}`); process.exit(1); }
  return true;
}
