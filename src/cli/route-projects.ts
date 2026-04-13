import { cmdProjectCreate, cmdProjectList, cmdProjectShow, cmdProjectAdd, cmdProjectRemove, cmdProjectUpdate, cmdProjectDelete } from "../commands/projects.js";

export async function routeProjects(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "project" && cmd !== "proj") return false;
  const sub = args[1]?.toLowerCase();
  if (!sub || sub === "ls" || sub === "list") await cmdProjectList();
  else if (sub === "create" || sub === "new") await cmdProjectCreate(args.slice(2));
  else if (sub === "show" || sub === "info") await cmdProjectShow(args.slice(2));
  else if (sub === "add") await cmdProjectAdd(args.slice(2));
  else if (sub === "rm" || sub === "remove") await cmdProjectRemove(args.slice(2));
  else if (sub === "complete" || sub === "done") await cmdProjectUpdate(args.slice(2), "completed");
  else if (sub === "archive") await cmdProjectUpdate(args.slice(2), "archived");
  else if (sub === "delete" || sub === "del") await cmdProjectDelete(args.slice(2));
  else { console.error(`unknown project subcommand: ${sub}`); process.exit(1); }
  return true;
}
