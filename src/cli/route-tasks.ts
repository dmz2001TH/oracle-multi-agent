import { cmdTasksList, cmdTasksCreate, cmdTasksUpdate, cmdTasksClaim, cmdTasksDone, cmdTasksRm } from "../commands/tasks.js";

export async function routeTasks(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "tasks" && cmd !== "task") return false;

  const sub = args[1]?.toLowerCase();

  if (!sub || sub === "ls" || sub === "list") {
    await cmdTasksList(args.slice(sub ? 2 : 1));
  } else if (sub === "create" || sub === "new" || sub === "add") {
    await cmdTasksCreate(args.slice(2));
  } else if (sub === "update") {
    await cmdTasksUpdate(args[2], args.slice(3));
  } else if (sub === "claim") {
    await cmdTasksClaim(args[2]);
  } else if (sub === "done" || sub === "complete") {
    await cmdTasksDone(args[2]);
  } else if (sub === "rm" || sub === "delete" || sub === "remove") {
    await cmdTasksRm(args[2]);
  } else {
    console.error(`unknown tasks subcommand: ${sub}`);
    console.error("usage: oracle tasks <ls|create|update|claim|done|rm>");
    process.exit(1);
  }
  return true;
}
