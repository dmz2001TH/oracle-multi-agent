import { cmdThinkPropose, cmdThinkList, cmdThinkUpdate, cmdThinkDelete } from "../commands/think-cmd.js";

export async function routeThink(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "think") return false;
  const sub = args[1]?.toLowerCase();
  if (!sub || sub === "ls" || sub === "list") await cmdThinkList(args.slice(2));
  else if (sub === "propose" || sub === "add" || sub === "new") await cmdThinkPropose(args.slice(2));
  else if (sub === "accept") await cmdThinkUpdate(args.slice(2), "accepted");
  else if (sub === "reject") await cmdThinkUpdate(args.slice(2), "rejected");
  else if (sub === "rm" || sub === "delete") await cmdThinkDelete(args.slice(2));
  else { console.error(`unknown think subcommand: ${sub}`); process.exit(1); }
  return true;
}
